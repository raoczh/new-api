package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

// The interactive image workbench never asks for an API key. Submissions become
// rows in image_studio_tasks, and the queue worker replays each one through the
// ordinary relay pipeline with a synthetic token, so billing, consume logging,
// channel retries and upstream error handling stay identical to /v1 traffic.

const (
	imageStudioEditPath       = "/v1/images/edits"
	imageStudioGenerationPath = "/v1/images/generations"
	// imageStudioMaxActivePerUser keeps one account from filling the global
	// queue and starving everyone else.
	imageStudioMaxActivePerUser = 12
)

func init() {
	service.SetImageStudioRunner(runImageStudioRelay)
}

// imageStudioSubmitRequest is the payload accepted by POST /tasks.
type imageStudioSubmitRequest struct {
	Model         string          `json:"model"`
	Group         string          `json:"group"`
	Prompt        string          `json:"prompt"`
	Params        json.RawMessage `json:"params"`
	ReferenceKeys []string        `json:"reference_keys"`
	MaskKey       string          `json:"mask_key"`
}

// imageStudioBatchRequest covers the history grid's bulk actions.
type imageStudioBatchRequest struct {
	Action string   `json:"action"`
	Ids    []string `json:"ids"`
}

func imageStudioSettingsGuard(c *gin.Context) bool {
	if !system_setting.GetImageStudioSettings().Enabled {
		common.ApiErrorMsg(c, "AI 绘图功能当前未开放，请联系管理员")
		return false
	}
	return true
}

