package model

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	TicketStatusOpen    = 1 // waiting for an admin reply
	TicketStatusReplied = 2 // an admin replied, waiting for the user
	TicketStatusClosed  = 3
)

var (
	ErrTicketNotFound           = errors.New("ticket not found")
	ErrTicketClosed             = errors.New("ticket closed")
	ErrTicketAttachmentTooLarge = errors.New("ticket attachment too large")
)

const TicketAttachmentMaxSize int64 = 2 * 1024 * 1024

type TicketAttachmentInput struct {
	Filename    string
	ContentType string
	Data        []byte
}

// Ticket 用户工单
type Ticket struct {
	Id        int    `json:"id"`
	UserId    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"type:varchar(64);default:''"`
	Title     string `json:"title" gorm:"type:varchar(255);not null"`
	Status    int    `json:"status" gorm:"index;default:1"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint;index"`
	ClosedAt  int64  `json:"closed_at" gorm:"bigint"`
}

// TicketMessage 工单中的一条消息，IsAdmin 标记是否由管理员发送
type TicketMessage struct {
	Id          int                 `json:"id"`
	TicketId    int                 `json:"ticket_id" gorm:"index"`
	UserId      int                 `json:"user_id"`
	Username    string              `json:"username" gorm:"type:varchar(64);default:''"`
	IsAdmin     bool                `json:"is_admin"`
	Content     string              `json:"content" gorm:"type:text"`
	CreatedAt   int64               `json:"created_at" gorm:"bigint"`
	Attachments []*TicketAttachment `json:"attachments" gorm:"-"`
}

