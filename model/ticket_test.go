package model

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestTicketLifecycle(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(filepath.Join(t.TempDir(), "ticket.db"))
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				driver = postgres.Open(dsn)
			}
			db, err := gorm.Open(driver, &gorm.Config{
				NamingStrategy: schema.NamingStrategy{TablePrefix: "ticket_test_"},
			})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			originalDB := DB
			DB = db
			t.Cleanup(func() { DB = originalDB })
			// Migrating twice proves restarts do not keep altering the schema.
			require.NoError(t, db.AutoMigrate(&Ticket{}, &TicketMessage{}))
			require.NoError(t, db.AutoMigrate(&Ticket{}, &TicketMessage{}))
			t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(&Ticket{}, &TicketMessage{})) })

			const ownerId, otherId, adminId = 11, 12, 1
			ticket, err := CreateTicket(ownerId, "alice", "API returns 500", "first message")
			require.NoError(t, err)
			assert.Equal(t, TicketStatusOpen, ticket.Status)
			_, err = CreateTicket(otherId, "bob", "Billing question", "other user")
			require.NoError(t, err)

			// Users only see their own tickets; admins see all of them.
			own, total, err := SearchTickets(ownerId, 0, "", 0, 10)
			require.NoError(t, err)
			assert.EqualValues(t, 1, total)
			require.Len(t, own, 1)
			assert.Equal(t, ticket.Id, own[0].Id)
			_, total, err = SearchTickets(0, 0, "", 0, 10)
			require.NoError(t, err)
			assert.EqualValues(t, 2, total)
			_, total, err = SearchTickets(0, 0, "bob", 0, 10)
			require.NoError(t, err)
			assert.EqualValues(t, 1, total)

			_, _, err = GetTicket(ticket.Id, otherId)
			require.ErrorIs(t, err, ErrTicketNotFound)
			require.ErrorIs(t, ReplyTicket(ticket.Id, otherId, &TicketMessage{UserId: otherId, Content: "intrusion"}), ErrTicketNotFound)
			require.ErrorIs(t, CloseTicket(ticket.Id, otherId), ErrTicketNotFound)

			// The status follows whichever side has to answer next.
			require.NoError(t, ReplyTicket(ticket.Id, 0, &TicketMessage{UserId: adminId, Username: "root", IsAdmin: true, Content: "admin reply"}))
			got, _, err := GetTicket(ticket.Id, ownerId)
			require.NoError(t, err)
			assert.Equal(t, TicketStatusReplied, got.Status)
			_, total, err = SearchTickets(0, TicketStatusReplied, "", 0, 10)
			require.NoError(t, err)
			assert.EqualValues(t, 1, total)

			require.NoError(t, ReplyTicket(ticket.Id, ownerId, &TicketMessage{UserId: ownerId, Username: "alice", Content: "user follow-up"}))
			got, messages, err := GetTicket(ticket.Id, ownerId)
			require.NoError(t, err)
			assert.Equal(t, TicketStatusOpen, got.Status)
			require.Len(t, messages, 3)
			assert.Equal(t, []string{"first message", "admin reply", "user follow-up"},
				[]string{messages[0].Content, messages[1].Content, messages[2].Content})
			assert.Equal(t, []bool{false, true, false},
				[]bool{messages[0].IsAdmin, messages[1].IsAdmin, messages[2].IsAdmin})

			// A closed ticket rejects replies and repeated closes from either side.
			require.NoError(t, CloseTicket(ticket.Id, ownerId))
			require.ErrorIs(t, CloseTicket(ticket.Id, 0), ErrTicketClosed)
			require.ErrorIs(t, ReplyTicket(ticket.Id, 0, &TicketMessage{UserId: adminId, IsAdmin: true, Content: "late"}), ErrTicketClosed)
			got, messages, err = GetTicket(ticket.Id, 0)
			require.NoError(t, err)
			assert.Equal(t, TicketStatusClosed, got.Status)
			assert.NotZero(t, got.ClosedAt)
			assert.Len(t, messages, 3)
		})
	}
}
