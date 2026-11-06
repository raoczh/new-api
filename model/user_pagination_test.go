package model

import (
	"fmt"
	"os"
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

func insertUsersForPaginationTest(t *testing.T, total int) {
	t.Helper()
	for id := 1; id <= total; id++ {
		user := &User{
			Id:          id,
			Username:    fmt.Sprintf("user%02d", id),
			Password:    "password123",
			DisplayName: fmt.Sprintf("User %02d", id),
			Email:       fmt.Sprintf("user%02d@example.com", id),
			Role:        common.RoleCommonUser,
			Status:      common.UserStatusEnabled,
			Group:       "default",
			AffCode:     fmt.Sprintf("aff%02d", id),
		}
		require.NoError(t, DB.Create(user).Error)
	}
}

func collectUserIDs(users []*User) []int {
	ids := make([]int, 0, len(users))
	for _, user := range users {
		ids = append(ids, user.Id)
	}
	return ids
}

func TestGetAllUsersSortsBeforePagination(t *testing.T) {
	truncateTables(t)
	insertUsersForPaginationTest(t, 42)

	pageOne, total, err := GetAllUsers(&common.PageInfo{Page: 1, PageSize: 20}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20}, collectUserIDs(pageOne))

	pageTwo, total, err := GetAllUsers(&common.PageInfo{Page: 2, PageSize: 20}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40}, collectUserIDs(pageTwo))

	pageThree, total, err := GetAllUsers(&common.PageInfo{Page: 3, PageSize: 20}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{41, 42}, collectUserIDs(pageThree))
}

func TestSearchUsersSortsBeforePagination(t *testing.T) {
	truncateTables(t)
	insertUsersForPaginationTest(t, 42)

	users, total, err := SearchUsers(UserSearchFilter{Keyword: "user"}, 20, 20, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40}, collectUserIDs(users))
}

