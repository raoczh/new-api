package controller

import (
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// promotionRecipientIDsRequest is the shared body of the bulk actions.
type promotionRecipientIDsRequest struct {
	Ids []int `json:"ids" binding:"required,min=1,max=1000,dive,gt=0"`
}

func promotionTodayStart() int64 {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
}

// GetOpenSourcePromotionRecipients lists the harvested authors with their
// delivery, registration, and reward state.
func GetOpenSourcePromotionRecipients(c *gin.Context) {
	filter := model.PromotionRecipientFilter{
		Keyword:      c.Query("keyword"),
		Status:       c.Query("status"),
		RewardStatus: c.Query("reward_status"),
		Bound:        c.Query("bound"),
	}
	pageInfo := common.GetPageQuery(c)
	rows, total, err := model.ListPromotionRecipients(filter, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	views, err := model.ListPromotionRecipientViews(rows)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(views)
	common.ApiSuccess(c, pageInfo)
}

func GetOpenSourcePromotionStats(c *gin.Context) {
	stats, err := model.GetPromotionRecipientStats(promotionTodayStart())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, stats)
}

func GetOpenSourcePromotionRecipient(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recipient, err := model.GetPromotionRecipientById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if recipient == nil {
		common.ApiError(c, model.ErrPromotionRecipientNotFound)
		return
	}
	views, err := model.ListPromotionRecipientViews([]*model.PromotionRecipient{recipient})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, views[0])
}

func bindPromotionIDs(c *gin.Context) ([]int, bool) {
	request := promotionRecipientIDsRequest{}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	return request.Ids, true
}

func BlacklistOpenSourcePromotionRecipients(c *gin.Context) {
	ids, ok := bindPromotionIDs(c)
	if !ok {
		return
	}
	affected, err := model.MarkPromotionBlacklist(ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "promotion.blacklist", map[string]any{"count": len(ids), "affected": affected})
	common.ApiSuccess(c, gin.H{"affected": affected})
}

func UnblacklistOpenSourcePromotionRecipients(c *gin.Context) {
	ids, ok := bindPromotionIDs(c)
	if !ok {
		return
	}
	affected, err := model.UnblacklistPromotionRecipients(ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "promotion.unblacklist", map[string]any{"count": len(ids), "affected": affected})
	common.ApiSuccess(c, gin.H{"affected": affected})
}

// SendOpenSourcePromotionEmails re-queues the selected rows and enqueues the
// delivery task. Sending is asynchronous because the per-message interval can
// take many minutes; the response carries the task for progress display.
func SendOpenSourcePromotionEmails(c *gin.Context) {
	ids, ok := bindPromotionIDs(c)
	if !ok {
		return
	}
	if !common.EmailDeliveryConfigured() {
		common.ApiErrorT(c, "Email delivery is not configured")
		return
	}
	affected, err := model.ResetPromotionRecipientsForSend(ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if affected == 0 {
		common.ApiErrorT(c, "No sendable recipients were selected")
		return
	}
	task, created, err := service.EnqueueSystemTask(model.SystemTaskTypeOpenSourcePromotionEmail, promotionEmailPayload{IDs: ids})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "promotion.send", map[string]any{"count": len(ids), "affected": affected})
	common.ApiSuccess(c, gin.H{"task": task.ToResponse(), "enqueued": created, "affected": affected})
}

// SendAllOpenSourcePromotionEmails enqueues one run for every undelivered row,
// so an administrator can trigger delivery without waiting for the schedule.
func SendAllOpenSourcePromotionEmails(c *gin.Context) {
	if !common.EmailDeliveryConfigured() {
		common.ApiErrorT(c, "Email delivery is not configured")
		return
	}
	count, err := model.CountSendablePromotionRecipients()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if count == 0 {
		common.ApiErrorT(c, "No sendable recipients were selected")
		return
	}
	task, created, err := service.EnqueueSystemTask(model.SystemTaskTypeOpenSourcePromotionEmail, promotionEmailPayload{Manual: true})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "promotion.send_all", map[string]any{"count": count})
	common.ApiSuccess(c, gin.H{"task": task.ToResponse(), "enqueued": created, "affected": count})
}

// GetOpenSourcePromotionEmailPreview returns the built-in invitation email for
// each supported language, so administrators can read the copy before writing
// a custom template.
func GetOpenSourcePromotionEmailPreview(c *gin.Context) {
	common.ApiSuccess(c, gin.H{"previews": service.OpenSourcePromotionBuiltinEmailPreview()})
}

// FetchOpenSourcePromotionAuthors enqueues one harvest run. The optional
// max_repos body field overrides the configured per-run limit.
func FetchOpenSourcePromotionAuthors(c *gin.Context) {
	payload := promotionFetchPayload{}
	// An empty body is valid: the scheduled configuration decides the scope.
	_ = c.ShouldBindJSON(&payload)
	payload.Manual = true
	task, created, err := service.EnqueueSystemTask(model.SystemTaskTypeOpenSourcePromotionFetch, payload)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "promotion.fetch", map[string]any{"max_repos": payload.MaxRepos})
	common.ApiSuccess(c, gin.H{"task": task.ToResponse(), "enqueued": created})
}

// RegrantOpenSourcePromotionReward retries the bonus for selected rows that are
// bound to an account but never received it (for example, a wallet ceiling
// rejection). Rows already rewarded are skipped, never paid twice.
func RegrantOpenSourcePromotionReward(c *gin.Context) {
	ids, ok := bindPromotionIDs(c)
	if !ok {
		return
	}
	recipients, err := model.GetPromotionRecipientsByIds(ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	grantedCount := 0
	skipped := 0
	failed := 0
	for _, recipient := range recipients {
		if recipient == nil || recipient.BoundUserId <= 0 || recipient.RewardedAt > 0 {
			skipped++
			continue
		}
		user := model.User{}
		if err := model.DB.Select("id", "email").Where("id = ?", recipient.BoundUserId).First(&user).Error; err != nil {
			failed++
			continue
		}
		if _, granted := service.GrantOpenSourcePromotionReward(user.Id, recipient.Email, true); granted {
			grantedCount++
		} else {
			skipped++
		}
	}
	recordManageAudit(c, "promotion.regrant", map[string]any{"count": len(ids), "granted": grantedCount, "skipped": skipped, "failed": failed})
	common.ApiSuccess(c, gin.H{"granted": grantedCount, "skipped": skipped, "failed": failed})
}

func DeleteOpenSourcePromotionRecipient(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	affected, err := model.DeletePromotionRecipients([]int{id})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if affected == 0 {
		common.ApiError(c, model.ErrPromotionRecipientNotFound)
		return
	}
	recordManageAudit(c, "promotion.delete", map[string]any{"id": id})
	common.ApiSuccess(c, gin.H{"affected": affected})
}
