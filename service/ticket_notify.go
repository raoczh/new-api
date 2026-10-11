package service

import (
	"fmt"
	"html"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// NotifyAdminsOfNewTicket sends the new ticket notification without delaying
// the user's request while SMTP connections are established.
func NotifyAdminsOfNewTicket(ticket *model.Ticket, content string, attachmentNames []string) {
	if ticket == nil {
		return
	}
	ticketID := ticket.Id
	username := ticket.Username
	title := ticket.Title
	go func() {
		var admins []model.User
		if err := model.DB.Select("id", "email").
			Where("status = ? AND role >= ? AND email <> ''", common.UserStatusEnabled, common.RoleAdminUser).
			Find(&admins).Error; err != nil {
			common.SysLog(fmt.Sprintf("failed to query ticket notification admins: %v", err))
			return
		}

		body := fmt.Sprintf("<p>A new ticket was submitted by <strong>%s</strong>.</p><p><strong>Ticket #%d:</strong> %s</p><p>%s</p>",
			html.EscapeString(username), ticketID, html.EscapeString(title), html.EscapeString(content))
		if len(attachmentNames) > 0 {
			escapedNames := make([]string, 0, len(attachmentNames))
			for _, name := range attachmentNames {
				escapedNames = append(escapedNames, html.EscapeString(name))
			}
			body += "<p><strong>Attachments:</strong> " + strings.Join(escapedNames, ", ") + "</p>"
		}
		for _, admin := range admins {
			if err := common.SendEmail(fmt.Sprintf("New ticket #%d: %s", ticketID, title), admin.Email, body); err != nil {
				common.SysLog(fmt.Sprintf("failed to notify admin %d about ticket %d: %v", admin.Id, ticketID, err))
			}
		}
	}()
}