// CreateImageStudioTask queues one generation.
func CreateImageStudioTask(c *gin.Context) {
	if !imageStudioSettingsGuard(c) {
		return
	}
	userId := c.GetInt("id")
	settings := system_setting.GetImageStudioSettings()

	var req imageStudioSubmitRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "提交内容格式不正确，请刷新页面后重试")
		return
	}

	req.Model = strings.TrimSpace(req.Model)
	req.Prompt = strings.TrimSpace(req.Prompt)
	req.Group = strings.TrimSpace(req.Group)
	req.MaskKey = strings.TrimSpace(req.MaskKey)

	if req.Model == "" {
		common.ApiErrorMsg(c, "请先选择要使用的模型")
		return
	}
	if req.Prompt == "" {
		common.ApiErrorMsg(c, "请输入提示词，描述你想生成的画面")
		return
	}
	if len([]rune(req.Prompt)) > 8000 {
		common.ApiErrorMsg(c, "提示词过长，请精简到 8000 字以内")
		return
	}

	userCache, err := model.GetUserCache(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Group == "" {
		req.Group = userCache.Group
	}
	if !service.GroupInUserUsableGroups(userCache.Group, req.Group) {
		common.ApiErrorMsg(c, "当前账号无权使用该分组，请重新选择")
		return
	}

	// Bound the reference set before touching disk so a hostile body cannot make
	// us open thousands of files.
	if len(req.ReferenceKeys) > settings.MaxReferenceImages {
		common.ApiErrorMsg(c, fmt.Sprintf("参考图最多 %d 张，请先移除多余的图片", settings.MaxReferenceImages))
		return
	}
	for index, key := range req.ReferenceKeys {
		if err := service.ValidateImageStudioKey(key); err != nil {
			common.ApiErrorMsg(c, fmt.Sprintf("第 %d 张参考图已失效，请重新上传", index+1))
			return
		}
	}
	if req.MaskKey != "" {
		if len(req.ReferenceKeys) == 0 {
			common.ApiErrorMsg(c, "使用蒙版编辑时请至少上传一张参考图")
			return
		}
		if err := service.ValidateImageStudioKey(req.MaskKey); err != nil {
			common.ApiErrorMsg(c, "蒙版文件已失效，请重新绘制")
			return
		}
	}

	params, imageCount, err := normalizeImageStudioParams(req.Params, settings.MaxImagesPerRequest)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	activeCount, err := model.CountActiveUserImageStudioTasks(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if activeCount >= imageStudioMaxActivePerUser {
		common.ApiErrorMsg(c, fmt.Sprintf(
			"你还有 %d 个任务正在排队或生成中，请等待它们完成后再提交",
			activeCount,
		))
		return
	}

	referenceJSON, _ := common.Marshal(req.ReferenceKeys)
	now := common.GetTimestamp()
	task := &model.ImageStudioTask{
		Id:            model.GenerateImageStudioTaskID(),
		UserId:        userId,
		Kind:          string(model.ImageStudioKindImage),
		Status:        model.ImageStudioStatusQueued,
		Model:         req.Model,
		Group:         req.Group,
		Prompt:        req.Prompt,
		Params:        string(params),
		ReferenceKeys: string(referenceJSON),
		MaskKey:       req.MaskKey,
		ExpiresAt:     model.ImageStudioTaskRetentionCutoff(now, settings.RetentionDays),
	}
	if err := model.CreateImageStudioTask(task); err != nil {
		common.ApiError(c, err)
		return
	}

	position, _ := model.ImageStudioQueuePosition(task)
	common.ApiSuccess(c, gin.H{
		"task":           imageStudioTaskView(task),
		"image_count":    imageCount,
		"queue_position": position,
		"queue_depth":    imageStudioQueueDepth(string(model.ImageStudioKindImage)),
		"concurrency":    settings.ImageConcurrency,
		"retention_days": settings.RetentionDays,
	})
}

// normalizeImageStudioParams validates the provider parameter object and
// returns the canonical JSON snapshot plus the requested image count.
func normalizeImageStudioParams(raw json.RawMessage, maxImages int) ([]byte, int, error) {
	params := map[string]any{}
	if trimmed := bytes.TrimSpace(raw); len(trimmed) > 0 && string(trimmed) != "null" {
		if err := common.Unmarshal(trimmed, &params); err != nil {
			return nil, 0, errors.New("生成参数格式不正确，请刷新页面后重试")
		}
	}
	if params == nil {
		params = map[string]any{}
	}

	imageCount := 1
	if value, ok := params["n"]; ok {
		parsed, err := normalizeImageStudioCount(value)
		if err != nil {
			return nil, 0, err
		}
		imageCount = parsed
	}
	if maxImages <= 0 {
		maxImages = 1
	}
	if imageCount < 1 || imageCount > maxImages {
		return nil, 0, fmt.Errorf("每次最多生成 %d 张图片", maxImages)
	}
	if imageCount > dto.MaxImageN {
		return nil, 0, fmt.Errorf("每次最多生成 %d 张图片", dto.MaxImageN)
	}
	params["n"] = imageCount

	// Drop empty strings so providers do not receive `"size": ""`.
	for key, value := range params {
		if text, ok := value.(string); ok && strings.TrimSpace(text) == "" {
			delete(params, key)
		}
	}

	encoded, err := common.Marshal(params)
	if err != nil {
		return nil, 0, errors.New("生成参数格式不正确，请刷新页面后重试")
	}
	return encoded, imageCount, nil
}

func normalizeImageStudioCount(value any) (int, error) {
	switch typed := value.(type) {
	case float64:
		if typed != float64(int64(typed)) {
			return 0, errors.New("生成数量必须是整数")
		}
		return int(typed), nil
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err != nil {
			return 0, errors.New("生成数量必须是整数")
		}
		return parsed, nil
	case nil:
		return 1, nil
	default:
		return 0, errors.New("生成数量必须是整数")
	}
}

// UploadImageStudioAsset stores a reference image or mask and returns its key.
func UploadImageStudioAsset(c *gin.Context) {
	if !imageStudioSettingsGuard(c) {
		return
	}
	settings := system_setting.GetImageStudioSettings()
	maxBytes := int64(settings.UploadMaxMB) << 20

	fileHeader, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "没有读取到上传的图片，请重新选择文件")
		return
	}
	if fileHeader.Size > maxBytes {
		common.ApiErrorMsg(c, fmt.Sprintf("图片大小不能超过 %d MB", settings.UploadMaxMB))
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		common.ApiErrorMsg(c, "图片读取失败，请重新上传")
		return
	}
	defer file.Close()

	key, err := service.SaveImageStudioReader(file, maxBytes)
	if err != nil {
		if common.IsRequestBodyTooLargeError(err) {
			common.ApiErrorMsg(c, fmt.Sprintf("图片大小不能超过 %d MB", settings.UploadMaxMB))
			return
		}
		if errors.Is(err, service.ErrImageStudioFileInvalid) {
			common.ApiErrorMsg(c, "仅支持 PNG、JPG、WebP、GIF 格式的图片")
			return
		}
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"key": key,
		"url": service.ImageStudioFileURL(key),
	})
}

