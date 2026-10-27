package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Promotion recipient statuses. A row keeps the last delivery outcome, so
// "sent" rows can be re-queued by an explicit administrator action.
const (
	PromotionRecipientStatusPending     = "pending"
	PromotionRecipientStatusSending     = "sending"
	PromotionRecipientStatusSent        = "sent"
	PromotionRecipientStatusFailed      = "failed"
	PromotionRecipientStatusBlacklisted = "blacklisted"
)

// Promotion recipient sources.
const (
	PromotionRecipientSourceOwner  = "owner"
	PromotionRecipientSourceCommit = "commit"
	PromotionRecipientSourcePR     = "pr"
)

// PromotionRecipient is one harvested open-source author. `email` is the only
// uniqueness key: harvesting the same person from several repositories must not
// create duplicate rows, and one person can only receive the signup bonus once.
type PromotionRecipient struct {
	Id    int    `json:"id"`
	Email string `json:"email" gorm:"type:varchar(191);not null;uniqueIndex:idx_promotion_recipient_email"`

	GitHubLogin  string `json:"github_login" gorm:"type:varchar(100);index"`
	GitHubUserId int64  `json:"github_user_id"`
	AuthorName   string `json:"author_name" gorm:"type:varchar(100)"`
	ProfileUrl   string `json:"profile_url" gorm:"type:varchar(255)"`

	Repository            string `json:"repository" gorm:"type:varchar(200);index"`
	RepositoryUrl         string `json:"repository_url" gorm:"type:varchar(255)"`
	RepositoryDescription string `json:"repository_description" gorm:"type:text"`
	RepositoryStars       int    `json:"repository_stars"`
	RepositoryLanguage    string `json:"repository_language" gorm:"type:varchar(100)"`

	// Source records why this person was harvested: repository owner, commit
	// author, or pull request author.
	Source string `json:"source" gorm:"type:varchar(20)"`

	// Contribution is the short, human-readable summary shown to the
	// administrator and used as the email's personalization hook.
	Contribution string `json:"contribution" gorm:"type:text"`

	Status       string `json:"status" gorm:"type:varchar(20);index"`
	SendAttempts int    `json:"send_attempts"`
	LastSentAt   int64  `json:"last_sent_at"`
	LastError    string `json:"last_error" gorm:"type:text"`

	// BoundUserId is 0 until the address matches a registered account. The
	// pair (BoundUserId, RewardedAt) tells the bonus apart from a plain
	// registration match: a matched account that never verified its email is
	// bound but not rewarded.
	BoundUserId int   `json:"bound_user_id" gorm:"index"`
	BoundAt     int64 `json:"bound_at"`
	RewardQuota int   `json:"reward_quota"`
	RewardedAt  int64 `json:"rewarded_at"`

	CreatedAt int64 `json:"created_at"`
	UpdatedAt int64 `json:"updated_at"`
}

func (PromotionRecipient) TableName() string {
	return "promotion_recipients"
}

// PromotionRecipientView adds read-only fields resolved from the users table.
type PromotionRecipientView struct {
	PromotionRecipient
	BoundUsername string `json:"bound_username"`
	// ExistingUser reports that some account already uses this email, even if
	// the bonus was never claimed (email verification disabled at the time).
	ExistingUser bool `json:"existing_user"`
}

// PromotionRecipientFilter narrows the administrator list.
type PromotionRecipientFilter struct {
	Keyword      string
	Status       string
	RewardStatus string // "rewarded" / "pending"
	Bound        string // "bound" / "unbound"
}

func (filter PromotionRecipientFilter) query() *gorm.DB {
	query := DB.Model(&PromotionRecipient{})
	if keyword := strings.TrimSpace(filter.Keyword); keyword != "" {
		pattern := "%" + strings.ToLower(keyword) + "%"
		query = query.Where(
			"LOWER(email) LIKE ? OR LOWER(github_login) LIKE ? OR LOWER(repository) LIKE ? OR LOWER(author_name) LIKE ?",
			pattern, pattern, pattern, pattern,
		)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	switch filter.RewardStatus {
	case "rewarded":
		query = query.Where("rewarded_at > 0")
	case "pending":
		query = query.Where("rewarded_at = 0")
	}
	switch filter.Bound {
	case "bound":
		query = query.Where("bound_user_id > 0")
	case "unbound":
		query = query.Where("bound_user_id = 0")
	}
	return query
}

func ListPromotionRecipients(filter PromotionRecipientFilter, offset, limit int) ([]*PromotionRecipient, int64, error) {
	var total int64
	if err := filter.query().Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]*PromotionRecipient, 0, limit)
	err := filter.query().
		Order("id DESC").
		Offset(max(0, offset)).
		Limit(min(max(limit, 1), 100)).
		Find(&rows).Error
	return rows, total, err
}

