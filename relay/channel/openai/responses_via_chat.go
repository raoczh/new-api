package openai

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// OaiChatToResponsesHandler converts an upstream Chat Completions (non-stream)
// response into an OpenAI Responses API (/v1/responses) response and writes it
// to the client.
func OaiChatToResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var chatResp dto.OpenAITextResponse
	if err := common.Unmarshal(body, &chatResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if oaiError := chatResp.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	usage := &chatResp.Usage
	responsesResp := buildResponsesResponseFromChat(c, info, &chatResp)

	respBody, err := common.Marshal(responsesResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, respBody)
	return usage, nil
}

func buildResponsesResponseFromChat(c *gin.Context, info *relaycommon.RelayInfo, chatResp *dto.OpenAITextResponse) *dto.OpenAIResponsesResponse {
	responseId := responsesResponseID(c)
	model := chatResp.Model
	if model == "" {
		model = info.UpstreamModelName
	}
	createdAt := toUnixSecondsAny(chatResp.Created)
	if createdAt == 0 {
		createdAt = int(time.Now().Unix())
	}

	outputs := make([]dto.ResponsesOutput, 0, len(chatResp.Choices))
	for idx, choice := range chatResp.Choices {
		text := choice.Message.StringContent()
		if text != "" {
			outputs = append(outputs, dto.ResponsesOutput{
				Type:   "message",
				ID:     fmt.Sprintf("msg_%s_%d", responseId, idx),
				Status: "completed",
				Role:   "assistant",
				Content: []dto.ResponsesOutputContent{
					{
						Type: "output_text",
						Text: text,
					},
				},
			})
		}
		for tcIdx, tc := range choice.Message.ParseToolCalls() {
			name := tc.Function.Name
			if strings.TrimSpace(name) == "" {
				continue
			}
			callId := tc.ID
			if strings.TrimSpace(callId) == "" {
				callId = fmt.Sprintf("call_%s_%d_%d", responseId, idx, tcIdx)
			}
			outputs = append(outputs, dto.ResponsesOutput{
				Type:      "function_call",
				ID:        fmt.Sprintf("fc_%s_%d_%d", responseId, idx, tcIdx),
				Status:    "completed",
				CallId:    callId,
				Name:      name,
				Arguments: json.RawMessage(tc.Function.Arguments),
			})
		}
	}

	usage := chatResp.Usage
	responsesUsage := &dto.Usage{
		PromptTokens:        usage.PromptTokens,
		CompletionTokens:    usage.CompletionTokens,
		TotalTokens:         usage.TotalTokens,
		InputTokens:         usage.PromptTokens,
		OutputTokens:        usage.CompletionTokens,
		PromptTokensDetails: usage.PromptTokensDetails,
		InputTokensDetails:  &usage.PromptTokensDetails,
	}
	responsesUsage.CompletionTokenDetails = usage.CompletionTokenDetails

	return &dto.OpenAIResponsesResponse{
		ID:        responseId,
		Object:    "response",
		CreatedAt: createdAt,
		Status:    json.RawMessage(`"completed"`),
		Model:     model,
		Output:    outputs,
		Usage:     responsesUsage,
	}
}

