package controller

import (
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const (
	ticketTitleMaxLength     = 100
	ticketContentMaxLength   = 5000
	ticketAttachmentMaxCount = 5
	ticketRequestMaxBytes    = 16 * 1024 * 1024
)

var (
	errTicketAttachmentTooLarge = errors.New("ticket attachment too large")
	errTicketAttachmentCount    = errors.New("too many ticket attachments")
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
	req, attachments, err := parseTicketCreateRequest(c)
	if err != nil {
		respondTicketUploadError(c, err)
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
	ticket, err := model.CreateTicketWithAttachments(c.GetInt("id"), c.GetString("username"), title, content, attachments)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	service.NotifyAdminsOfNewTicket(ticket, content, attachmentNames(attachments))
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
	content, attachments, err := parseTicketReplyRequest(c)
	if err != nil {
		respondTicketUploadError(c, err)
		return
	}
	content = strings.TrimSpace(content)
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
	if err := model.ReplyTicketWithAttachments(id, ownerId, message, attachments); err != nil {
		respondTicketError(c, err)
		return
	}
	common.ApiSuccess(c, message)
}

func GetSelfTicketAttachment(c *gin.Context) {
	getTicketAttachment(c, c.GetInt("id"))
}

func GetTicketAttachmentByAdmin(c *gin.Context) {
	getTicketAttachment(c, 0)
}

func getTicketAttachment(c *gin.Context, ownerId int) {
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	attachmentId, err := strconv.Atoi(c.Param("attachmentId"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if _, _, err := model.GetTicket(ticketId, ownerId); err != nil {
		respondTicketError(c, err)
		return
	}
	attachment, err := model.GetTicketAttachment(attachmentId, ticketId)
	if err != nil {
		respondTicketError(c, err)
		return
	}
	path := model.TicketAttachmentPath(attachment)
	if _, err := os.Stat(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			common.ApiErrorI18n(c, i18n.MsgNotFound)
			return
		}
		common.ApiError(c, err)
		return
	}
	c.Header("Content-Type", attachment.ContentType)
	c.FileAttachment(path, attachment.Filename)
}

func parseTicketCreateRequest(c *gin.Context) (ticketCreateRequest, []model.TicketAttachmentInput, error) {
	if !strings.HasPrefix(strings.ToLower(c.GetHeader("Content-Type")), "multipart/form-data") {
		var req ticketCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			return req, nil, err
		}
		return req, nil, nil
	}
	limitTicketMultipartBody(c)
	if err := c.Request.ParseMultipartForm(ticketRequestMaxBytes); err != nil {
		return ticketCreateRequest{}, nil, err
	}
	files, err := parseTicketAttachments(c)
	if err != nil {
		return ticketCreateRequest{}, nil, err
	}
	return ticketCreateRequest{Title: c.PostForm("title"), Content: c.PostForm("content")}, files, nil
}

func parseTicketReplyRequest(c *gin.Context) (string, []model.TicketAttachmentInput, error) {
	if !strings.HasPrefix(strings.ToLower(c.GetHeader("Content-Type")), "multipart/form-data") {
		var req ticketReplyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			return "", nil, err
		}
		return req.Content, nil, nil
	}
	limitTicketMultipartBody(c)
	if err := c.Request.ParseMultipartForm(ticketRequestMaxBytes); err != nil {
		return "", nil, err
	}
	files, err := parseTicketAttachments(c)
	return c.PostForm("content"), files, err
}

func limitTicketMultipartBody(c *gin.Context) {
	if _, alreadyLimited := c.Get("ticket_multipart_body_limited"); alreadyLimited {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, ticketRequestMaxBytes)
	c.Set("ticket_multipart_body_limited", true)
}

func parseTicketAttachments(c *gin.Context) ([]model.TicketAttachmentInput, error) {
	form := c.Request.MultipartForm
	if form == nil {
		return nil, nil
	}
	fileHeaders := form.File["attachments"]
	if len(fileHeaders) == 0 {
		fileHeaders = form.File["files"]
	}
	if len(fileHeaders) > ticketAttachmentMaxCount {
		return nil, errTicketAttachmentCount
	}
	attachments := make([]model.TicketAttachmentInput, 0, len(fileHeaders))
	for _, header := range fileHeaders {
		file, err := header.Open()
		if err != nil {
			return nil, err
		}
		data, readErr := io.ReadAll(io.LimitReader(file, model.TicketAttachmentMaxSize+1))
		closeErr := file.Close()
		if readErr != nil {
			return nil, readErr
		}
		if closeErr != nil {
			return nil, closeErr
		}
		if int64(len(data)) > model.TicketAttachmentMaxSize {
			return nil, errTicketAttachmentTooLarge
		}
		filename := filepath.Base(strings.TrimSpace(header.Filename))
		if filename == "." || filename == "" {
			filename = "attachment"
		}
		filename = strings.ReplaceAll(filename, "\x00", "")
		filename = strings.NewReplacer("\r", "", "\n", "").Replace(filename)
		filename = truncateTicketFilename(filename)
		contentType := http.DetectContentType(data)
		if extensionType := mime.TypeByExtension(filepath.Ext(filename)); strings.HasPrefix(extensionType, "image/") {
			contentType = extensionType
		}
		attachments = append(attachments, model.TicketAttachmentInput{
			Filename: filename, ContentType: contentType, Data: data,
		})
	}
	return attachments, nil
}

func respondTicketUploadError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, errTicketAttachmentTooLarge), errors.Is(err, model.ErrTicketAttachmentTooLarge):
		common.ApiErrorI18n(c, i18n.MsgTicketAttachmentTooLarge)
	case errors.Is(err, errTicketAttachmentCount):
		common.ApiErrorI18n(c, i18n.MsgTicketAttachmentCount)
	default:
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
	}
}

func truncateTicketFilename(filename string) string {
	for len(filename) > 255 {
		filename = string([]rune(filename)[:utf8.RuneCountInString(filename)-1])
	}
	return filename
}

func attachmentNames(attachments []model.TicketAttachmentInput) []string {
	names := make([]string, 0, len(attachments))
	for _, attachment := range attachments {
		names = append(names, attachment.Filename)
	}
	return names
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
