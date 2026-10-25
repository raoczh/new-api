package controller

import (
	"errors"
	"net/http"
	"slices"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type iqMonitorModel struct {
	Model   string                `json:"model"`
	Latest  *model.IQProbeResult  `json:"latest"`
	History []model.IQProbeResult `json:"history"`
}

type iqMonitorGroup struct {
	Group       string           `json:"group"`
	Description string           `json:"description"`
	Models      []iqMonitorModel `json:"models"`
}

type iqMonitorOverview struct {
	AutoEnabled     bool             `json:"auto_enabled"`
	IntervalMinutes float64          `json:"interval_minutes"`
	Running         bool             `json:"running"`
	CanRun          bool             `json:"can_run"`
	CanDelete       bool             `json:"can_delete"`
	Groups          []iqMonitorGroup `json:"groups"`
}

// iqMonitorVisibleGroups returns the configured IQ groups the viewer may see:
// administrators see every pool, other viewers only their usable groups.
func iqMonitorVisibleGroups(c *gin.Context) (map[string]string, error) {
	pools := iqProbePools()
	visible := make(map[string]string, len(pools))
	if c.GetInt("role") >= common.RoleAdminUser {
		usable := service.GetUserUsableGroups("")
		for group := range pools {
			visible[group] = usable[group]
		}
		return visible, nil
	}
	userGroup := ""
	if userID := c.GetInt("id"); userID > 0 {
		user, err := model.GetUserCache(userID)
		if err != nil {
			return nil, err
		}
		userGroup = user.Group
	}
	for group, desc := range service.GetUserUsableGroups(userGroup) {
		if _, ok := pools[group]; ok {
			visible[group] = desc
		}
	}
	return visible, nil
}

func GetIQMonitorOverview(c *gin.Context) {
	visible, err := iqMonitorVisibleGroups(c)
	if err != nil {
		common.ApiErrorStatus(c, http.StatusInternalServerError, errors.New("failed to load user groups"))
		return
	}
	groupNames := make([]string, 0, len(visible))
	for group := range visible {
		groupNames = append(groupNames, group)
	}
	slices.Sort(groupNames)
	results, err := model.GetIQProbeHistories(groupNames)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pools := iqProbePools()
	byKey := map[string][]model.IQProbeResult{}
	for _, result := range results {
		key := result.GroupName + "\x00" + result.ModelName
		if len(byKey[key]) < model.IQProbeHistoryLimit {
			byKey[key] = append(byKey[key], result)
		}
	}
	policy := model.CurrentRequestPolicy()
	overview := iqMonitorOverview{
		AutoEnabled:     policy.IQProbeEnabled,
		IntervalMinutes: policy.IQProbeMinutes,
		CanRun:          c.GetInt("role") >= common.RoleAdminUser,
		CanDelete:       c.GetInt("role") >= common.RoleRootUser,
		Groups:          make([]iqMonitorGroup, 0, len(groupNames)),
	}
	if active, err := model.GetActiveSystemTask(model.SystemTaskTypeIQProbe); err == nil && active != nil {
		overview.Running = true
	}
	for _, group := range groupNames {
		item := iqMonitorGroup{Group: group, Description: visible[group], Models: []iqMonitorModel{}}
		for _, spec := range pools[group] {
			history := byKey[group+"\x00"+spec.Name]
			entry := iqMonitorModel{Model: spec.Name, History: []model.IQProbeResult{}}
			if len(history) > 0 {
				entry.Latest = &history[0]
				entry.History = history
			}
			item.Models = append(item.Models, entry)
		}
		overview.Groups = append(overview.Groups, item)
	}
	common.ApiSuccess(c, overview)
}

func GetIQMonitorResult(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid parameters"))
		return
	}
	visible, err := iqMonitorVisibleGroups(c)
	if err != nil {
		common.ApiErrorStatus(c, http.StatusInternalServerError, errors.New("failed to load user groups"))
		return
	}
	result, err := model.GetIQProbeResult(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("IQ probe result not found"))
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if _, ok := visible[result.GroupName]; !ok {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("IQ probe result not found"))
		return
	}
	common.ApiSuccess(c, result)
}

// DeleteIQMonitorResult removes one stored probe result. Only the root account
// may call it; the route enforces that before the handler runs.
func DeleteIQMonitorResult(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid parameters"))
		return
	}
	result, err := model.GetIQProbeResultSummary(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("IQ probe result not found"))
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	deleted, err := model.DeleteIQProbeResult(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !deleted {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("IQ probe result not found"))
		return
	}
	recordManageAudit(c, "iq_monitor.delete", map[string]any{
		"id":           id,
		"group":        result.GroupName,
		"model":        result.ModelName,
		"prompt_title": result.PromptTitle,
	})
	common.ApiSuccess(c, gin.H{"id": id})
}

type iqMonitorRunRequest struct {
	Group string `json:"group"`
	Model string `json:"model"`
}

// RunIQMonitorProbe enqueues an on-demand IQ probe. Without a group it probes
// one rotated model in every configured group.
func RunIQMonitorProbe(c *gin.Context) {
	request := iqMonitorRunRequest{}
	if c.Request.ContentLength != 0 {
		if err := common.DecodeJson(c.Request.Body, &request); err != nil {
			common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid parameters"))
			return
		}
	}
	pools := iqProbePools()
	if len(pools) == 0 {
		common.ApiErrorT(c, "No group has joined IQ monitoring")
		return
	}
	if request.Group != "" {
		specs, ok := pools[request.Group]
		if !ok {
			common.ApiErrorT(c, "This group has not joined IQ monitoring")
			return
		}
		if request.Model != "" && !slices.ContainsFunc(specs, func(spec operation_setting.IQModelSpec) bool { return spec.Name == request.Model }) {
			common.ApiErrorT(c, "This model is not in the IQ monitoring pool of the group")
			return
		}
	} else if request.Model != "" {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid parameters"))
		return
	}
	task, created, err := service.EnqueueSystemTask(model.SystemTaskTypeIQProbe, iqProbeTaskPayload{Manual: true, Group: request.Group, Model: request.Model})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "iq_monitor.run", map[string]any{"group": request.Group, "model": request.Model})
	common.ApiSuccess(c, gin.H{"task_id": task.TaskID, "created": created})
}
