package service

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"html"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// The interactive workbenches submit work as rows in image_studio_tasks and a
// dispatcher promotes them to running once a global per-kind slot is free.
//
// The dispatcher never holds a task in memory between ticks: the database is
// the only queue. That makes restart recovery trivial (queued rows keep their
// place, running rows are failed as interrupted) and lets several gateway
// instances share one queue without a locking service.

const (
	imageStudioDispatchInterval = time.Second
	imageStudioRetentionSweep   = time.Hour
	imageStudioRunTimeout       = 15 * time.Minute
	imageStudioStaleRunGrace    = 30 * time.Minute
)

// ImageStudioRunInput is everything a runner needs to call upstream.
type ImageStudioRunInput struct {
	TaskId        string
	UserId        int
	Kind          string
	Model         string
	Group         string
	Prompt        string
	Params        string
	ReferenceKeys []string
	MaskKey       string
}

// ImageStudioRunOutput carries the raw upstream response body.
type ImageStudioRunOutput struct {
	StatusCode int
	Body       []byte
	ChannelId  int
	RequestId  string
}

// ImageStudioRunner executes one submission. It is injected by the controller
// package because the relay pipeline lives there; service must not import it.
type ImageStudioRunner func(ctx context.Context, input ImageStudioRunInput) (*ImageStudioRunOutput, error)

var (
	imageStudioRunnerMu sync.RWMutex
	imageStudioRunner   ImageStudioRunner

	imageStudioQueueOnce sync.Once

	imageStudioEmailMu       sync.Mutex
	imageStudioEmailLastSent = map[int]time.Time{}
)

// SetImageStudioRunner wires the relay-backed executor. Called once from
// controller.init.
func SetImageStudioRunner(runner ImageStudioRunner) {
	imageStudioRunnerMu.Lock()
	defer imageStudioRunnerMu.Unlock()
	imageStudioRunner = runner
}

func getImageStudioRunner() ImageStudioRunner {
	imageStudioRunnerMu.RLock()
	defer imageStudioRunnerMu.RUnlock()
	return imageStudioRunner
}

// StartImageStudioQueue launches the dispatcher and the retention sweeper.
func StartImageStudioQueue() {
	imageStudioQueueOnce.Do(func() {
		recoverInterruptedImageStudioTasks()
		go imageStudioDispatchLoop()
		go imageStudioRetentionLoop()
	})
}

// recoverInterruptedImageStudioTasks closes rows left running by a crash so
// they do not permanently occupy a concurrency slot.
func recoverInterruptedImageStudioTasks() {
	now := common.GetTimestamp()
	staleBefore := now - int64(imageStudioStaleRunGrace.Seconds())
	tasks, err := model.FailInterruptedImageStudioTasks(staleBefore, now, "任务因服务重启而中断，已自动关闭，本次未扣除额度")
	if err != nil {
		common.SysError(common.LogText("failed to recover interrupted image studio tasks: %s", err.Error()))
		return
	}
	for _, task := range tasks {
		common.SysLog(common.LogText("closed interrupted image studio task %s", task.Id))
	}
}

func imageStudioDispatchLoop() {
	ticker := time.NewTicker(imageStudioDispatchInterval)
	defer ticker.Stop()
	expireTicker := time.NewTicker(30 * time.Second)
	defer expireTicker.Stop()

	for {
		select {
		case <-ticker.C:
			dispatchImageStudioKind(string(model.ImageStudioKindImage))
			dispatchImageStudioKind(string(model.ImageStudioKindVideo))
		case <-expireTicker.C:
			expireStaleImageStudioSubmissions()
		}
	}
}

func expireStaleImageStudioSubmissions() {
	settings := system_setting.GetImageStudioSettings()
	if settings.QueueMaxWaitMinutes <= 0 {
		return
	}
	now := common.GetTimestamp()
	cutoff := now - int64(settings.QueueMaxWaitMinutes)*60
	for _, kind := range []string{string(model.ImageStudioKindImage), string(model.ImageStudioKindVideo)} {
		expired, err := model.ExpireStaleQueuedImageStudioTasks(
			kind,
			cutoff,
			now,
			fmt.Sprintf("排队超过 %d 分钟仍未轮到处理，任务已自动取消，本次未扣除额度", settings.QueueMaxWaitMinutes),
		)
		if err != nil {
			common.SysError(common.LogText("failed to expire queued image studio tasks: %s", err.Error()))
			continue
		}
		if expired > 0 {
			common.SysLog(common.LogText("expired %d queued image studio %s tasks", expired, kind))
		}
	}
}

