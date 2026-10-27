package controller

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// openSourcePromotionFetchHandler runs the scheduled GitHub author harvest.
// Interval is one minute: the scheduler asks Enabled() every cycle and only
// creates a row once the configured HH:MM has passed for the day, which keeps
// the "run at a fixed local time" behaviour without a cron library.
type openSourcePromotionFetchHandler struct{}

func (openSourcePromotionFetchHandler) Type() string {
	return model.SystemTaskTypeOpenSourcePromotionFetch
}

func (openSourcePromotionFetchHandler) Enabled() bool {
	settings := operation_setting.GetOpenSourcePromotionSettings()
	if !settings.Enabled {
		return false
	}
	return dailyTaskDue(model.SystemTaskTypeOpenSourcePromotionFetch, settings.FetchTime, "03:00")
}

func (openSourcePromotionFetchHandler) Interval() time.Duration { return time.Minute }

func (openSourcePromotionFetchHandler) NewPayload() any { return promotionFetchPayload{} }

type promotionFetchPayload struct {
	// MaxRepos overrides max_repos_per_run for one manual run.
	MaxRepos int `json:"max_repos,omitempty"`
	// Manual lets the run proceed while the scheduled switch is off, because an
	// administrator explicitly asked for it.
	Manual bool `json:"manual,omitempty"`
}

func (openSourcePromotionFetchHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	payload := promotionFetchPayload{}
	if err := task.DecodePayload(&payload); err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}

	state := service.PromotionFetchState{}
	if previous, err := model.GetPreviousSystemTask(task.Type, task.ID); err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	} else if previous != nil {
		// Only the cursor is resumed; the per-run counters start from zero so the
		// progress bar belongs to this run.
		if err := previous.DecodeState(&state); err != nil {
			logger.LogWarn(ctx, common.LogText("open source promotion: previous cursor unreadable, starting over: %v", err))
			state = service.PromotionFetchState{}
		}
	}

	saveState := func(next service.PromotionFetchState) error {
		return model.UpdateSystemTaskState(task.TaskID, runnerID, next)
	}
	summary, err := service.RunOpenSourcePromotionFetch(ctx, &state, saveState, payload.MaxRepos, payload.Manual)
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, summary, err)
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}

// openSourcePromotionEmailHandler sends the invitation emails.
type openSourcePromotionEmailHandler struct{}

func (openSourcePromotionEmailHandler) Type() string {
	return model.SystemTaskTypeOpenSourcePromotionEmail
}

func (openSourcePromotionEmailHandler) Enabled() bool {
	settings := operation_setting.GetOpenSourcePromotionSettings()
	if !settings.Enabled || !settings.AutoSendEnabled {
		return false
	}
	if !common.EmailDeliveryConfigured() {
		return false
	}
	if !model.HasSendablePromotionRecipients() {
		return false
	}
	return dailyTaskDue(model.SystemTaskTypeOpenSourcePromotionEmail, settings.SendTime, "10:00")
}

func (openSourcePromotionEmailHandler) Interval() time.Duration { return time.Minute }

func (openSourcePromotionEmailHandler) NewPayload() any { return promotionEmailPayload{} }

type promotionEmailPayload struct {
	// IDs restricts a manual run to the selected rows; it also lifts the daily
	// quota, because an administrator explicitly asked for these addresses.
	IDs []int `json:"ids,omitempty"`
	// Manual marks an administrator-triggered "send all pending" run. It
	// bypasses the automatic-sending switch but keeps the daily quota.
	Manual bool `json:"manual,omitempty"`
}

func (openSourcePromotionEmailHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	payload := promotionEmailPayload{}
	if err := task.DecodePayload(&payload); err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	summary, err := service.RunOpenSourcePromotionEmailTask(ctx, payload.IDs, payload.Manual)
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, summary, err)
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}

// dailyTaskDue reports whether the fixed daily slot has arrived and no task of
// this type has completed since then. It relies on SystemTask.UpdatedAt, which
// FinishSystemTask always refreshes, so a failed run also counts as "done for
// today" and is not retried every minute.
func dailyTaskDue(taskType, value, fallback string) bool {
	now := time.Now()
	slot := operation_setting.OpenSourcePromotionClockSlot(now, value, fallback)
	if now.Before(slot) {
		return false
	}
	latest, err := model.GetLatestSystemTask(taskType)
	if err != nil {
		logger.LogWarn(context.Background(), common.LogText("open source promotion: cannot read the latest %s task: %v", taskType, err))
		return false
	}
	if latest == nil {
		return true
	}
	return latest.UpdatedAt < slot.Unix()
}
