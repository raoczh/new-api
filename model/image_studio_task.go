package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// ImageStudioTaskKind distinguishes the two interactive workbenches that share
// the same concurrency budget machinery. Only the image workbench is exposed
// today; video reuses the same queue when it lands.
type ImageStudioTaskKind string

const (
	ImageStudioKindImage ImageStudioTaskKind = "image"
	ImageStudioKindVideo ImageStudioTaskKind = "video"
)

// ImageStudioTaskStatus mirrors the user-visible lifecycle:
//
//	queued    -> waiting for a concurrency slot
//	running   -> relay in flight
//	succeeded -> result files persisted
//	failed    -> upstream or local failure, quota refunded
//	canceled  -> user canceled while queued
//	expired   -> never got a slot within QueueMaxWaitMinutes
type ImageStudioTaskStatus string

const (
	ImageStudioStatusQueued    ImageStudioTaskStatus = "queued"
	ImageStudioStatusRunning   ImageStudioTaskStatus = "running"
	ImageStudioStatusSucceeded ImageStudioTaskStatus = "succeeded"
	ImageStudioStatusFailed    ImageStudioTaskStatus = "failed"
	ImageStudioStatusCanceled  ImageStudioTaskStatus = "canceled"
	ImageStudioStatusExpired   ImageStudioTaskStatus = "expired"
)

// ImageStudioTask is one interactive generation request. It is intentionally
// separate from Task: that table models asynchronous vendor jobs, while these
// rows are gateway-local work items whose lifecycle the server owns end to end.
type ImageStudioTask struct {
	Id     string `json:"id" gorm:"primaryKey;type:varchar(64)"`
	UserId int    `json:"user_id" gorm:"index"`
	Kind   string `json:"kind" gorm:"type:varchar(16);index"`

	Status ImageStudioTaskStatus `json:"status" gorm:"type:varchar(20);index"`

	Model string `json:"model" gorm:"type:varchar(191)"`
	Group string `json:"group" gorm:"type:varchar(64)"`

	// Prompt is stored verbatim so a record can be reused as a new submission
	// without asking the user to retype it.
	Prompt string `json:"prompt" gorm:"type:text"`

	// Params is the normalized generation parameter snapshot (size, quality,
	// background, output format, n, ...) serialized as JSON.
	Params string `json:"params" gorm:"type:text"`
	// ReferenceKeys / MaskKey reference uploaded files in the artifact store.
	ReferenceKeys string `json:"reference_keys" gorm:"type:text"`
	MaskKey       string `json:"mask_key" gorm:"type:text"`
	// ResultKeys lists persisted output files, in generation order.
	ResultKeys string `json:"result_keys" gorm:"type:text"`

	Error string `json:"error" gorm:"type:text"`

	// Quota is the amount actually charged. It stays zero while queued so a
	// canceled or expired task never needs a refund.
	Quota       int   `json:"quota"`
	Favorite    bool  `json:"favorite" gorm:"index"`
	ChannelId   int   `json:"channel_id"`
	RequestId   string `json:"request_id" gorm:"type:varchar(64);index"`
	ElapsedMs   int64 `json:"elapsed_ms"`

	CreatedAt  int64 `json:"created_at" gorm:"index"`
	UpdatedAt  int64 `json:"updated_at"`
	StartedAt  int64 `json:"started_at"`
	FinishedAt int64 `json:"finished_at"`
	ExpiresAt  int64 `json:"expires_at" gorm:"index"`
}

func (ImageStudioTask) TableName() string {
	return "image_studio_tasks"
}

// IsActive reports whether the task still occupies a queue slot.
func (t *ImageStudioTask) IsActive() bool {
	return t.Status == ImageStudioStatusQueued || t.Status == ImageStudioStatusRunning
}

// GenerateImageStudioTaskID returns an opaque task id. The prefix keeps ids
// recognizable in logs without leaking ordering or user information.
func GenerateImageStudioTaskID() string {
	key, err := common.GenerateRandomCharsKey(24)
	if err != nil {
		// crypto/rand failing is fatal for token generation too; fall back to
		// the nanosecond clock so task creation never panics.
		return "img_" + common.GetRandomString(24)
	}
	return "img_" + key
}

// CreateImageStudioTask inserts a queued task and returns the stored row.
func CreateImageStudioTask(task *ImageStudioTask) error {
	now := common.GetTimestamp()
	task.CreatedAt = now
	task.UpdatedAt = now
	return DB.Create(task).Error
}