// dispatchImageStudioKind fills every free slot for one kind.
//
// The running count is re-read after each claim because another instance (or
// the goroutine we just spawned) may have taken a slot in the meantime.
func dispatchImageStudioKind(kind string) {
	settings := system_setting.GetImageStudioSettings()
	if !settings.Enabled {
		return
	}
	runner := getImageStudioRunner()
	if runner == nil {
		return
	}

	limit := settings.ImageConcurrency
	if kind == string(model.ImageStudioKindVideo) {
		limit = settings.VideoConcurrency
	}
	if limit <= 0 {
		return
	}

	for {
		running, err := model.CountRunningImageStudioTasks(kind)
		if err != nil {
			common.SysError(common.LogText("failed to count running image studio tasks: %s", err.Error()))
			return
		}
		if running >= int64(limit) {
			return
		}

		task, claimed, err := model.ClaimNextQueuedImageStudioTask(kind, common.GetTimestamp())
		if err != nil {
			common.SysError(common.LogText("failed to claim image studio task: %s", err.Error()))
			return
		}
		if !claimed || task == nil {
			return
		}

		common.SysLog(common.LogText("image studio task %s claimed", task.Id))
		go runImageStudioTask(task, runner)
	}
}

func runImageStudioTask(task *model.ImageStudioTask, runner ImageStudioRunner) {
	startedAt := time.Now()
	defer func() {
		if recovered := recover(); recovered != nil {
			errText := fmt.Sprintf("任务执行异常：%v", recovered)
			common.SysError(common.LogText("image studio task %s panicked: %v", task.Id, recovered))
			finalizeImageStudioTaskFailure(task, errText)
		}
	}()

	referenceKeys, maskKey := decodeImageStudioKeys(task)

	ctx, cancel := context.WithTimeout(context.Background(), imageStudioRunTimeout)
	defer cancel()

	output, err := runner(ctx, ImageStudioRunInput{
		TaskId:        task.Id,
		UserId:        task.UserId,
		Kind:          task.Kind,
		Model:         task.Model,
		Group:         task.Group,
		Prompt:        task.Prompt,
		Params:        task.Params,
		ReferenceKeys: referenceKeys,
		MaskKey:       maskKey,
	})
	if err != nil {
		finalizeImageStudioTaskFailure(task, friendlyImageStudioError(err))
		return
	}

	resultKeys, total, err := persistImageStudioResults(output.Body)
	if err != nil {
		finalizeImageStudioTaskFailure(task, friendlyImageStudioError(err))
		return
	}

	now := common.GetTimestamp()
	quota := imageStudioConsumedQuota(output.RequestId)
	elapsed := time.Since(startedAt).Milliseconds()
	resultJSON, _ := common.Marshal(resultKeys)
	if err := model.UpdateImageStudioTaskFields(task.Id, map[string]any{
		"status":      model.ImageStudioStatusSucceeded,
		"result_keys": string(resultJSON),
		"quota":       quota,
		"channel_id":  output.ChannelId,
		"request_id":  output.RequestId,
		"elapsed_ms":  elapsed,
		"finished_at": now,
		"error":       "",
	}); err != nil {
		common.SysError(common.LogText("failed to finalize image studio task %s: %s", task.Id, err.Error()))
	}

	common.SysLog(common.LogText(
		"image studio task %s succeeded: %d image(s), %dms", task.Id, total, elapsed,
	))
	notifyImageStudioTaskFinished(task.UserId, task.Id, task.Prompt, len(resultKeys), nil)
}

func finalizeImageStudioTaskFailure(task *model.ImageStudioTask, message string) {
	now := common.GetTimestamp()
	elapsed := now - task.StartedAt
	if task.StartedAt == 0 {
		elapsed = 0
	}
	if err := model.UpdateImageStudioTaskFields(task.Id, map[string]any{
		"status":      model.ImageStudioStatusFailed,
		"error":       message,
		"elapsed_ms":  elapsed * 1000,
		"finished_at": now,
	}); err != nil {
		common.SysError(common.LogText("failed to record image studio failure for %s: %s", task.Id, err.Error()))
	}
	common.SysError(common.LogText("image studio task %s failed: %s", task.Id, message))
	notifyImageStudioTaskFinished(task.UserId, task.Id, task.Prompt, 0, errors.New(message))
}