// ListPromotionRecipientViews resolves the bound username and "account exists"
// flag for one page of rows with two bounded queries instead of N+1 lookups.
func ListPromotionRecipientViews(rows []*PromotionRecipient) ([]*PromotionRecipientView, error) {
	views := make([]*PromotionRecipientView, 0, len(rows))
	if len(rows) == 0 {
		return views, nil
	}

	userIds := make([]int, 0, len(rows))
	emails := make([]string, 0, len(rows))
	emailSet := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		if row.BoundUserId > 0 {
			userIds = append(userIds, row.BoundUserId)
		}
		if _, ok := emailSet[row.Email]; !ok {
			emailSet[row.Email] = struct{}{}
			emails = append(emails, row.Email)
		}
	}

	usernames := make(map[int]string, len(userIds))
	if len(userIds) > 0 {
		var users []User
		if err := DB.Unscoped().Select("id", "username").Where("id IN ?", userIds).Find(&users).Error; err != nil {
			return nil, err
		}
		for _, user := range users {
			usernames[user.Id] = user.Username
		}
	}

	existing := make(map[string]struct{}, len(emails))
	if len(emails) > 0 {
		var matched []string
		err := DB.Unscoped().Model(&User{}).
			Where("LOWER(email) IN ?", emails).
			Pluck("email", &matched).Error
		if err != nil {
			return nil, err
		}
		for _, email := range matched {
			existing[NormalizeEmail(email)] = struct{}{}
		}
	}

	for _, row := range rows {
		_, exists := existing[row.Email]
		views = append(views, &PromotionRecipientView{
			PromotionRecipient: *row,
			BoundUsername:      usernames[row.BoundUserId],
			ExistingUser:       exists,
		})
	}
	return views, nil
}

func GetPromotionRecipientById(id int) (*PromotionRecipient, error) {
	var recipient PromotionRecipient
	if err := DB.Where("id = ?", id).First(&recipient).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &recipient, nil
}

func GetPromotionRecipientByEmail(email string) (*PromotionRecipient, error) {
	var recipient PromotionRecipient
	err := DB.Where("email = ?", NormalizeEmail(email)).First(&recipient).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &recipient, nil
}

// CreatePromotionRecipientsIfAbsent inserts rows and silently skips addresses
// that already exist. Callers sort rows by repository popularity first, so the
// retained row for a repeated author is the most notable repository.
func CreatePromotionRecipientsIfAbsent(rows []PromotionRecipient) (int, error) {
	if len(rows) == 0 {
		return 0, nil
	}
	now := common.GetTimestamp()
	cleaned := make([]PromotionRecipient, 0, len(rows))
	seen := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		row.Email = NormalizeEmail(row.Email)
		if row.Email == "" || len(row.Email) > 191 {
			continue
		}
		if _, ok := seen[row.Email]; ok {
			continue
		}
		seen[row.Email] = struct{}{}
		if row.Status == "" {
			row.Status = PromotionRecipientStatusPending
		}
		row.CreatedAt = now
		row.UpdatedAt = now
		cleaned = append(cleaned, row)
	}
	if len(cleaned) == 0 {
		return 0, nil
	}
	result := DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "email"}},
		DoNothing: true,
	}).Create(&cleaned)
	return int(result.RowsAffected), result.Error
}

// PromotionRecipientStats powers the dashboard cards above the list.
type PromotionRecipientStats struct {
	Total              int64 `json:"total"`
	Pending            int64 `json:"pending"`
	Sent               int64 `json:"sent"`
	Failed             int64 `json:"failed"`
	Blacklisted        int64 `json:"blacklisted"`
	Bound              int64 `json:"bound"`
	Rewarded           int64 `json:"rewarded"`
	RewardedQuotaTotal int64 `json:"rewarded_quota_total"`
	SentToday          int64 `json:"sent_today"`
}