func TestSearchUsersSubstringDatabaseMatrix(test *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		test.Run(dialect, func(test *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
			case "mysql":
				connectionString := os.Getenv("TEST_MYSQL_DSN")
				if connectionString == "" {
					test.Skip("TEST_MYSQL_DSN is not configured")
				}
				driver = mysql.Open(connectionString)
			case "postgres":
				connectionString := os.Getenv("TEST_POSTGRES_DSN")
				if connectionString == "" {
					test.Skip("TEST_POSTGRES_DSN is not configured")
				}
				driver = postgres.Open(connectionString)
			}
			database, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "user_search_test_"}})
			require.NoError(test, err)
			connection, err := database.DB()
			require.NoError(test, err)
			connection.SetMaxOpenConns(1)
			test.Cleanup(func() { assert.NoError(test, connection.Close()) })
			for _, table := range []any{&User{}, &TopUp{}, &Redemption{}} {
				require.False(test, database.Migrator().HasTable(table), "refuse to overwrite an existing test table")
			}
			test.Cleanup(func() { assert.NoError(test, database.Migrator().DropTable(&Redemption{}, &TopUp{}, &User{})) })
			require.NoError(test, database.AutoMigrate(&User{}, &TopUp{}, &Redemption{}))
			previousDatabase, previousType := DB, common.MainDatabaseType()
			DB = database
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			initCol()
			test.Cleanup(func() {
				DB = previousDatabase
				common.SetMainDatabaseType(previousType)
				initCol()
			})
			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(test, database.Raw(versionQuery).Scan(&version).Error)
			test.Logf("database version: %s", version)

			fixtures := []User{
				{Id: 1, Username: "Alice_Wonder", Group: "default"},
				{Id: 2, Username: "middle_alICE_tail", Group: "vip", Role: common.RoleAdminUser, Status: common.UserStatusDisabled},
				{Id: 3, Username: "name-only", DisplayName: "Premium Member"},
				{Id: 4, Username: "mail-only", DisplayName: "\u5f20\u5c0f\u660e", Email: "Billing.Team@example.com"},
				{Id: 5, Username: "literal_mark", DisplayName: "Rate%off", Email: "bang!tag@example.com"},
				{Id: 6, Username: "literalXmark", DisplayName: `path\value`},
			}
			for _, fixture := range fixtures {
				fixture.Password = "not-for-search-responses"
				fixture.AffCode = fmt.Sprintf("search-aff-%d", fixture.Id)
				require.NoError(test, database.Create(&fixture).Error)
			}
			require.NoError(test, database.Create(&TopUp{UserId: 2, TradeNo: "search-paid", Status: common.TopUpStatusSuccess}).Error)
			adminRole, disabledStatus, recharged := common.RoleAdminUser, common.UserStatusDisabled, true
			for _, testCase := range []struct {
				name      string
				filter    UserSearchFilter
				start     int
				limit     int
				wantIDs   []int
				wantTotal int64
			}{
				{"username fragment", UserSearchFilter{Keyword: "lice"}, 0, 20, []int{1, 2}, 2},
				{"mixed case fragment", UserSearchFilter{Keyword: "aLiCe"}, 0, 20, []int{1, 2}, 2},
				{"surrounding whitespace", UserSearchFilter{Keyword: " \tALICE\n"}, 0, 20, []int{1, 2}, 2},
				{"display name fragment", UserSearchFilter{Keyword: "member"}, 0, 20, []int{3}, 1},
				{"email fragment", UserSearchFilter{Keyword: "billing.team"}, 0, 20, []int{4}, 1},
				{"single Chinese character", UserSearchFilter{Keyword: "\u5c0f"}, 0, 20, []int{4}, 1},
				{"literal underscore", UserSearchFilter{Keyword: "literal_"}, 0, 20, []int{5}, 1},
				{"literal percent", UserSearchFilter{Keyword: "%"}, 0, 20, []int{5}, 1},
				{"literal escape character", UserSearchFilter{Keyword: "!tag"}, 0, 20, []int{5}, 1},
				{"literal backslash", UserSearchFilter{Keyword: `\value`}, 0, 20, []int{6}, 1},
				{"numeric user ID", UserSearchFilter{Keyword: " 2 "}, 0, 20, []int{2}, 1},
				{"blank keyword", UserSearchFilter{Keyword: " \t "}, 0, 20, []int{1, 2, 3, 4, 5, 6}, 6},
				{"combined filters", UserSearchFilter{Keyword: "ALICE", Group: "vip", Role: &adminRole, Status: &disabledStatus, Recharged: &recharged}, 0, 20, []int{2}, 1},
				{"filtered pagination", UserSearchFilter{Keyword: "ALICE"}, 1, 1, []int{2}, 2},
				{"no matches", UserSearchFilter{Keyword: "not-present"}, 0, 20, []int{}, 0},
			} {
				test.Run(testCase.name, func(test *testing.T) {
					users, total, err := SearchUsers(testCase.filter, testCase.start, testCase.limit, NewUserSortOptions("id", "asc"))
					require.NoError(test, err)
					assert.Equal(test, testCase.wantIDs, collectUserIDs(users))
					assert.Equal(test, testCase.wantTotal, total)
					for _, user := range users {
						assert.Empty(test, user.Password)
					}
				})
			}
		})
	}
}

func TestSearchUsersFiltersByRechargeState(t *testing.T) {
	truncateTables(t)
	insertUsersForPaginationTest(t, 4)

	require.NoError(t, DB.Create(&TopUp{
		UserId: 2, Amount: 10, Money: 10, TradeNo: "recharged-topup", Status: common.TopUpStatusSuccess,
	}).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId: 3, Amount: 10, Money: 10, TradeNo: "pending-topup", Status: common.TopUpStatusPending,
	}).Error)
	require.NoError(t, DB.Create(&Redemption{
		UserId: 1, Key: "redeem-code-key", Name: "fixture", Quota: 100,
		Status: common.RedemptionCodeStatusUsed, UsedUserId: 3, RedeemedTime: 1,
	}).Error)

	recharged := true
	users, total, err := SearchUsers(UserSearchFilter{Keyword: "", Recharged: &recharged}, 0, 20, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	assert.Equal(t, []int{2, 3}, collectUserIDs(users))

	recharged = false
	users, total, err = SearchUsers(UserSearchFilter{Keyword: "", Recharged: &recharged}, 0, 20, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	assert.Equal(t, []int{1, 4}, collectUserIDs(users))
}