// persistImageStudioResults decodes the upstream payload and stores every
// image locally.
//
// Both b64_json and url payloads are supported: remote URLs are downloaded
// immediately because upstream links expire and users must not depend on the
// provider staying reachable for the whole retention window.
func persistImageStudioResults(body []byte) ([]string, int, error) {
	if len(body) == 0 {
		return nil, 0, errors.New("上游没有返回任何内容")
	}
	var response dto.ImageResponse
	if err := common.Unmarshal(body, &response); err != nil {
		return nil, 0, fmt.Errorf("无法解析上游返回的数据：%w", err)
	}
	if len(response.Data) == 0 {
		return nil, 0, errors.New("上游未返回图片，请稍后重试或更换模型")
	}

	keys := make([]string, 0, len(response.Data))
	for _, item := range response.Data {
		var data []byte
		switch {
		case strings.TrimSpace(item.B64Json) != "":
			_, _, cleanBase64, err := DecodeBase64ImageData(item.B64Json)
			if err != nil {
				return keys, len(keys), fmt.Errorf("图片数据解码失败：%w", err)
			}
			decoded, err := base64.StdEncoding.DecodeString(cleanBase64)
			if err != nil {
				return keys, len(keys), fmt.Errorf("图片数据解码失败：%w", err)
			}
			data = decoded
		case strings.TrimSpace(item.Url) != "":
			_, encoded, err := GetImageFromUrl(item.Url)
			if err != nil {
				return keys, len(keys), fmt.Errorf("图片下载失败：%w", err)
			}
			decoded, err := base64.StdEncoding.DecodeString(encoded)
			if err != nil {
				return keys, len(keys), fmt.Errorf("图片下载后解码失败：%w", err)
			}
			data = decoded
		default:
			continue
		}
		key, err := SaveImageStudioBytes(data)
		if err != nil {
			return keys, len(keys), fmt.Errorf("图片保存失败：%w", err)
		}
		keys = append(keys, key)
	}
	if len(keys) == 0 {
		return nil, 0, errors.New("上游返回的图片格式无法识别")
	}
	return keys, len(keys), nil
}

func decodeImageStudioKeys(task *model.ImageStudioTask) ([]string, string) {
	var references []string
	if task.ReferenceKeys != "" {
		_ = common.Unmarshal([]byte(task.ReferenceKeys), &references)
	}
	return references, task.MaskKey
}

// imageStudioConsumedQuota reads back the settled charge from the consume log
// written by the relay pipeline. Best effort: a zero here only affects the
// quota shown on the record, never the actual billing.
func imageStudioConsumedQuota(requestId string) int {
	if requestId == "" || model.LOG_DB == nil {
		return 0
	}
	var entry model.Log
	err := model.LOG_DB.
		Where("request_id = ? AND type = ?", requestId, model.LogTypeConsume).
		Order("id DESC").
		Limit(1).
		Find(&entry).Error
	if err != nil || entry.Id == 0 {
		return 0
	}
	return entry.Quota
}

// friendlyImageStudioError turns upstream relay failures into text a user can
// act on. Relay errors already carry upstream messages, so the common cases
// are matched by substring and everything else is passed through.
func friendlyImageStudioError(err error) string {
	message := strings.TrimSpace(err.Error())
	if message == "" {
		return "生成失败，请稍后重试"
	}
	lower := strings.ToLower(message)
	switch {
	case strings.Contains(lower, "no available channel"):
		return "当前分组下没有可用的图像通道，请更换模型或稍后再试（本次未扣除额度）"
	case strings.Contains(lower, "insufficient") || strings.Contains(lower, "quota"):
		return "额度不足，请充值后重试（本次未扣除额度）"
	case strings.Contains(lower, "timeout") || strings.Contains(lower, "deadline"):
		return "生成超时，上游长时间没有响应，请稍后重试（本次未扣除额度）"
	case strings.Contains(lower, "sensitive"):
		return "提示词触发了内容安全策略，请调整描述后重试"
	case strings.Contains(lower, "context canceled"):
		return "任务已被取消"
	default:
		return "生成失败：" + message
	}
}