func GetPromotionRecipientStats(todayStart int64) (*PromotionRecipientStats, error) {
	stats := &PromotionRecipientStats{}
	type statusCount struct {
		Status string
		Cnt    int64
	}
	var counts []statusCount
	err := DB.Model(&PromotionRecipient{}).
		Select("status, COUNT(*) AS cnt").
		Group("status").
		Scan(&counts).Error
	if err != nil {
		return nil, err
	}
	for _, item := range counts {
		stats.Total += item.Cnt
		switch item.Status {
		case PromotionRecipientStatusPending:
			stats.Pending = item.Cnt
		case PromotionRecipientStatusSent:
			stats.Sent = item.Cnt
		case PromotionRecipientStatusFailed:
			stats.Failed = item.Cnt
		case PromotionRecipientStatusBlacklisted:
			stats.Blacklisted = item.Cnt
		}
	}

	var aggregates struct {
		Bound              int64
		Rewarded           int64
		RewardedQuotaTotal int64
	}
	err = DB.Model(&PromotionRecipient{}).
		Select(
			"COALESCE(SUM(CASE WHEN bound_user_id > 0 THEN 1 ELSE 0 END), 0) AS bound," +
				" COALESCE(SUM(CASE WHEN rewarded_at > 0 THEN 1 ELSE 0 END), 0) AS rewarded," +
				" COALESCE(SUM(reward_quota), 0) AS rewarded_quota_total",
		).
		Scan(&aggregates).Error
	if err != nil {
		return nil, err
	}
	stats.Bound = aggregates.Bound
	stats.Rewarded = aggregates.Rewarded
	stats.RewardedQuotaTotal = aggregates.RewardedQuotaTotal

	err = DB.Model(&PromotionRecipient{}).
		Where("last_sent_at >= ?", todayStart).
		Count(&stats.SentToday).Error
	if err != nil {
		return nil, err
	}
	return stats, nil
}

func HasSendablePromotionRecipients() bool {
	count, err := CountSendablePromotionRecipients()
	return err == nil && count > 0
}

// CountSendablePromotionRecipients reports how many rows are still waiting for
// delivery, used by the manual "send all" action and the scheduler.
func CountSendablePromotionRecipients() (int64, error) {
	var count int64
	err := DB.Model(&PromotionRecipient{}).
		Where("status IN ? AND send_attempts < ?", []string{PromotionRecipientStatusPending, PromotionRecipientStatusFailed}, 5).
		Count(&count).Error
	return count, err
}

// CountPromotionEmailsSentSince counts deliveries already made today so the
// daily quota survives restarts and multiple task runs.
func CountPromotionEmailsSentSince(since int64) (int64, error) {
	var count int64
	err := DB.Model(&PromotionRecipient{}).
		Where("last_sent_at >= ?", since).
		Count(&count).Error
	return count, err
}

// ListPromotionRecipientsForSending returns the next addresses to email. When
// ids is non-empty only those rows are considered (an explicit administrator
// action), still bounded by the attempt limit.
func ListPromotionRecipientsForSending(limit int, ids []int) ([]*PromotionRecipient, error) {
	if limit <= 0 {
		return nil, nil
	}
	query := DB.Model(&PromotionRecipient{}).
		Where("status IN ? AND send_attempts < ?", []string{PromotionRecipientStatusPending, PromotionRecipientStatusFailed}, 5)
	if len(ids) > 0 {
		query = query.Where("id IN ?", ids)
	}
	rows := make([]*PromotionRecipient, 0, limit)
	err := query.Order("id ASC").Limit(limit).Find(&rows).Error
	return rows, err
}

// ClaimPromotionEmailForSend flips one row to "sending" and bumps its attempt
// counter, so concurrent task runs cannot deliver the same address twice.
func ClaimPromotionEmailForSend(id int, now int64) (bool, error) {
	result := DB.Model(&PromotionRecipient{}).
		Where("id = ? AND status IN ? AND send_attempts < ?", id, []string{PromotionRecipientStatusPending, PromotionRecipientStatusFailed}, 5).
		Updates(map[string]any{
			"status":        PromotionRecipientStatusSending,
			"send_attempts": gorm.Expr("send_attempts + 1"),
			"updated_at":    now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func MarkPromotionEmailSent(id int, now int64) error {
	return DB.Model(&PromotionRecipient{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":       PromotionRecipientStatusSent,
			"last_sent_at": now,
			"last_error":   "",
			"updated_at":   now,
		}).Error
}

func MarkPromotionEmailFailed(id int, errMessage string, now int64) error {
	return DB.Model(&PromotionRecipient{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":     PromotionRecipientStatusFailed,
			"last_error": truncatePromotionText(errMessage, 500),
			"updated_at": now,
		}).Error
}

// truncatePromotionText bounds stored error text without splitting a UTF-8
// sequence, which would corrupt the column for the console.
func truncatePromotionText(value string, maxRunes int) string {
	runes := []rune(value)
	if len(runes) <= maxRunes {
		return value
	}
	return string(runes[:maxRunes])
}

// ResetStuckPromotionEmails recovers rows left in "sending" by a crashed
// process, so they can be retried instead of blocking forever.
func ResetStuckPromotionEmails(claimedBefore int64, now int64) (int64, error) {
	result := DB.Model(&PromotionRecipient{}).
		Where("status = ? AND updated_at < ?", PromotionRecipientStatusSending, claimedBefore).
		Updates(map[string]any{
			"status":     PromotionRecipientStatusFailed,
			"last_error": "delivery interrupted before completion",
			"updated_at": now,
		})
	return result.RowsAffected, result.Error
}

// MarkPromotionBlacklist stops delivery for the selected rows. Already-sent
// rows keep their history; only the status changes.
func MarkPromotionBlacklist(ids []int) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result := DB.Model(&PromotionRecipient{}).
		Where("id IN ?", ids).
		Updates(map[string]any{
			"status":     PromotionRecipientStatusBlacklisted,
			"updated_at": common.GetTimestamp(),
		})
	return result.RowsAffected, result.Error
}

// UnblacklistPromotionRecipients restores the previous delivery state: rows
// that were already delivered go back to "sent", the rest to "pending".
func UnblacklistPromotionRecipients(ids []int) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result := DB.Model(&PromotionRecipient{}).
		Where("id IN ? AND status = ?", ids, PromotionRecipientStatusBlacklisted).
		Updates(map[string]any{
			"status": gorm.Expr(
				"CASE WHEN last_sent_at > 0 THEN ? ELSE ? END",
				PromotionRecipientStatusSent, PromotionRecipientStatusPending,
			),
			"updated_at": common.GetTimestamp(),
		})
	return result.RowsAffected, result.Error
}

// ResetPromotionRecipientsForSend re-queues explicitly selected rows so a
// manual "send now" covers addresses that were already attempted or delivered.
// Rows currently owned by a running task are left alone: resetting them would
// let the same address be claimed twice and delivered twice.
func ResetPromotionRecipientsForSend(ids []int) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result := DB.Model(&PromotionRecipient{}).
		Where("id IN ? AND status NOT IN ?", ids, []string{PromotionRecipientStatusBlacklisted, PromotionRecipientStatusSending}).
		Updates(map[string]any{
			"status":        PromotionRecipientStatusPending,
			"send_attempts": 0,
			"last_error":    "",
			"updated_at":    common.GetTimestamp(),
		})
	return result.RowsAffected, result.Error
}