func GetImageStudioTaskById(id string) (*ImageStudioTask, error) {
	var task ImageStudioTask
	err := DB.Where("id = ?", id).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// GetUserImageStudioTask scopes the lookup to its owner so ids cannot be
// probed across accounts.
func GetUserImageStudioTask(id string, userId int) (*ImageStudioTask, error) {
	var task ImageStudioTask
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

type ImageStudioTaskFilter struct {
	Kind     string
	Model    string
	Status   string
	Keyword  string
	Favorite bool
	Offset   int
	Limit    int
}

// ListUserImageStudioTasks returns the page plus the total for the same filter.
func ListUserImageStudioTasks(userId int, filter ImageStudioTaskFilter) ([]*ImageStudioTask, int64, error) {
	query := DB.Model(&ImageStudioTask{}).Where("user_id = ?", userId)
	if filter.Kind != "" {
		query = query.Where("kind = ?", filter.Kind)
	}
	if filter.Model != "" {
		query = query.Where("model = ?", filter.Model)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Favorite {
		query = query.Where("favorite = ?", true)
	}
	if keyword := strings.TrimSpace(filter.Keyword); keyword != "" {
		query = query.Where("prompt LIKE ?", "%"+escapeLikePattern(keyword)+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var tasks []*ImageStudioTask
	err := query.
		Order("created_at DESC, id DESC").
		Offset(max(filter.Offset, 0)).
		Limit(clampPageSize(filter.Limit)).
		Find(&tasks).Error
	if err != nil {
		return nil, 0, err
	}
	return tasks, total, nil
}

func clampPageSize(limit int) int {
	if limit <= 0 {
		return 24
	}
	if limit > 100 {
		return 100
	}
	return limit
}

// escapeLikePattern neutralizes LIKE wildcards typed by users so a search for
// "100%" does not turn into a scan for "100<anything>".
func escapeLikePattern(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(value)
}

// UpdateImageStudioTaskFields applies a partial update. Callers must not pass
// user-controlled column names.
func UpdateImageStudioTaskFields(id string, fields map[string]any) error {
	if len(fields) == 0 {
		return nil
	}
	fields["updated_at"] = common.GetTimestamp()
	return DB.Model(&ImageStudioTask{}).Where("id = ?", id).Updates(fields).Error
}

// SetImageStudioTaskFavorite toggles the star flag for one owned task.
func SetImageStudioTaskFavorite(id string, userId int, favorite bool) error {
	result := DB.Model(&ImageStudioTask{}).
		Where("id = ? AND user_id = ?", id, userId).
		Updates(map[string]any{
			"favorite":   favorite,
			"updated_at": common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errImageStudioTaskNotFound
	}
	return nil
}

var errImageStudioTaskNotFound = errors.New("image studio task not found")

// ErrImageStudioTaskNotFound exposes the not-found sentinel to controllers.
func ErrImageStudioTaskNotFound() error {
	return errImageStudioTaskNotFound
}

// ListUserImageStudioTasksByIds fetches owned tasks for batch operations.
func ListUserImageStudioTasksByIds(userId int, ids []string) ([]*ImageStudioTask, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var tasks []*ImageStudioTask
	err := DB.Where("user_id = ? AND id IN ?", userId, ids).Find(&tasks).Error
	if err != nil {
		return nil, err
	}
	return tasks, nil
}

// DeleteImageStudioTask removes an owned task and reports whether a row was
// actually deleted.
func DeleteImageStudioTask(id string, userId int) (bool, error) {
	result := DB.Where("id = ? AND user_id = ?", id, userId).Delete(&ImageStudioTask{})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

// DeleteImageStudioTasks removes owned tasks in bulk.
func DeleteImageStudioTasks(userId int, ids []string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result := DB.Where("user_id = ? AND id IN ?", userId, ids).Delete(&ImageStudioTask{})
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}

// CountRunningImageStudioTasks counts tasks holding a concurrency slot.
func CountRunningImageStudioTasks(kind string) (int64, error) {
	var count int64
	err := DB.Model(&ImageStudioTask{}).
		Where("kind = ? AND status = ?", kind, ImageStudioStatusRunning).
		Count(&count).Error
	return count, err
}

// CountActiveUserImageStudioTasks counts a user's queued and running tasks.
// The submission guard uses it so one account cannot occupy every slot.
func CountActiveUserImageStudioTasks(userId int) (int, error) {
	var count int64
	err := DB.Model(&ImageStudioTask{}).
		Where("user_id = ? AND status IN ?", userId, []ImageStudioTaskStatus{
			ImageStudioStatusQueued,
			ImageStudioStatusRunning,
		}).
		Count(&count).Error
	return int(count), err
}

// CountQueuedImageStudioTasks reports the queue depth for a kind.
func CountQueuedImageStudioTasks(kind string) (int64, error) {
	var count int64
	err := DB.Model(&ImageStudioTask{}).
		Where("kind = ? AND status = ?", kind, ImageStudioStatusQueued).
		Count(&count).Error
	return count, err
}

// ImageStudioQueuePosition returns 1-based position among queued tasks of the
// same kind. Ordering matches the claim query: created_at, then id.
func ImageStudioQueuePosition(task *ImageStudioTask) (int64, error) {
	if task.Status != ImageStudioStatusQueued {
		return 0, nil
	}
	var ahead int64
	err := DB.Model(&ImageStudioTask{}).
		Where("kind = ? AND status = ?", task.Kind, ImageStudioStatusQueued).
		Where("created_at < ? OR (created_at = ? AND id < ?)", task.CreatedAt, task.CreatedAt, task.Id).
		Count(&ahead).Error
	if err != nil {
		return 0, err
	}
	return ahead + 1, nil
}

// ClaimNextQueuedImageStudioTask atomically promotes the oldest queued task to
// running.
//
// The conditional UPDATE doubles as the mutex: every dispatcher loop in every
// process may race here, but only the winner sees RowsAffected == 1. This is
// portable across SQLite, MySQL and PostgreSQL without SELECT ... FOR UPDATE on
// a scan that would lock the whole queue.
func ClaimNextQueuedImageStudioTask(kind string, now int64) (*ImageStudioTask, bool, error) {
	const maxAttempts = 5
	for range maxAttempts {
		var task ImageStudioTask
		err := DB.Where("kind = ? AND status = ?", kind, ImageStudioStatusQueued).
			Order("created_at ASC, id ASC").
			First(&task).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, nil
		}
		if err != nil {
			return nil, false, err
		}

		result := DB.Model(&ImageStudioTask{}).
			Where("id = ? AND status = ?", task.Id, ImageStudioStatusQueued).
			Updates(map[string]any{
				"status":     ImageStudioStatusRunning,
				"started_at": now,
				"updated_at": now,
			})
		if result.Error != nil {
			return nil, false, result.Error
		}
		if result.RowsAffected == 1 {
			task.Status = ImageStudioStatusRunning
			task.StartedAt = now
			task.UpdatedAt = now
			return &task, true, nil
		}
		// Another dispatcher won this row; try the next one.
	}
	return nil, false, nil
}

// ExpireStaleQueuedImageStudioTasks fails queued tasks that waited past the
// configured ceiling, so a full queue cannot strand submissions forever.
func ExpireStaleQueuedImageStudioTasks(kind string, createdBefore int64, now int64, reason string) (int, error) {
	result := DB.Model(&ImageStudioTask{}).
		Where("kind = ? AND status = ? AND created_at <= ?", kind, ImageStudioStatusQueued, createdBefore).
		Updates(map[string]any{
			"status":      ImageStudioStatusExpired,
			"error":       reason,
			"finished_at": now,
			"updated_at":  now,
		})
	if result.Error != nil {
		return 0, result.Error
	}
	return int(result.RowsAffected), nil
}

// FailInterruptedImageStudioTasks closes running tasks left behind by a crash
// or restart. They are reported as failed so the operator can refund.
func FailInterruptedImageStudioTasks(staleBefore int64, now int64, reason string) ([]*ImageStudioTask, error) {
	var stale []*ImageStudioTask
	err := DB.Where("status = ? AND started_at > 0 AND started_at <= ?", ImageStudioStatusRunning, staleBefore).
		Limit(200).
		Find(&stale).Error
	if err != nil || len(stale) == 0 {
		return nil, err
	}
	for _, task := range stale {
		_ = UpdateImageStudioTaskFields(task.Id, map[string]any{
			"status":      ImageStudioStatusFailed,
			"error":       reason,
			"finished_at": now,
		})
	}
	return stale, nil
}

// ListExpiredImageStudioTasks returns tasks past their retention window so the
// cleaner can delete both the rows and their files.
func ListExpiredImageStudioTasks(now int64, limit int) ([]*ImageStudioTask, error) {
	var tasks []*ImageStudioTask
	err := DB.Where("expires_at > 0 AND expires_at <= ?", now).
		Limit(clampPageSize(limit)).
		Find(&tasks).Error
	if err != nil {
		return nil, err
	}
	return tasks, nil
}

// PurgeImageStudioTasks deletes already-collected expired rows in bulk.
func PurgeImageStudioTasks(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	return DB.Where("id IN ?", ids).Delete(&ImageStudioTask{}).Error
}

// CountUserImageStudioTasks powers the "共 N 次" counter on the history header.
func CountUserImageStudioTasks(userId int, kind string) (int64, error) {
	query := DB.Model(&ImageStudioTask{}).Where("user_id = ?", userId)
	if kind != "" {
		query = query.Where("kind = ?", kind)
	}
	var count int64
	err := query.Count(&count).Error
	return count, err
}

// ListUserImageStudioTaskModels returns the distinct models a user has used,
// feeding the model filter dropdown without a second round trip per render.
func ListUserImageStudioTaskModels(userId int, kind string) ([]string, error) {
	query := DB.Model(&ImageStudioTask{}).Select("DISTINCT model")
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	if kind != "" {
		query = query.Where("kind = ?", kind)
	}
	var models []string
	err := query.Order("model ASC").Pluck("model", &models).Error
	return models, err
}

// ImageStudioTaskRetentionCutoff converts the configured retention window into
// an absolute expiry timestamp.
func ImageStudioTaskRetentionCutoff(now int64, retentionDays int) int64 {
	if retentionDays <= 0 {
		retentionDays = 7
	}
	return now + int64(retentionDays)*24*60*60
}