// notifyImageStudioTaskFinished emails the bound account when the user opted
// in. Failures are swallowed: a broken mail server must not fail a task.
func notifyImageStudioTaskFinished(userId int, taskId string, prompt string, imageCount int, taskErr error) {
	settings := system_setting.GetImageStudioSettings()
	if !settings.Enabled {
		return
	}
	user, err := model.GetUserCache(userId)
	if err != nil || user == nil {
		return
	}
	userSetting := user.GetSetting()
	if !userSetting.ImageTaskEmailNotify {
		return
	}
	email := strings.TrimSpace(user.Email)
	if email == "" {
		return
	}
	if !imageStudioEmailAllowed(userId) {
		return
	}

	subject := "AI 绘图任务已完成"
	summary := fmt.Sprintf("共生成 %d 张图片。", imageCount)
	if taskErr != nil {
		subject = "AI 绘图任务失败"
		summary = "任务未能完成：" + taskErr.Error()
	}
	snippet := prompt
	if len([]rune(snippet)) > 80 {
		snippet = string([]rune(snippet)[:80]) + "…"
	}
	content := fmt.Sprintf(
		"<p>你好 %s，</p><p>%s</p><p>提示词：%s</p><p>任务编号：%s</p><p>请登录后前往「AI 绘图」页面查看详情。</p>",
		html.EscapeString(user.Username), html.EscapeString(summary), html.EscapeString(snippet), taskId,
	)
	if err := common.SendEmail(subject, email, content); err != nil {
		common.SysError(common.LogText("failed to send image studio notification to user %d: %s", userId, err.Error()))
	}
}

// imageStudioEmailAllowed throttles notifications to at most one per user per
// minute, so a batch of quick generations does not spam the inbox.
func imageStudioEmailAllowed(userId int) bool {
	imageStudioEmailMu.Lock()
	defer imageStudioEmailMu.Unlock()
	now := time.Now()
	if last, ok := imageStudioEmailLastSent[userId]; ok && now.Sub(last) < time.Minute {
		return false
	}
	// Opportunistic pruning keeps the map from growing without bound.
	if len(imageStudioEmailLastSent) > 4096 {
		for id, sentAt := range imageStudioEmailLastSent {
			if now.Sub(sentAt) > time.Hour {
				delete(imageStudioEmailLastSent, id)
			}
		}
	}
	imageStudioEmailLastSent[userId] = now
	return true
}

func imageStudioRetentionLoop() {
	ticker := time.NewTicker(imageStudioRetentionSweep)
	defer ticker.Stop()
	// Run once shortly after boot so a freshly restarted node catches up.
	time.AfterFunc(30*time.Second, imageStudioRetentionSweepOnce)
	for range ticker.C {
		imageStudioRetentionSweepOnce()
	}
}

func imageStudioRetentionSweepOnce() {
	settings := system_setting.GetImageStudioSettings()
	now := common.GetTimestamp()
	var deleted int

	for range 50 {
		tasks, err := model.ListExpiredImageStudioTasks(now, 200)
		if err != nil {
			common.SysError(common.LogText("failed to list expired image studio tasks: %s", err.Error()))
			return
		}
		if len(tasks) == 0 {
			break
		}

		ids := make([]string, 0, len(tasks))
		for _, task := range tasks {
			keys := make([]string, 0, 8)
			references, maskKey := decodeImageStudioKeys(task)
			keys = append(keys, references...)
			if maskKey != "" {
				keys = append(keys, maskKey)
			}
			var results []string
			if task.ResultKeys != "" {
				_ = common.Unmarshal([]byte(task.ResultKeys), &results)
			}
			keys = append(keys, results...)
			DeleteImageStudioFiles(keys)
			ids = append(ids, task.Id)
		}
		if err := model.PurgeImageStudioTasks(ids); err != nil {
			common.SysError(common.LogText("failed to purge expired image studio tasks: %s", err.Error()))
			return
		}
		deleted += len(ids)
		if len(tasks) < 200 {
			break
		}
	}

	// Sweep orphaned files too: rows may have been removed by hand, and a
	// failed upload never gets a row at all.
	removed, err := CleanupImageStudioStorage(time.Now(), settings.RetentionDays)
	if err != nil {
		common.SysError(common.LogText("failed to clean image studio storage: %s", err.Error()))
	}
	if deleted > 0 || removed > 0 {
		common.SysLog(common.LogText(
			"image studio retention sweep removed %d task(s) and %d file(s)", deleted, removed,
		))
	}
}