// ListImageStudioTasks powers the history grid.
func ListImageStudioTasks(c *gin.Context) {
	if !imageStudioSettingsGuard(c) {
		return
	}
	userId := c.GetInt("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "24"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 24
	}

	tasks, total, err := model.ListUserImageStudioTasks(userId, model.ImageStudioTaskFilter{
		Kind:     c.DefaultQuery("kind", string(model.ImageStudioKindImage)),
		Model:    c.Query("model"),
		Status:   c.Query("status"),
		Keyword:  c.Query("keyword"),
		Favorite: c.Query("favorite") == "true",
		Offset:   (page - 1) * pageSize,
		Limit:    pageSize,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	items := make([]gin.H, 0, len(tasks))
	for _, task := range tasks {
		items = append(items, imageStudioTaskView(task))
	}

	models, _ := model.ListUserImageStudioTaskModels(userId, string(model.ImageStudioKindImage))
	common.ApiSuccess(c, gin.H{
		"items":          items,
		"total":          total,
		"page":           page,
		"page_size":      pageSize,
		"models":         models,
		"retention_days": system_setting.GetImageStudioSettings().RetentionDays,
	})
}

// GetImageStudioTask returns one task plus its live queue position.
func GetImageStudioTask(c *gin.Context) {
	if !imageStudioSettingsGuard(c) {
		return
	}
	userId := c.GetInt("id")
	task, err := model.GetUserImageStudioTask(c.Param("id"), userId)
	if err != nil {
		common.ApiErrorMsg(c, "记录不存在或已过期")
		return
	}
	view := imageStudioTaskView(task)
	if task.Status == model.ImageStudioStatusQueued {
		position, _ := model.ImageStudioQueuePosition(task)
		view["queue_position"] = position
	}
	common.ApiSuccess(c, view)
}

// DeleteImageStudioTask removes one record and its files.
func DeleteImageStudioTask(c *gin.Context) {
	if !imageStudioSettingsGuard(c) {
		return
	}
	userId := c.GetInt("id")
	task, err := model.GetUserImageStudioTask(c.Param("id"), userId)
	if err != nil {
		common.ApiErrorMsg(c, "记录不存在或已过期")
		return
	}
	if task.Status == model.ImageStudioStatusRunning {
		common.ApiErrorMsg(c, "任务正在生成中，请等待完成后再删除")
		return
	}

	deleted, err := model.DeleteImageStudioTask(task.Id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if deleted {
		service.DeleteImageStudioFiles(imageStudioTaskFileKeys(task))
	}
	common.ApiSuccess(c, gin.H{"deleted": deleted})
}

// BatchImageStudioTasks applies a bulk action from the history grid.
func BatchImageStudioTasks(c *gin.Context) {
	if !imageStudioSettingsGuard(c) {
		return
	}
	userId := c.GetInt("id")

	var req imageStudioBatchRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "请求格式不正确")
		return
	}
	if len(req.Ids) == 0 {
		common.ApiErrorMsg(c, "请先选择要操作的记录")
		return
	}
	if len(req.Ids) > 200 {
		common.ApiErrorMsg(c, "一次最多操作 200 条记录")
		return
	}

	switch req.Action {
	case "favorite", "unfavorite":
		favorite := req.Action == "favorite"
		updated := 0
		for _, id := range req.Ids {
			if err := model.SetImageStudioTaskFavorite(id, userId, favorite); err == nil {
				updated++
			}
		}
		common.ApiSuccess(c, gin.H{"updated": updated})
	case "delete":
		tasks, err := model.ListUserImageStudioTasksByIds(userId, req.Ids)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		deletable := make([]string, 0, len(tasks))
		for _, task := range tasks {
			if task.Status == model.ImageStudioStatusRunning {
				continue
			}
			deletable = append(deletable, task.Id)
		}
		count, err := model.DeleteImageStudioTasks(userId, deletable)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		for _, task := range tasks {
			if task.Status != model.ImageStudioStatusRunning {
				service.DeleteImageStudioFiles(imageStudioTaskFileKeys(task))
			}
		}
		common.ApiSuccess(c, gin.H{
			"deleted": count,
			"skipped": len(tasks) - len(deletable),
		})
	default:
		common.ApiErrorMsg(c, "不支持的操作")
	}
}

// CancelImageStudioTask cancels a task that has not started yet.
func CancelImageStudioTask(c *gin.Context) {
	if !imageStudioSettingsGuard(c) {
		return
	}
	userId := c.GetInt("id")
	task, err := model.GetUserImageStudioTask(c.Param("id"), userId)
	if err != nil {
		common.ApiErrorMsg(c, "记录不存在或已过期")
		return
	}
	if task.Status != model.ImageStudioStatusQueued {
		common.ApiErrorMsg(c, "任务已经开始处理，无法取消")
		return
	}
	if err := model.UpdateImageStudioTaskFields(task.Id, map[string]any{
		"status":      model.ImageStudioStatusCanceled,
		"error":       "任务已取消",
		"finished_at": common.GetTimestamp(),
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"canceled": true})
}

// GetImageStudioConfig reports the workbench limits so the UI never has to
// guess.
func GetImageStudioConfig(c *gin.Context) {
	settings := system_setting.GetImageStudioSettings()
	common.ApiSuccess(c, gin.H{
		"enabled":                settings.Enabled,
		"image_concurrency":      settings.ImageConcurrency,
		"video_concurrency":      settings.VideoConcurrency,
		"retention_days":         settings.RetentionDays,
		"max_images_per_request": settings.MaxImagesPerRequest,
		"max_reference_images":   settings.MaxReferenceImages,
		"upload_max_mb":          settings.UploadMaxMB,
		"queue_max_wait_minutes": settings.QueueMaxWaitMinutes,
		"image_models":           settings.ImageModels,
		"smtp_configured":        common.SMTPServer != "" || common.SMTPAccount != "",
	})
}

// imageStudioModelOption is one selectable image model under a group.
//
// Ratio and Price are resolved for the calling account so the selector can show
// the same numbers the billing path will use: Ratio is the group multiplier,
// Price is the per-call charge already multiplied by it (only meaningful when
// QuotaType is 1, i.e. per-call billing).
type imageStudioModelOption struct {
	Model       string  `json:"model"`
	Description string  `json:"description,omitempty"`
	QuotaType   int     `json:"quota_type"`
	GroupRatio  float64 `json:"group_ratio"`
	ModelRatio  float64 `json:"model_ratio"`
	Price       float64 `json:"price"`
}

type imageStudioGroupOption struct {
	Group  string                  `json:"group"`
	Desc   string                  `json:"desc"`
	Ratio  float64                 `json:"ratio"`
	Models []imageStudioModelOption `json:"models"`
}

// ListImageStudioModels returns the image models the caller may use, grouped
// the same way the chat playground groups them.
//
// It reads the shared pricing cache instead of calling /api/pricing: that route
// is behind the navigation-module switch and would 403 on sites that hide the
// model marketplace, while this page still needs ratios to render.
func ListImageStudioModels(c *gin.Context) {
	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	settings := system_setting.GetImageStudioSettings()
	pricing := model.GetPricing()
	usableGroups := service.GetUserUsableGroups(userCache.Group)

	groups := make([]imageStudioGroupOption, 0, len(usableGroups))
	for _, group := range setting.OrderedGroupNames(slices.Collect(maps.Keys(usableGroups))) {
		if !service.IsUserSelectableGroup(userCache.Group, group) {
			continue
		}
		groupRatio := service.GetUserGroupRatio(userCache.Group, group)
		models := make([]imageStudioModelOption, 0, 8)
		for _, item := range pricing {
			if !slices.Contains(item.EnableGroup, group) {
				continue
			}
			if !imageStudioIsImageModel(item, settings.ImageModels) {
				continue
			}
			option := imageStudioModelOption{
				Model:       item.ModelName,
				Description: item.Description,
				QuotaType:   item.QuotaType,
				GroupRatio:  groupRatio,
				ModelRatio:  item.ModelRatio,
			}
			if item.QuotaType == 1 {
				option.Price = item.ModelPrice * groupRatio
			}
			models = append(models, option)
		}
		if len(models) == 0 {
			continue
		}
		sort.Slice(models, func(i, j int) bool { return models[i].Model < models[j].Model })
		groups = append(groups, imageStudioGroupOption{
			Group:  group,
			Desc:   usableGroups[group],
			Ratio:  groupRatio,
			Models: models,
		})
	}

	// Prefer the account's own group first so the default selection is the
	// cheapest/common case without extra client-side sorting rules.
	sort.SliceStable(groups, func(i, j int) bool {
		if groups[i].Group == userCache.Group {
			return true
		}
		if groups[j].Group == userCache.Group {
			return false
		}
		return false
	})

	common.ApiSuccess(c, gin.H{"groups": groups})
}

// imageStudioIsImageModel decides whether a priced model belongs on this page.
//
// An explicit admin list always wins: the endpoint metadata is frequently
// missing for image models behind proxies, which is exactly why the list
// exists. Otherwise the advertised endpoint type is trusted, with a name
// heuristic as the last resort.
func imageStudioIsImageModel(item model.Pricing, explicit []string) bool {
	base := item.ModelName
	if index := strings.LastIndex(base, "/"); index >= 0 {
		base = base[index+1:]
	}
	if len(explicit) > 0 {
		for _, name := range explicit {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			if name == item.ModelName || name == base {
				return true
			}
		}
		return false
	}
	if slices.Contains(item.SupportedEndpointTypes, constant.EndpointTypeImageGeneration) {
		return true
	}
	lower := strings.ToLower(base)
	for _, keyword := range []string{
		"image", "dall-e", "flux", "sdxl", "stable-diffusion", "imagen",
		"seedream", "cogview", "kolors", "recraft", "ideogram", "wanx",
		"nano-banana", "midjourney",
	} {
		if strings.Contains(lower, keyword) {
			return true
		}
	}
	return false
}

// ServeImageStudioFile streams a stored artifact.
//
// The route is intentionally unauthenticated: browsers send no Authorization
// header for <img src>. Keys carry 32 random characters and are never listed,
// so the only way to read one is to already know it.
func ServeImageStudioFile(c *gin.Context) {
	key := strings.TrimPrefix(c.Param("key"), "/")
	file, info, err := service.OpenImageStudioFile(key)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer file.Close()

	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.Header("X-Content-Type-Options", "nosniff")
	http.ServeContent(c.Writer, c.Request, info.Name(), info.ModTime(), file)
}

// imageStudioTaskView is the shape sent to the browser. Keys are resolved to
// URLs here so the client never builds paths itself.
func imageStudioTaskView(task *model.ImageStudioTask) gin.H {
	results := make([]string, 0, 4)
	if task.ResultKeys != "" {
		var keys []string
		if err := common.Unmarshal([]byte(task.ResultKeys), &keys); err == nil {
			for _, key := range keys {
				results = append(results, service.ImageStudioFileURL(key))
			}
		}
	}
	references := make([]string, 0, 4)
	if task.ReferenceKeys != "" {
		var keys []string
		if err := common.Unmarshal([]byte(task.ReferenceKeys), &keys); err == nil {
			for _, key := range keys {
				references = append(references, service.ImageStudioFileURL(key))
			}
		}
	}

	var params any
	if task.Params != "" {
		_ = common.Unmarshal([]byte(task.Params), &params)
	}

	view := gin.H{
		"id":          task.Id,
		"kind":        task.Kind,
		"status":      task.Status,
		"model":       task.Model,
		"group":       task.Group,
		"prompt":      task.Prompt,
		"params":      params,
		"images":      results,
		"references":  references,
		"error":       task.Error,
		"quota":       task.Quota,
		"favorite":    task.Favorite,
		"elapsed_ms":  task.ElapsedMs,
		"created_at":  task.CreatedAt,
		"finished_at": task.FinishedAt,
		"expires_at":  task.ExpiresAt,
	}
	if task.MaskKey != "" {
		view["mask"] = service.ImageStudioFileURL(task.MaskKey)
	}
	return view
}

func imageStudioTaskFileKeys(task *model.ImageStudioTask) []string {
	keys := make([]string, 0, 8)
	if task.ReferenceKeys != "" {
		var references []string
		if err := common.Unmarshal([]byte(task.ReferenceKeys), &references); err == nil {
			keys = append(keys, references...)
		}
	}
	if task.MaskKey != "" {
		keys = append(keys, task.MaskKey)
	}
	if task.ResultKeys != "" {
		var results []string
		if err := common.Unmarshal([]byte(task.ResultKeys), &results); err == nil {
			keys = append(keys, results...)
		}
	}
	return keys
}

func imageStudioQueueDepth(kind string) int64 {
	queued, err := model.CountQueuedImageStudioTasks(kind)
	if err != nil {
		return 0
	}
	return queued
}

// runImageStudioRelay is the executor injected into the queue. It replays the
// request through Relay with a synthetic playground-style context, so billing,
// logging, channel selection and retries behave exactly like a first-class
// image request.
func runImageStudioRelay(ctx context.Context, input service.ImageStudioRunInput) (*service.ImageStudioRunOutput, error) {
	body, contentType, requestPath, err := buildImageStudioBody(input)
	if err != nil {
		return nil, err
	}

	requestId := common.NewRequestId()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequestWithContext(ctx, http.MethodPost, requestPath, bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", contentType)
	c.Request.ContentLength = int64(len(body))
	c.Set(common.RequestIdKey, requestId)
	c.Set("specific_channel_version", "")

	userCache, err := model.GetUserCache(input.UserId)
	if err != nil {
		return nil, err
	}
	userCache.WriteContext(c)
	c.Set("id", input.UserId)

	// Both keys matter: the relay reads the using-group for pricing while the
	// token group drives channel selection.
	common.SetContextKey(c, constant.ContextKeyUsingGroup, input.Group)
	c.Set("group", input.Group)

	if selectErr := imageStudioSelectChannel(c, input.Model, input.Group); selectErr != nil {
		return nil, errors.New(selectErr.Error())
	}

	// The synthetic token mirrors the playground: it carries the chosen group
	// and skips per-token quota, because the interactive page has no API key.
	// The account itself is still charged through the ordinary wallet path.
	tempToken := &model.Token{
		UserId:         input.UserId,
		Name:           "image-studio",
		Group:          input.Group,
		UnlimitedQuota: true,
	}
	if err := middleware.SetupContextForToken(c, tempToken); err != nil {
		return nil, err
	}
	// SetupContextForToken rewrites the token keys; keep the user group intact.
	userCache.WriteContext(c)
	c.Set("id", input.UserId)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, input.Group)

	Relay(c, types.RelayFormatOpenAIImage)

	statusCode := recorder.Code
	if statusCode == 0 {
		statusCode = http.StatusOK
	}
	payload := recorder.Body.Bytes()
	if statusCode >= http.StatusBadRequest {
		return nil, errors.New(extractRelayErrorMessage(payload, statusCode))
	}

	return &service.ImageStudioRunOutput{
		StatusCode: statusCode,
		Body:       payload,
		ChannelId:  c.GetInt("channel_id"),
		RequestId:  requestId,
	}, nil
}

// imageStudioSelectChannel resolves a channel for the model/group pair and
// writes it onto the synthetic context. The HTTP distributor would do this in
// middleware; there is no middleware here.
func imageStudioSelectChannel(c *gin.Context, modelName string, group string) *types.NewAPIError {
	retryParam := &service.RetryParam{
		Ctx:         c,
		TokenGroup:  group,
		ModelName:   modelName,
		RequestPath: imageStudioGenerationPath,
		Retry:       common.GetPointer(0),
	}
	channel, _, selectErr := service.SelectChannelForRequest(c, modelName, retryParam)
	if selectErr != nil {
		if selectErr.NoAvailableChannel {
			return types.NewErrorWithStatusCode(
				errors.New("当前分组下没有可用的图像通道，请更换模型或分组后重试"),
				types.ErrorCodeGetChannelFailed,
				http.StatusServiceUnavailable,
				types.ErrOptionWithSkipRetry(),
			)
		}
		message := strings.TrimSpace(selectErr.Message)
		if message == "" {
			message = "暂时无法为该模型选择可用通道，请稍后重试"
		}
		return types.NewErrorWithStatusCode(
			errors.New(message),
			types.ErrorCodeGetChannelFailed,
			selectErr.StatusCode,
			types.ErrOptionWithSkipRetry(),
		)
	}
	return middleware.SetupContextForSelectedChannel(c, channel, modelName)
}

// buildImageStudioBody renders the stored snapshot into an upstream request.
// Reference images switch the request to the multipart edit endpoint, which is
// what every image-editing adapter understands.
func buildImageStudioBody(input service.ImageStudioRunInput) (body []byte, contentType string, requestPath string, err error) {
	params := map[string]any{}
	if input.Params != "" {
		if unmarshalErr := common.Unmarshal([]byte(input.Params), &params); unmarshalErr != nil {
			params = map[string]any{}
		}
	}
	params["model"] = input.Model
	params["prompt"] = input.Prompt

	if len(input.ReferenceKeys) == 0 {
		payload, marshalErr := common.Marshal(params)
		if marshalErr != nil {
			return nil, "", "", marshalErr
		}
		return payload, "application/json", imageStudioGenerationPath, nil
	}

	buffer := &bytes.Buffer{}
	writer := multipart.NewWriter(buffer)
	for key, value := range params {
		switch typed := value.(type) {
		case string:
			_ = writer.WriteField(key, typed)
		case float64:
			_ = writer.WriteField(key, strconv.FormatFloat(typed, 'f', -1, 64))
		case bool:
			_ = writer.WriteField(key, strconv.FormatBool(typed))
		}
	}

	for index, key := range input.ReferenceKeys {
		filename := fmt.Sprintf("reference-%d%s", index+1, imageStudioFileExt(key))
		if writeErr := writeImageStudioFilePart(writer, key, "image[]", filename); writeErr != nil {
			return nil, "", "", writeErr
		}
	}
	if input.MaskKey != "" {
		filename := "mask" + imageStudioFileExt(input.MaskKey)
		if writeErr := writeImageStudioFilePart(writer, input.MaskKey, "mask", filename); writeErr != nil {
			return nil, "", "", writeErr
		}
	}
	if closeErr := writer.Close(); closeErr != nil {
		return nil, "", "", closeErr
	}
	return buffer.Bytes(), writer.FormDataContentType(), imageStudioEditPath, nil
}

func writeImageStudioFilePart(writer *multipart.Writer, key string, fieldName string, filename string) error {
	file, _, err := service.OpenImageStudioFile(key)
	if err != nil {
		return errors.New("参考图读取失败，请重新上传")
	}
	defer file.Close()

	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, filename))
	header.Set("Content-Type", imageStudioMimeType(key))

	part, err := writer.CreatePart(header)
	if err != nil {
		return err
	}
	if _, err := io.Copy(part, file); err != nil {
		return err
	}
	return nil
}

func imageStudioFileExt(key string) string {
	ext := strings.ToLower(filepath.Ext(key))
	if ext == "" {
		return ".png"
	}
	return ext
}

func imageStudioMimeType(key string) string {
	switch imageStudioFileExt(key) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return "image/png"
	}
}

// extractRelayErrorMessage pulls the human-readable message out of a relay
// error payload.
func extractRelayErrorMessage(payload []byte, statusCode int) string {
	var envelope struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
		Message string `json:"message"`
	}
	if err := common.Unmarshal(payload, &envelope); err == nil {
		if message := strings.TrimSpace(envelope.Error.Message); message != "" {
			return message
		}
		if message := strings.TrimSpace(envelope.Message); message != "" {
			return message
		}
	}
	return fmt.Sprintf("上游返回异常状态码 %d", statusCode)
}