type TicketAttachment struct {
	Id          int    `json:"id"`
	TicketId    int    `json:"ticket_id" gorm:"index"`
	MessageId   int    `json:"message_id" gorm:"index"`
	Filename    string `json:"filename" gorm:"type:varchar(255)"`
	ContentType string `json:"content_type" gorm:"type:varchar(255)"`
	Size        int64  `json:"size"`
	StorageKey  string `json:"-" gorm:"type:varchar(255);uniqueIndex"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
}

func (Ticket) TableName() string {
	return "tickets"
}

func (TicketMessage) TableName() string {
	return "ticket_messages"
}

func (TicketAttachment) TableName() string {
	return "ticket_attachments"
}

// SearchTickets lists tickets ordered by latest activity. userId 0 means all
// users (admin view); keyword matches the ticket id, title or username.
func SearchTickets(userId int, status int, keyword string, startIdx int, num int) (tickets []*Ticket, total int64, err error) {
	query := DB.Model(&Ticket{})
	if userId != 0 {
		query = query.Where("user_id = ?", userId)
	}
	if status != 0 {
		query = query.Where("status = ?", status)
	}
	if keyword != "" {
		if id, convErr := strconv.Atoi(keyword); convErr == nil {
			query = query.Where("id = ? OR title LIKE ? OR username LIKE ?", id, "%"+keyword+"%", keyword+"%")
		} else {
			query = query.Where("title LIKE ? OR username LIKE ?", "%"+keyword+"%", keyword+"%")
		}
	}
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("updated_at desc").Order("id desc").Limit(num).Offset(startIdx).Find(&tickets).Error
	return tickets, total, err
}

// GetTicket loads a ticket with its messages. userId 0 skips the ownership check.
func GetTicket(id int, userId int) (*Ticket, []*TicketMessage, error) {
	query := DB.Where("id = ?", id)
	if userId != 0 {
		query = query.Where("user_id = ?", userId)
	}
	var ticket Ticket
	if err := query.First(&ticket).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrTicketNotFound
		}
		return nil, nil, err
	}
	var messages []*TicketMessage
	if err := DB.Where("ticket_id = ?", id).Order("id asc").Find(&messages).Error; err != nil {
		return nil, nil, err
	}
	if len(messages) > 0 {
		attachments := make([]TicketAttachment, 0)
		if err := DB.Where("ticket_id = ?", id).Order("id asc").Find(&attachments).Error; err != nil {
			return nil, nil, err
		}
		attachmentsByMessage := make(map[int][]*TicketAttachment, len(messages))
		for i := range attachments {
			attachment := &attachments[i]
			attachmentsByMessage[attachment.MessageId] = append(attachmentsByMessage[attachment.MessageId], attachment)
		}
		for _, message := range messages {
			message.Attachments = attachmentsByMessage[message.Id]
		}
	}
	return &ticket, messages, nil
}

func CreateTicket(userId int, username string, title string, content string) (*Ticket, error) {
	return CreateTicketWithAttachments(userId, username, title, content, nil)
}

func CreateTicketWithAttachments(userId int, username string, title string, content string, inputs []TicketAttachmentInput) (*Ticket, error) {
	now := common.GetTimestamp()
	ticket := &Ticket{
		UserId:    userId,
		Username:  username,
		Title:     title,
		Status:    TicketStatusOpen,
		CreatedAt: now,
		UpdatedAt: now,
	}
	var storedPaths []string
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(ticket).Error; err != nil {
			return err
		}
		message := &TicketMessage{
			TicketId:  ticket.Id,
			UserId:    userId,
			Username:  username,
			Content:   content,
			CreatedAt: now,
		}
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		return persistTicketAttachments(tx, ticket.Id, message.Id, inputs, &storedPaths)
	})
	if err != nil {
		removeTicketFiles(storedPaths)
		return nil, err
	}
	return ticket, nil
}

// ReplyTicket appends a message and moves the ticket to the side that must
// answer next. ownerId 0 means an admin reply that may target any ticket.
func ReplyTicket(id int, ownerId int, sender *TicketMessage) error {
	return ReplyTicketWithAttachments(id, ownerId, sender, nil)
}

func ReplyTicketWithAttachments(id int, ownerId int, sender *TicketMessage, inputs []TicketAttachmentInput) error {
	now := common.GetTimestamp()
	nextStatus := TicketStatusOpen
	if sender.IsAdmin {
		nextStatus = TicketStatusReplied
	}
	var storedPaths []string
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := ensureTicketOpen(tx, id, ownerId); err != nil {
			return err
		}
		// The status guard keeps a concurrent close from being overwritten.
		result := tx.Model(&Ticket{}).
			Where("id = ? AND status <> ?", id, TicketStatusClosed).
			Updates(map[string]any{"status": nextStatus, "updated_at": now})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrTicketClosed
		}
		sender.Id = 0
		sender.TicketId = id
		sender.CreatedAt = now
		if err := tx.Create(sender).Error; err != nil {
			return err
		}
		return persistTicketAttachments(tx, id, sender.Id, inputs, &storedPaths)
	})
	if err != nil {
		removeTicketFiles(storedPaths)
	}
	return err
}

func persistTicketAttachments(tx *gorm.DB, ticketId int, messageId int, inputs []TicketAttachmentInput, storedPaths *[]string) error {
	if len(inputs) == 0 {
		return nil
	}
	attachmentDir := filepath.Join(*common.LogDir, "ticket-attachments")
	if err := os.MkdirAll(attachmentDir, 0700); err != nil {
		return err
	}
	for _, input := range inputs {
		if int64(len(input.Data)) > TicketAttachmentMaxSize {
			return ErrTicketAttachmentTooLarge
		}
		storageKey := fmt.Sprintf("%d-%s", time.Now().UnixNano(), common.GetRandomString(32))
		path := filepath.Join(attachmentDir, storageKey)
		if err := os.WriteFile(path, input.Data, 0600); err != nil {
			return err
		}
		*storedPaths = append(*storedPaths, path)
		attachment := &TicketAttachment{
			TicketId:    ticketId,
			MessageId:   messageId,
			Filename:    input.Filename,
			ContentType: input.ContentType,
			Size:        int64(len(input.Data)),
			StorageKey:  storageKey,
			CreatedAt:   common.GetTimestamp(),
		}
		if err := tx.Create(attachment).Error; err != nil {
			return err
		}
	}
	return nil
}

func removeTicketFiles(paths []string) {
	for _, path := range paths {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			common.SysError(fmt.Sprintf("failed to remove ticket attachment %s: %v", path, err))
		}
	}
}

func GetTicketAttachment(id int, ticketId int) (*TicketAttachment, error) {
	var attachment TicketAttachment
	if err := DB.Where("id = ? AND ticket_id = ?", id, ticketId).First(&attachment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTicketNotFound
		}
		return nil, err
	}
	return &attachment, nil
}

func TicketAttachmentPath(attachment *TicketAttachment) string {
	return filepath.Join(*common.LogDir, "ticket-attachments", attachment.StorageKey)
}

// CloseTicket closes an open ticket. ownerId 0 means an admin close.
func CloseTicket(id int, ownerId int) error {
	now := common.GetTimestamp()
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := ensureTicketOpen(tx, id, ownerId); err != nil {
			return err
		}
		result := tx.Model(&Ticket{}).
			Where("id = ? AND status <> ?", id, TicketStatusClosed).
			Updates(map[string]any{"status": TicketStatusClosed, "updated_at": now, "closed_at": now})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrTicketClosed
		}
		return nil
	})
}

func ensureTicketOpen(tx *gorm.DB, id int, ownerId int) error {
	query := tx.Model(&Ticket{}).Select("status").Where("id = ?", id)
	if ownerId != 0 {
		query = query.Where("user_id = ?", ownerId)
	}
	var ticket Ticket
	if err := query.First(&ticket).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTicketNotFound
		}
		return err
	}
	if ticket.Status == TicketStatusClosed {
		return ErrTicketClosed
	}
	return nil
}
