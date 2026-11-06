package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const zhiqiImageReservationContextKey = "zhiqi_image_reservation"

// This state belongs to the ordinary image relay, not to task u() pricing.
// The plugin preserves it when it replaces its other cross-poll state.
type zhiqiRelayImageBilling struct {
	Version          int                          `json:"version"`
	AccountingReady  bool                         `json:"accountingReady"`
	ReservationQuota int                          `json:"reservationQuota"`
	ImageCount       int                          `json:"imageCount"`
	QuotaPerUnit     float64                      `json:"quotaPerUnit"`
	PriceData        hosttypes.PriceData          `json:"priceData"`
	OtherRatios      map[string]float64           `json:"otherRatios,omitempty"`
	Snapshot         *billingexpr.BillingSnapshot `json:"snapshot,omitempty"`
	RequestInput     billingexpr.RequestInput     `json:"requestInput"`
}

type zhiqiImageReservation struct {
	task       *model.Task
	upstreamID string
	err        error
}

// Accepted upstream work must not be refunded by the ordinary relay's error
// defer, even when the durable/accounting barrier fails and needs repair.
type zhiqiAcceptedImageBilling struct{ relaycommon.BillingSettler }

func (*zhiqiAcceptedImageBilling) Refund(*gin.Context) {}
func (*zhiqiAcceptedImageBilling) NeedsRefund() bool   { return false }

// PersistZhiqiImagePending adopts an already accepted upstream operation. It
// never submits work or increases its reservation. Even on error, publicID is
// the safe reconciliation reference; callers must not forward the upstream ID.
func PersistZhiqiImagePending(c *gin.Context, info *relaycommon.RelayInfo, event map[string]json.RawMessage) (publicID string, err error) {
	if c == nil || info == nil || info.ChannelMeta == nil || !info.ChannelSetting.IsZhiqiEngine() {
		return "", errors.New("Zhiqi image pending requires an enabled channel")
	}
	var eventType, upstreamID string
	if common.Unmarshal(event["type"], &eventType) != nil ||
		(eventType != "image_generation.pending" && eventType != "image_edit.pending") ||
		common.Unmarshal(event["id"], &upstreamID) != nil || strings.TrimSpace(upstreamID) == "" ||
		len(upstreamID) > 191 || strings.ContainsAny(upstreamID, "\r\n\x00") {
		return "", errors.New("Invalid Zhiqi image pending event")
	}
	if cached, exists := c.Get(zhiqiImageReservationContextKey); exists {
		reservation := cached.(*zhiqiImageReservation)
		if reservation.upstreamID != upstreamID {
			return reservation.task.TaskID, errors.New("Zhiqi image pending task changed within one request")
		}
		return reservation.task.TaskID, reservation.err
	}
	reservation := retainZhiqiImageReservation(c, info, upstreamID, strings.TrimSuffix(eventType, ".pending"), "billing_pending")
	return reservation.task.TaskID, reservation.err
}

// SettleZhiqiImageReservation is only for work the caller has confirmed was
// accepted upstream (a successful SSE response, or generated-media failure).
// A transport failure before acceptance must follow the normal refund path.
func SettleZhiqiImageReservation(c *gin.Context, info *relaycommon.RelayInfo, reason string) error {
	if c == nil || info == nil || info.ChannelMeta == nil || !info.ChannelSetting.IsZhiqiEngine() {
		return nil
	}
	if cached, exists := c.Get(zhiqiImageReservationContextKey); exists {
		return cached.(*zhiqiImageReservation).err
	}
	// Never put arbitrary upstream errors, URLs, or credentials in log content.
	if reason != "media_storage_failed" {
		reason = "incomplete_response"
	}
	action := "image_generation"
	if c.Request != nil && c.Request.URL.Path == "/v1/images/edits" {
		action = "image_edit"
	}
	return retainZhiqiImageReservation(c, info, "", action, reason).err
}