// OaiChatToResponsesStreamHandler consumes an upstream Chat Completions SSE
// stream and re-emits it as an OpenAI Responses API (/v1/responses) SSE stream.
func OaiChatToResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	helper.SetEventStreamHeaders(c)

	responseId := responsesResponseID(c)
	createdAt := int(time.Now().Unix())
	model := info.UpstreamModelName

	var (
		usage                 = &dto.Usage{}
		usageTextBuilder      strings.Builder
		outputIndex           = 0
		textItemID            string
		textItemOpened        bool
		textContentIndex      = 0
		toolCallItems         = make(map[int]*streamToolItem)
		toolCallOrder         []int
		sentCreated           bool
		sentCompleted         bool
		streamErr             *types.NewAPIError
		lastFinishReason      string
		streamedAnyToolCall   bool
		accumulatedAssistText strings.Builder
	)

	// send response.created at first opportunity
	sendCreated := func() bool {
		if sentCreated {
			return true
		}
		responseObj := &dto.OpenAIResponsesResponse{
			ID:        responseId,
			Object:    "response",
			CreatedAt: createdAt,
			Status:    json.RawMessage(`"in_progress"`),
			Model:     model,
		}
		evt := dto.ResponsesStreamResponse{
			Type:     "response.created",
			Response: responseObj,
		}
		if !emitResponsesEvent(c, evt) {
			streamErr = types.NewOpenAIError(fmt.Errorf("failed to emit response.created"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return false
		}
		progressEvt := dto.ResponsesStreamResponse{
			Type:     "response.in_progress",
			Response: responseObj,
		}
		if !emitResponsesEvent(c, progressEvt) {
			streamErr = types.NewOpenAIError(fmt.Errorf("failed to emit response.in_progress"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return false
		}
		sentCreated = true
		return true
	}

	openTextItem := func() bool {
		if textItemOpened {
			return true
		}
		if !sendCreated() {
			return false
		}
		textItemID = fmt.Sprintf("msg_%s_%d", responseId, outputIndex)
		idx := outputIndex
		item := &dto.ResponsesOutput{
			Type:   "message",
			ID:     textItemID,
			Status: "in_progress",
			Role:   "assistant",
			Content: []dto.ResponsesOutputContent{
				{
					Type: "output_text",
					Text: "",
				},
			},
		}
		evt := dto.ResponsesStreamResponse{
			Type:        "response.output_item.added",
			OutputIndex: &idx,
			Item:        item,
		}
		if !emitResponsesEvent(c, evt) {
			streamErr = types.NewOpenAIError(fmt.Errorf("failed to emit output_item.added"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return false
		}
		textItemOpened = true
		return true
	}

	closeTextItem := func() bool {
		if !textItemOpened {
			return true
		}
		idx := outputIndex
		contentIdx := textContentIndex
		finalText := accumulatedAssistText.String()
		doneContentEvt := dto.ResponsesStreamResponse{
			Type:         "response.output_text.done",
			ItemID:       textItemID,
			OutputIndex:  &idx,
			ContentIndex: &contentIdx,
			Delta:        finalText,
		}
		if !emitResponsesEvent(c, doneContentEvt) {
			streamErr = types.NewOpenAIError(fmt.Errorf("failed to emit output_text.done"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return false
		}
		item := &dto.ResponsesOutput{
			Type:   "message",
			ID:     textItemID,
			Status: "completed",
			Role:   "assistant",
			Content: []dto.ResponsesOutputContent{
				{
					Type: "output_text",
					Text: finalText,
				},
			},
		}
		doneItemEvt := dto.ResponsesStreamResponse{
			Type:        "response.output_item.done",
			OutputIndex: &idx,
			Item:        item,
		}
		if !emitResponsesEvent(c, doneItemEvt) {
			streamErr = types.NewOpenAIError(fmt.Errorf("failed to emit output_item.done for text"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return false
		}
		textItemOpened = false
		outputIndex++
		accumulatedAssistText.Reset()
		return true
	}

	openToolCallItem := func(tcIndex int, callID, name string) *streamToolItem {
		if existing, ok := toolCallItems[tcIndex]; ok {
			return existing
		}
		if !sendCreated() {
			return nil
		}
		// If text item is open, close it first to preserve event ordering.
		if textItemOpened {
			if !closeTextItem() {
				return nil
			}
		}
		itemID := fmt.Sprintf("fc_%s_%d", responseId, outputIndex)
		if callID == "" {
			callID = fmt.Sprintf("call_%s_%d", responseId, outputIndex)
		}
		idx := outputIndex
		item := &dto.ResponsesOutput{
			Type:   "function_call",
			ID:     itemID,
			Status: "in_progress",
			CallId: callID,
			Name:   name,
		}
		evt := dto.ResponsesStreamResponse{
			Type:        "response.output_item.added",
			OutputIndex: &idx,
			Item:        item,
		}
		if !emitResponsesEvent(c, evt) {
			streamErr = types.NewOpenAIError(fmt.Errorf("failed to emit output_item.added for tool_call"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return nil
		}
		newItem := &streamToolItem{
			itemID:      itemID,
			callID:      callID,
			name:        name,
			outputIndex: outputIndex,
		}
		toolCallItems[tcIndex] = newItem
		toolCallOrder = append(toolCallOrder, tcIndex)
		outputIndex++
		return newItem
	}

	closeToolCallItems := func() bool {
		for _, tcIdx := range toolCallOrder {
			item := toolCallItems[tcIdx]
			if item == nil || item.closed {
				continue
			}
			idx := item.outputIndex
			argsDoneEvt := dto.ResponsesStreamResponse{
				Type:        "response.function_call_arguments.done",
				ItemID:      item.itemID,
				OutputIndex: &idx,
				Delta:       item.arguments.String(),
			}
			if !emitResponsesEvent(c, argsDoneEvt) {
				streamErr = types.NewOpenAIError(fmt.Errorf("failed to emit function_call_arguments.done"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
				return false
			}
			doneItem := &dto.ResponsesOutput{
				Type:      "function_call",
				ID:        item.itemID,
				Status:    "completed",
				CallId:    item.callID,
				Name:      item.name,
				Arguments: json.RawMessage(item.arguments.String()),
			}
			doneEvt := dto.ResponsesStreamResponse{
				Type:        "response.output_item.done",
				OutputIndex: &idx,
				Item:        doneItem,
			}
			if !emitResponsesEvent(c, doneEvt) {
				streamErr = types.NewOpenAIError(fmt.Errorf("failed to emit output_item.done for tool_call"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
				return false
			}
			item.closed = true
		}
		return true
	}

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if streamErr != nil {
			sr.Stop(streamErr)
			return
		}
		trimmed := strings.TrimSpace(data)
		if trimmed == "" || trimmed == "[DONE]" {
			return
		}

		var chunk dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &chunk); err != nil {
			logger.LogError(c, "failed to unmarshal chat stream chunk: "+err.Error())
			return
		}

		if chunk.Model != "" {
			model = chunk.Model
		}
		if chunk.Created != 0 {
			createdAt = int(chunk.Created)
		}
		if chunk.Usage != nil && service.ValidUsage(chunk.Usage) {
			usage = chunk.Usage
		}

		if !sendCreated() {
			sr.Stop(streamErr)
			return
		}

		for _, choice := range chunk.Choices {
			if content := choice.Delta.GetContentString(); content != "" {
				if !openTextItem() {
					sr.Stop(streamErr)
					return
				}
				accumulatedAssistText.WriteString(content)
				usageTextBuilder.WriteString(content)
				idx := outputIndex
				contentIdx := textContentIndex
				deltaEvt := dto.ResponsesStreamResponse{
					Type:         "response.output_text.delta",
					ItemID:       textItemID,
					OutputIndex:  &idx,
					ContentIndex: &contentIdx,
					Delta:        content,
				}
				if !emitResponsesEvent(c, deltaEvt) {
					streamErr = types.NewOpenAIError(fmt.Errorf("failed to emit output_text.delta"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
					sr.Stop(streamErr)
					return
				}
			}

			for _, tc := range choice.Delta.ToolCalls {
				tcIndex := 0
				if tc.Index != nil {
					tcIndex = *tc.Index
				}
				name := tc.Function.Name
				item := openToolCallItem(tcIndex, tc.ID, name)
				if item == nil {
					sr.Stop(streamErr)
					return
				}
				if name != "" && item.name == "" {
					item.name = name
				}
				if tc.ID != "" && item.callID == "" {
					item.callID = tc.ID
				}
				if tc.Function.Arguments != "" {
					item.arguments.WriteString(tc.Function.Arguments)
					usageTextBuilder.WriteString(tc.Function.Arguments)
					idx := item.outputIndex
					argsEvt := dto.ResponsesStreamResponse{
						Type:        "response.function_call_arguments.delta",
						ItemID:      item.itemID,
						OutputIndex: &idx,
						Delta:       tc.Function.Arguments,
					}
					if !emitResponsesEvent(c, argsEvt) {
						streamErr = types.NewOpenAIError(fmt.Errorf("failed to emit function_call_arguments.delta"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
						sr.Stop(streamErr)
						return
					}
					streamedAnyToolCall = true
				}
			}

			if choice.FinishReason != nil && *choice.FinishReason != "" {
				lastFinishReason = *choice.FinishReason
			}
		}
	})

	if streamErr != nil {
		return nil, streamErr
	}

	if !sendCreated() {
		return nil, streamErr
	}

	if !closeTextItem() {
		return nil, streamErr
	}
	if !closeToolCallItems() {
		return nil, streamErr
	}

	if usage == nil || usage.TotalTokens == 0 {
		usage = service.ResponseText2Usage(c, usageTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
	}

	if !sentCompleted {
		status := "completed"
		if lastFinishReason == "tool_calls" || (streamedAnyToolCall && accumulatedAssistText.Len() == 0) {
			// keep "completed" status; finish reason is not a responses field
		}
		// assemble final output snapshot
		finalOutputs := make([]dto.ResponsesOutput, 0, outputIndex)
		// We don't keep ordered snapshots of text items beyond the current one,
		// so a minimal representation is enough for clients that read usage.
		for _, tcIdx := range toolCallOrder {
			item := toolCallItems[tcIdx]
			if item == nil {
				continue
			}
			finalOutputs = append(finalOutputs, dto.ResponsesOutput{
				Type:      "function_call",
				ID:        item.itemID,
				Status:    "completed",
				CallId:    item.callID,
				Name:      item.name,
				Arguments: json.RawMessage(item.arguments.String()),
			})
		}

		responsesUsage := &dto.Usage{}
		if usage != nil {
			responsesUsage.PromptTokens = usage.PromptTokens
			responsesUsage.CompletionTokens = usage.CompletionTokens
			responsesUsage.TotalTokens = usage.TotalTokens
			responsesUsage.InputTokens = usage.PromptTokens
			responsesUsage.OutputTokens = usage.CompletionTokens
			responsesUsage.PromptTokensDetails = usage.PromptTokensDetails
			details := usage.PromptTokensDetails
			responsesUsage.InputTokensDetails = &details
			responsesUsage.CompletionTokenDetails = usage.CompletionTokenDetails
		}

		completedObj := &dto.OpenAIResponsesResponse{
			ID:        responseId,
			Object:    "response",
			CreatedAt: createdAt,
			Status:    json.RawMessage(fmt.Sprintf("%q", status)),
			Model:     model,
			Output:    finalOutputs,
			Usage:     responsesUsage,
		}
		completedEvt := dto.ResponsesStreamResponse{
			Type:     "response.completed",
			Response: completedObj,
		}
		if !emitResponsesEvent(c, completedEvt) {
			return nil, types.NewOpenAIError(fmt.Errorf("failed to emit response.completed"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
		sentCompleted = true
	}

	return usage, nil
}

type streamToolItem struct {
	itemID      string
	callID      string
	name        string
	outputIndex int
	arguments   strings.Builder
	closed      bool
}

func emitResponsesEvent(c *gin.Context, evt dto.ResponsesStreamResponse) bool {
	data, err := common.Marshal(evt)
	if err != nil {
		return false
	}
	helper.ResponseChunkData(c, evt, string(data))
	return true
}

func responsesResponseID(c *gin.Context) string {
	logID := c.GetString(common.RequestIdKey)
	if logID == "" {
		return fmt.Sprintf("resp_%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("resp_%s", logID)
}

func toUnixSecondsAny(v any) int {
	switch x := v.(type) {
	case int:
		return x
	case int64:
		return int(x)
	case float64:
		return int(x)
	case string:
		return 0
	default:
		return 0
	}
}