func DeletePromotionRecipients(ids []int) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result := DB.Where("id IN ?", ids).Delete(&PromotionRecipient{})
	return result.RowsAffected, result.Error
}

// GrantPromotionReward binds the matched address to the account and credits the
// bonus once. The conditional UPDATE plus the shared wallet ceiling check keep
// concurrent registrations, logins, and task retries from paying twice.
func GrantPromotionReward(userId int, email string, quota int) (bool, error) {
	email = NormalizeEmail(email)
	if userId <= 0 || email == "" || quota <= 0 || quota > common.MaxQuota {
		return false, nil
	}

	granted := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var recipient PromotionRecipient
		if err := lockForUpdate(tx).Where("email = ?", email).First(&recipient).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if recipient.RewardedAt != 0 {
			return nil
		}

		now := common.GetTimestamp()
		result := tx.Model(&PromotionRecipient{}).
			Where("id = ? AND rewarded_at = 0 AND (bound_user_id = 0 OR bound_user_id = ?)", recipient.Id, userId).
			Updates(map[string]any{
				"bound_user_id": userId,
				"bound_at":      now,
				"reward_quota":  quota,
				"rewarded_at":   now,
				"updated_at":    now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}
		if err := creditTopUpQuota(tx, userId, quota, nil); err != nil {
			return err
		}
		granted = true
		return nil
	})
	if err != nil {
		return false, err
	}
	if granted {
		// Commit succeeded: the cached balance must see the credit immediately,
		// otherwise the new quota is unusable until the cache expires.
		syncCreditUserQuotaCache(userId, quota, common.LogText("open source promotion"))
	}
	return granted, nil
}

// BindPromotionRecipientToUser records the account match without paying the
// bonus (already rewarded or not yet eligible).
func BindPromotionRecipientToUser(userId int, email string) error {
	email = NormalizeEmail(email)
	if userId <= 0 || email == "" {
		return nil
	}
	now := common.GetTimestamp()
	return DB.Model(&PromotionRecipient{}).
		Where("email = ? AND bound_user_id = 0", email).
		Updates(map[string]any{
			"bound_user_id": userId,
			"bound_at":      now,
			"updated_at":    now,
		}).Error
}

// ListUnrewardedPromotionRecipientsByUserId returns rows bound to the account
// that still owe the bonus; the administrator "grant again" action uses it.
func ListUnrewardedPromotionRecipientsByUserId(userId int) ([]*PromotionRecipient, error) {
	rows := make([]*PromotionRecipient, 0, 4)
	err := DB.Where("bound_user_id = ? AND rewarded_at = 0", userId).Find(&rows).Error
	return rows, err
}

func GetPromotionRecipientsByIds(ids []int) ([]*PromotionRecipient, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows := make([]*PromotionRecipient, 0, len(ids))
	err := DB.Where("id IN ?", ids).Find(&rows).Error
	return rows, err
}

var ErrPromotionRecipientNotFound = errors.New("promotion recipient not found")