func retainZhiqiImageReservation(c *gin.Context, info *relaycommon.RelayInfo, upstreamID, action, reason string) *zhiqiImageReservation {
	task := model.InitTask(constant.TaskPlatform("zhiqi"), info)
	reservation := &zhiqiImageReservation{task: task, upstreamID: upstreamID}
	c.Set(zhiqiImageReservationContextKey, reservation)
	c.Set("zhiqi_image_pending", true)
	quota := max(info.FinalPreConsumedQuota, 0)
	if info.Billing != nil {
		quota = max(info.Billing.GetPreConsumedQuota(), 0)
		info.Billing = &zhiqiAcceptedImageBilling{BillingSettler: info.Billing}
	}
	count := info.ImageRequestCount
	if count < 1 || count > dto.MaxImageN {
		count = 1
		if info.BillingRequestInput != nil && info.BillingRequestInput.ImageCount != nil {
			count = *info.BillingRequestInput.ImageCount
		}
	}
	state := zhiqiRelayImageBilling{
		Version: 1, ReservationQuota: quota, ImageCount: count, QuotaPerUnit: common.QuotaPerUnit,
		PriceData: info.PriceData, OtherRatios: info.PriceData.OtherRatios(), Snapshot: info.TieredBillingSnapshot,
	}
	task.Action = action
	task.Quota = quota
	task.PrivateData.Key = info.ApiKey
	task.PrivateData.UpstreamTaskID = upstreamID
	task.PrivateData.BillingSource = info.BillingSource
	task.PrivateData.SubscriptionId = info.SubscriptionId
	task.PrivateData.TokenId = info.TokenId
	task.PrivateData.NodeName = common.NodeName
	task.PrivateData.Execution = TaskExecutionSnapshotFromContext(c)
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		ModelPrice: info.PriceData.ModelPrice, ModelRatio: info.PriceData.ModelRatio,
		GroupRatio: info.PriceData.GroupRatioInfo.GroupRatio, OtherRatios: state.OtherRatios,
		OriginModelName: info.OriginModelName, PerCallBilling: info.PriceData.UsePrice,
		TieredSnapshot: info.TieredBillingSnapshot,
	}
	// Hide the row from both polling and timeout refunds until settlement and
	// its consume log are durable. A failed barrier remains visible for repair.
	task.Status, task.Progress = model.TaskStatusNotStart, "100%"
	if upstreamID == "" {
		task.Status = model.TaskStatusFailure
		task.FinishTime = time.Now().Unix()
		task.PrivateData.ResultDiscarded = true
	}
	task.SetData(map[string]any{
		"id": task.TaskID, "object": "image.task", "status": "queued", "progress": "0%",
		"created": task.SubmitTime, "model": info.OriginModelName,
	})
	if info.BillingRequestInput != nil {
		state.RequestInput = *info.BillingRequestInput
		state.RequestInput.Usage = nil
		state.RequestInput.Headers = make(map[string]string)
		for name, value := range info.BillingRequestInput.Headers {
			lowerName := strings.ToLower(name)
			if strings.Contains(lowerName, "auth") || strings.Contains(lowerName, "cookie") ||
				strings.Contains(lowerName, "key") || strings.Contains(lowerName, "token") || strings.Contains(lowerName, "secret") {
				continue
			}
			state.RequestInput.Headers[name] = value
		}
		var source map[string]json.RawMessage
		if len(state.RequestInput.Body) > 0 && common.Unmarshal(state.RequestInput.Body, &source) != nil {
			reservation.err = fmt.Errorf("Zhiqi image reservation %s has invalid billing input", task.TaskID)
			return reservation
		}
		scalars := make(map[string]json.RawMessage)
		for _, name := range []string{"model", "n", "size", "quality", "resolution", "aspect_ratio", "response_format", "output_format", "output_compression", "frame_count", "frame_duration_ms", "stream"} {
			value := source[name]
			if len(value) > 0 && value[0] != '{' && value[0] != '[' {
				scalars[name] = value
			}
		}
		state.RequestInput.Body, _ = common.Marshal(scalars)
	}
	pluginState := map[string]any{"relayImageBilling": state}
	if reason == "media_storage_failed" {
		pluginState["generationCompleted"] = true
	}
	encoded, encodeErr := common.Marshal(pluginState)
	if encodeErr != nil {
		reservation.err = fmt.Errorf("Zhiqi image reservation %s could not freeze billing", task.TaskID)
		return reservation
	}
	task.PrivateData.PluginState = encoded
	if insertErr := task.Insert(); insertErr != nil {
		reservation.err = fmt.Errorf("Zhiqi image reservation %s could not be persisted", task.TaskID)
		logger.LogError(c, reservation.err.Error())
		return reservation
	}
	if settleErr := SettleBilling(c, info, quota); settleErr != nil {
		reservation.err = fmt.Errorf("Zhiqi image reservation %s requires billing reconciliation", task.TaskID)
		logger.LogError(c, reservation.err.Error())
		return reservation
	}
	logInfo := *info
	logInfo.TaskRelayInfo = &relaycommon.TaskRelayInfo{Action: action + " reservation; complete upstream usage unavailable; " + reason}
	logInfo.PriceData.Quota = quota
	if info.TieredBillingSnapshot != nil {
		logSnapshot := *info.TieredBillingSnapshot
		logSnapshot.UsageFacts = map[string]any{"image_count": float64(count)}
		logInfo.TieredBillingSnapshot = &logSnapshot
	} else {
		logInfo.PriceData.ReplaceOtherRatios(info.PriceData.OtherRatios())
		logInfo.PriceData.AddOtherRatio("image_count", float64(count))
	}
	logContext := c.Copy()
	if logContext.GetString(common.RequestIdKey) == "" {
		logContext.Set(common.RequestIdKey, task.TaskID)
	}
	LogTaskConsumption(logContext, &logInfo, task)
	// The existing logging primitive has no error return. Verify its durable
	// result rather than claiming completion after a swallowed log DB error.
	if common.LogConsumeEnabled {
		var logs []model.Log
		readErr := model.LOG_DB.Where("user_id = ? AND request_id = ? AND type = ?", task.UserId, logContext.GetString(common.RequestIdKey), model.LogTypeConsume).Find(&logs).Error
		logged := false
		for _, entry := range logs {
			var other struct {
				TaskID string `json:"task_id"`
			}
			if common.UnmarshalJsonStr(entry.Other, &other) == nil && other.TaskID == task.TaskID {
				logged = true
				break
			}
		}
		if readErr != nil || !logged {
			reservation.err = fmt.Errorf("Zhiqi image reservation %s requires consume-log reconciliation", task.TaskID)
			logger.LogError(c, reservation.err.Error())
			return reservation
		}
	}
	state.AccountingReady = true
	pluginState["relayImageBilling"] = state
	task.PrivateData.PluginState, _ = common.Marshal(pluginState)
	previousStatus := task.Status
	if upstreamID != "" {
		task.Status, task.Progress = model.TaskStatusQueued, "0%"
	}
	if published, updateErr := task.UpdateWithStatus(previousStatus); updateErr != nil || !published {
		reservation.err = fmt.Errorf("Zhiqi image reservation %s could not publish its accounting state", task.TaskID)
		logger.LogError(c, reservation.err.Error())
	}
	return reservation
}

