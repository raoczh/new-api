package controller

import (
	"errors"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const (
	ticketTitleMaxLength   = 100
	ticketContentMaxLength = 5000
)

type ticketCreateRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type ticketReplyRequest struct {
	Content string `json:"content"`
}

func GetSelfTickets(c *gin.Context) {
	listTickets(c, c.GetInt("id"))
}

func GetAllTickets(c *gin.Context) {
	listTickets(c, 0)
}

func GetSelfTicket(c *gin.Context) {
	getTicketDetail(c, c.GetInt("id"))
}

func GetTicketByAdmin(c *gin.Context) {
	getTicketDetail(c, 0)
}

func CreateTicket(c *gin.Context) {
	var req ticketCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	title := strings.TrimSpace(req.Title)
	if title == "" || utf8.RuneCountInString(title) > ticketTitleMaxLength {
		common.ApiErrorI18n(c, i18n.MsgTicketTitleLength)
		return
	}
	content := strings.TrimSpace(req.Content)
	if content == "" || utf8.RuneCountInString(content) > ticketContentMaxLength {
		common.ApiErrorI18n(c, i18n.MsgTicketContentLength)
		return
	}
	ticket, err := model.CreateTicket(c.GetInt("id"), c.GetString("username"), title, content)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}

func ReplySelfTicket(c *gin.Context) {
	replyTicket(c, c.GetInt("id"), false)
}

func ReplyTicketByAdmin(c *gin.Context) {
	replyTicket(c, 0, true)
}

func CloseSelfTicket(c *gin.Context) {
	closeTicket(c, c.GetInt("id"))
}

func CloseTicketByAdmin(c *gin.Context) {
	closeTicket(c, 0)
}

// listTickets serves both the user and admin lists; ownerId 0 lists every user.
func listTickets(c *gin.Context, ownerId int) {
	pageInfo := common.GetPageQuery(c)
	status, _ := strconv.Atoi(c.Query("status"))
	keyword := strings.TrimSpace(c.Query("keyword"))
	tickets, total, err := model.SearchTickets(ownerId, status, keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

func getTicketDetail(c *gin.Context, ownerId int) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	ticket, messages, err := model.GetTicket(id, ownerId)
	if err != nil {
		respondTicketError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"ticket":   ticket,
		"messages": messages,
	})
}

func replyTicket(c *gin.Context, ownerId int, isAdmin bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	var req ticketReplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	content := strings.TrimSpace(req.Content)
	if content == "" || utf8.RuneCountInString(content) > ticketContentMaxLength {
		common.ApiErrorI18n(c, i18n.MsgTicketContentLength)
		return
	}
	message := &model.TicketMessage{
		UserId:   c.GetInt("id"),
		Username: c.GetString("username"),
		IsAdmin:  isAdmin,
		Content:  content,
	}
	if err := model.ReplyTicket(id, ownerId, message); err != nil {
		respondTicketError(c, err)
		return
	}
	common.ApiSuccess(c, message)
}

func closeTicket(c *gin.Context, ownerId int) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := model.CloseTicket(id, ownerId); err != nil {
		respondTicketError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func respondTicketError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrTicketNotFound):
		common.ApiErrorI18n(c, i18n.MsgTicketNotFound)
	case errors.Is(err, model.ErrTicketClosed):
		common.ApiErrorI18n(c, i18n.MsgTicketClosed)
	default:
		common.ApiError(c, err)
	}
}
