package model

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// TestPromotionRecipientDatabaseMatrix covers the invariants the harvest and
// signup-bonus flows rely on: the address is unique, a repeated harvest does not
// create a second row, the bonus is credited once, and one row can only be
// claimed for delivery once at a time. It runs on every supported database
// because the behaviour comes from dialect-specific SQL (ON CONFLICT / ON
// DUPLICATE KEY UPDATE and the conditional UPDATE).
func TestPromotionRecipientDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var dialector gorm.Dialector
			switch dialect {
			case "sqlite":
				dialector = sqlite.Open(filepath.Join(t.TempDir(), "promotion.db"))
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				dialector = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				dialector = postgres.Open(dsn)
			}

			db, err := gorm.Open(dialector, &gorm.Config{
				NamingStrategy: schema.NamingStrategy{TablePrefix: "promotion_test_"},
			})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			t.Cleanup(func() { assert.NoError(t, sqlDB.Close()) })

			previousDB := DB
			previousType := common.MainDatabaseType()
			DB = db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			t.Cleanup(func() {
				DB = previousDB
				common.SetMainDatabaseType(previousType)
			})

			// Migrating twice proves a restart does not keep altering the schema.
			require.NoError(t, db.AutoMigrate(&PromotionRecipient{}, &User{}))
			require.NoError(t, db.AutoMigrate(&PromotionRecipient{}, &User{}))
			t.Cleanup(func() {
				assert.NoError(t, db.Migrator().DropTable(&PromotionRecipient{}, &User{}))
			})

			var version string
			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database version: %s", version)

			indexes, err := db.Migrator().GetIndexes(&PromotionRecipient{})
			require.NoError(t, err)
			var emailIndex gorm.Index
			for _, index := range indexes {
				if index.Name() == "idx_promotion_recipient_email" {
					emailIndex = index
				}
			}
			require.NotNil(t, emailIndex, "the email column must carry idx_promotion_recipient_email")
			if unique, known := emailIndex.Unique(); known {
				assert.True(t, unique, "the email index must be unique")
			}

			// One harvest batch lists the same person twice: once with padding and
			// upper case, once plain. Only the first spelling may be stored.
			inserted, err := CreatePromotionRecipientsIfAbsent([]PromotionRecipient{
				{Email: "  Alice@Example.com ", GitHubLogin: "alice", Repository: "owner/popular", RepositoryStars: 1200},
				{Email: "alice@example.com", GitHubLogin: "alice", Repository: "owner/small", RepositoryStars: 12},
			})
			require.NoError(t, err)
			assert.Equal(t, 1, inserted)

			// A later harvest revisits alice and finds a new author.
			inserted, err = CreatePromotionRecipientsIfAbsent([]PromotionRecipient{
				{Email: "ALICE@example.com", GitHubLogin: "alice", Repository: "owner/revisited"},
				{Email: "bob@example.com", GitHubLogin: "bob", Repository: "owner/revisited"},
			})
			require.NoError(t, err)
			assert.Equal(t, 1, inserted)

			var count int64
			require.NoError(t, db.Model(&PromotionRecipient{}).Count(&count).Error)
			assert.EqualValues(t, 2, count)

			var alice PromotionRecipient
			require.NoError(t, db.Where("email = ?", "alice@example.com").First(&alice).Error)
			assert.Equal(t, "alice@example.com", alice.Email)
			assert.Equal(t, "owner/popular", alice.Repository, "the earliest harvested row is kept")
			assert.Equal(t, PromotionRecipientStatusPending, alice.Status)

			user := User{Username: "promotion-user", Password: "password", Email: "alice@example.com", Quota: 5, AffCode: "promotion-user-aff"}
			require.NoError(t, db.Create(&user).Error)

			granted, err := GrantPromotionReward(user.Id, "Alice@Example.com", 700)
			require.NoError(t, err)
			assert.True(t, granted)

			granted, err = GrantPromotionReward(user.Id, "alice@example.com", 700)
			require.NoError(t, err)
			assert.False(t, granted, "a repeated signup must not pay the bonus twice")

			var reloaded User
			require.NoError(t, db.First(&reloaded, user.Id).Error)
			assert.Equal(t, 705, reloaded.Quota)

			var rewarded PromotionRecipient
			require.NoError(t, db.Where("email = ?", "alice@example.com").First(&rewarded).Error)
			assert.Equal(t, user.Id, rewarded.BoundUserId)
			assert.Equal(t, 700, rewarded.RewardQuota)
			assert.NotZero(t, rewarded.RewardedAt)

			// A second account with the same address must not take the bonus either.
			other := User{Username: "promotion-other", Password: "password", Email: "alice@example.com", AffCode: "promotion-other-aff"}
			require.NoError(t, db.Create(&other).Error)
			granted, err = GrantPromotionReward(other.Id, "alice@example.com", 700)
			require.NoError(t, err)
			assert.False(t, granted)

			now := common.GetTimestamp()
			claimed, err := ClaimPromotionEmailForSend(alice.Id, now)
			require.NoError(t, err)
			assert.True(t, claimed)

			claimed, err = ClaimPromotionEmailForSend(alice.Id, now)
			require.NoError(t, err)
			assert.False(t, claimed, "a row already in flight must not be claimed twice")

			// A failed delivery returns the row to the queue, so a retry works.
			require.NoError(t, MarkPromotionEmailFailed(alice.Id, "smtp timeout", now))
			claimed, err = ClaimPromotionEmailForSend(alice.Id, now)
			require.NoError(t, err)
			assert.True(t, claimed)

			var attempted PromotionRecipient
			require.NoError(t, db.First(&attempted, alice.Id).Error)
			assert.Equal(t, 2, attempted.SendAttempts)
			assert.Equal(t, PromotionRecipientStatusSending, attempted.Status)
		})
	}
}