// SettlePendingZhiqiImageTask runs only after the poller's terminal-status CAS.
// A false result leaves failures to RefundTaskQuota (including its existing
// generated-image exception); all ordinary image successes are handled here.
func SettlePendingZhiqiImageTask(ctx context.Context, task *model.Task, result *relaycommon.TaskInfo) bool {
	if task == nil || task.Platform != constant.TaskPlatform("zhiqi") || task.Status != model.TaskStatusSuccess {
		return false
	}
	var pluginState map[string]json.RawMessage
	if common.Unmarshal(task.PrivateData.PluginState, &pluginState) != nil || len(pluginState["relayImageBilling"]) == 0 {
		return false
	}
	var state zhiqiRelayImageBilling
	if common.Unmarshal(pluginState["relayImageBilling"], &state) != nil || state.Version != 1 || !state.AccountingReady {
		logger.LogWarn(ctx, common.LogText("Zhiqi image task %s requires billing-state reconciliation; keeping reservation", task.TaskID))
		return true
	}
	quota, clamp, err := calculatePendingZhiqiImageQuota(task, &state)
	if clamp != nil {
		logger.LogWarn(ctx, common.LogText("Zhiqi image task %s settlement quota was clamped: %+v", task.TaskID, clamp))
		if err != nil || quota == task.Quota {
			other := taskBillingOther(task)
			attachQuotaSaturationToOther(other, clamp)
			model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
				UserId: task.UserId, LogType: model.LogTypeSystem, ChannelId: task.ChannelId,
				ModelName: taskModelName(task), TokenId: task.PrivateData.TokenId, Group: task.Group,
				Other: other, NodeName: task.PrivateData.NodeName,
				Content: []*common.Message{common.NewMessage("Action {{action}}", map[string]any{"action": "Zhiqi image quota saturation; reservation reconciliation"})},
			})
		}
	}
	if err != nil {
		logger.LogWarn(ctx, common.LogText("Zhiqi image task %s has incomplete usage or invalid frozen billing; keeping reservation", task.TaskID))
		return true
	}
	RecalculateTaskQuota(ctx, task, quota, common.NewMessage("Action {{action}}", map[string]any{"action": "Zhiqi image settlement from frozen ordinary image pricing"}), clamp)
	return true
}

func calculatePendingZhiqiImageQuota(task *model.Task, state *zhiqiRelayImageBilling) (int, *common.QuotaClamp, error) {
	if state.PriceData.FreeModel {
		return 0, nil, nil
	}
	var body map[string]json.RawMessage
	if common.Unmarshal(task.Data, &body) != nil {
		return task.Quota, nil, errors.New("invalid image task payload")
	}
	count := state.ImageCount
	var entries []json.RawMessage
	var object map[string]json.RawMessage
	if common.Unmarshal(body["data"], &entries) != nil && common.Unmarshal(body["data"], &object) == nil {
		entries = []json.RawMessage{body["data"]}
	}
	urls, encodedImages := 0, 0
	for _, rawEntry := range entries {
		var entry map[string]json.RawMessage
		if common.Unmarshal(rawEntry, &entry) != nil {
			continue
		}
		var value string
		if common.Unmarshal(entry["url"], &value) == nil && strings.TrimSpace(value) != "" {
			urls++
		}
		if common.Unmarshal(entry["b64_json"], &value) == nil && strings.TrimSpace(value) != "" {
			encodedImages++
		}
	}
	if actualCount := max(urls, encodedImages); actualCount >= 1 && actualCount <= dto.MaxImageN {
		count = actualCount
	}
	if count < 1 || count > dto.MaxImageN {
		return task.Quota, nil, errors.New("invalid reserved image count")
	}
	usageRaw := body["usage"]
	if len(usageRaw) == 0 || string(usageRaw) == "null" {
		var metadata map[string]json.RawMessage
		if common.Unmarshal(body["metadata"], &metadata) == nil {
			usageRaw = metadata["upstream_usage"]
		}
	}
	usage, clamp, usageErr := normalizeZhiqiImageUsage(usageRaw)
	if snapshot := state.Snapshot; snapshot != nil {
		variables := billingexpr.UsedVarsByHash(snapshot.ExprString, snapshot.ExprHash)
		if snapshot.TaskUsageBilling || variables["u"] {
			return task.Quota, clamp, errors.New("task usage pricing is not ordinary image pricing")
		}
		for _, name := range []string{"p", "c", "len", "cr", "cc", "cc1h", "cc12h", "img", "img_cr", "img_o", "ai", "ao"} {
			if variables[name] && usageErr != nil {
				return task.Quota, clamp, usageErr
			}
		}
		if usage == nil {
			usage = &dto.Usage{}
		}
		request := state.RequestInput
		request.ImageCount = &count
		settled, err := billingexpr.ComputeTieredQuotaWithRequest(snapshot, BuildTieredTokenParams(usage, false, variables), request)
		if clamp == nil {
			clamp = settled.Clamp
		}
		if err == nil && task.PrivateData.BillingContext != nil {
			// Only the task log projection changes. The billing contract in
			// relayImageBilling remains immutable and never becomes u() pricing.
			logSnapshot := *snapshot
			logSnapshot.UsageFacts = map[string]any{"image_count": float64(count)}
			logSnapshot.EstimatedTier = settled.MatchedTier
			task.PrivateData.BillingContext.TieredSnapshot = &logSnapshot
		}
		return settled.ActualQuotaAfterGroup, clamp, err
	}
	price := state.PriceData
	for name, ratio := range state.OtherRatios {
		price.AddOtherRatio(name, ratio)
	}
	if price.UsePrice {
		price.AddOtherRatio("n", float64(count))
		quota, priceClamp := common.QuotaFromDecimalChecked(price.ApplyOtherRatiosToDecimal(decimal.NewFromFloat(price.ModelPrice).
			Mul(decimal.NewFromFloat(state.QuotaPerUnit)).Mul(decimal.NewFromFloat(price.GroupRatioInfo.GroupRatio))))
		if task.PrivateData.BillingContext != nil {
			logPrice := price
			logPrice.AddOtherRatio("image_count", float64(count))
			task.PrivateData.BillingContext.OtherRatios = logPrice.OtherRatios()
		}
		return quota, priceClamp, nil
	}
	if usageErr != nil || usage.PromptTokensDetails.AudioTokens != 0 || strings.HasSuffix(task.Properties.OriginModelName, "search-preview") {
		return task.Quota, clamp, errors.New("complete image token usage is unavailable")
	}
	info := &relaycommon.RelayInfo{PriceData: price, OriginModelName: task.Properties.OriginModelName, StartTime: time.Unix(task.SubmitTime, 0), QuotaClamp: clamp}
	summary := calculateTextQuotaSummary(&gin.Context{}, info, usage)
	return summary.Quota, info.QuotaClamp, nil
}

// Read only token quantities, preserving explicit zero and modality-cache
// details. Money and provider billing-status members are never interpreted.
func normalizeZhiqiImageUsage(raw json.RawMessage) (*dto.Usage, *common.QuotaClamp, error) {
	var fields map[string]json.RawMessage
	if common.Unmarshal(raw, &fields) != nil || fields == nil {
		return nil, nil, errors.New("missing image usage")
	}
	if fields["input_tokens"] != nil {
		fields["prompt_tokens"] = fields["input_tokens"]
	}
	if fields["output_tokens"] != nil {
		fields["completion_tokens"] = fields["output_tokens"]
	}
	if fields["input_tokens_details"] != nil {
		fields["prompt_tokens_details"] = fields["input_tokens_details"]
	}
	if fields["output_tokens_details"] != nil {
		fields["completion_tokens_details"] = fields["output_tokens_details"]
	}
	if fields["prompt_tokens"] == nil || fields["completion_tokens"] == nil {
		return nil, nil, errors.New("incomplete image usage")
	}
	normalized, clamp, err := normalizeZhiqiImageTokenFields(fields, 3)
	if err != nil {
		return nil, clamp, err
	}
	encoded, err := common.Marshal(normalized)
	if err != nil {
		return nil, clamp, err
	}
	var usage dto.Usage
	if err := common.Unmarshal(encoded, &usage); err != nil {
		return nil, clamp, err
	}
	var totalClamp *common.QuotaClamp
	usage.TotalTokens, totalClamp = common.QuotaFromFloatChecked(float64(usage.PromptTokens) + float64(usage.CompletionTokens))
	if clamp == nil {
		clamp = totalClamp
	}
	return &usage, clamp, nil
}

func normalizeZhiqiImageTokenFields(fields map[string]json.RawMessage, remainingDepth int) (map[string]any, *common.QuotaClamp, error) {
	if remainingDepth == 0 {
		return nil, nil, errors.New("invalid nested image token details")
	}
	normalized := make(map[string]any)
	var clamp *common.QuotaClamp
	for _, name := range []string{"prompt_tokens", "completion_tokens", "text_tokens", "image_tokens", "audio_tokens", "cached_tokens", "cached_creation_tokens", "cache_creation_input_tokens", "cache_write_tokens", "ttl_30m_tokens", "ttl_12h_tokens"} {
		if raw := fields[name]; raw != nil {
			var quantity float64
			if string(raw) == "null" || common.Unmarshal(raw, &quantity) != nil || quantity < 0 || math.Trunc(quantity) != quantity {
				return nil, clamp, errors.New("invalid image token quantity")
			}
			count, currentClamp := common.QuotaFromFloatChecked(quantity)
			if clamp == nil {
				clamp = currentClamp
			}
			normalized[name] = count
		}
	}
	for _, name := range []string{"prompt_tokens_details", "completion_tokens_details", "cached_tokens_details", "cache_write_tokens_details"} {
		if raw := fields[name]; raw != nil && string(raw) != "null" {
			var details map[string]json.RawMessage
			if common.Unmarshal(raw, &details) != nil {
				return nil, clamp, errors.New("invalid image token details")
			}
			value, detailsClamp, err := normalizeZhiqiImageTokenFields(details, remainingDepth-1)
			if err != nil {
				return nil, clamp, err
			}
			if clamp == nil {
				clamp = detailsClamp
			}
			normalized[name] = value
		}
	}
	return normalized, clamp, nil
}
