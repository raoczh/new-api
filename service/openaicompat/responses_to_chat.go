package openaicompat

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/samber/lo"
)

func ResponsesResponseToChatCompletionsResponse(resp *dto.OpenAIResponsesResponse, id string) (*dto.OpenAITextResponse, *dto.Usage, error) {
	if resp == nil {
		return nil, nil, errors.New("response is nil")
	}

	text := ExtractOutputTextFromResponses(resp)

	usage := &dto.Usage{}
	if resp.Usage != nil {
		if resp.Usage.InputTokens != 0 {
			usage.PromptTokens = resp.Usage.InputTokens
			usage.InputTokens = resp.Usage.InputTokens
		}
		if resp.Usage.OutputTokens != 0 {
			usage.CompletionTokens = resp.Usage.OutputTokens
			usage.OutputTokens = resp.Usage.OutputTokens
		}
		if resp.Usage.TotalTokens != 0 {
			usage.TotalTokens = resp.Usage.TotalTokens
		} else {
			usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		}
		if resp.Usage.InputTokensDetails != nil {
			usage.PromptTokensDetails.CachedTokens = resp.Usage.InputTokensDetails.CachedTokens
			usage.PromptTokensDetails.ImageTokens = resp.Usage.InputTokensDetails.ImageTokens
			usage.PromptTokensDetails.AudioTokens = resp.Usage.InputTokensDetails.AudioTokens
		}
		if resp.Usage.CompletionTokenDetails.ReasoningTokens != 0 {
			usage.CompletionTokenDetails.ReasoningTokens = resp.Usage.CompletionTokenDetails.ReasoningTokens
		}
	}

	created := resp.CreatedAt

	var toolCalls []dto.ToolCallResponse
	if text == "" && len(resp.Output) > 0 {
		for _, out := range resp.Output {
			if out.Type != "function_call" {
				continue
			}
			name := strings.TrimSpace(out.Name)
			if name == "" {
				continue
			}
			callId := strings.TrimSpace(out.CallId)
			if callId == "" {
				callId = strings.TrimSpace(out.ID)
			}
			toolCalls = append(toolCalls, dto.ToolCallResponse{
				ID:   callId,
				Type: "function",
				Function: dto.FunctionResponse{
					Name:      name,
					Arguments: out.Arguments,
				},
			})
		}
	}

	finishReason := "stop"
	if len(toolCalls) > 0 {
		finishReason = "tool_calls"
	}

	msg := dto.Message{
		Role:    "assistant",
		Content: text,
	}
	if len(toolCalls) > 0 {
		msg.SetToolCalls(toolCalls)
		msg.Content = ""
	}

	out := &dto.OpenAITextResponse{
		Id:      id,
		Object:  "chat.completion",
		Created: created,
		Model:   resp.Model,
		Choices: []dto.OpenAITextResponseChoice{
			{
				Index:        0,
				Message:      msg,
				FinishReason: finishReason,
			},
		},
		Usage: *usage,
	}

	return out, usage, nil
}

func ExtractOutputTextFromResponses(resp *dto.OpenAIResponsesResponse) string {
	if resp == nil || len(resp.Output) == 0 {
		return ""
	}

	var sb strings.Builder

	// Prefer assistant message outputs.
	for _, out := range resp.Output {
		if out.Type != "message" {
			continue
		}
		if out.Role != "" && out.Role != "assistant" {
			continue
		}
		for _, c := range out.Content {
			if c.Type == "output_text" && c.Text != "" {
				sb.WriteString(c.Text)
			}
		}
	}
	if sb.Len() > 0 {
		return sb.String()
	}
	for _, out := range resp.Output {
		for _, c := range out.Content {
			if c.Text != "" {
				sb.WriteString(c.Text)
			}
		}
	}
	return sb.String()
}

// ResponsesRequestToChatCompletionsRequest converts an OpenAI Responses API
// request into an equivalent Chat Completions request. It is the reverse of
// ChatCompletionsRequestToResponsesRequest. PreviousResponseID is rejected
// because stateful conversation references cannot be represented in chat
// completions semantics.
func ResponsesRequestToChatCompletionsRequest(req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, error) {
	if req == nil {
		return nil, errors.New("request is nil")
	}
	if req.Model == "" {
		return nil, errors.New("model is required")
	}
	if strings.TrimSpace(req.PreviousResponseID) != "" {
		return nil, errors.New("previous_response_id is not supported when forcing chat completions")
	}

	messages := make([]dto.Message, 0)

	if instructionsText := responsesInstructionsToText(req.Instructions); instructionsText != "" {
		messages = append(messages, dto.Message{
			Role:    "system",
			Content: instructionsText,
		})
	}

	inputMessages, err := parseResponsesInputToChatMessages(req.Input)
	if err != nil {
		return nil, err
	}
	messages = append(messages, inputMessages...)

	tools, err := responsesToolsToChatTools(req.Tools)
	if err != nil {
		return nil, err
	}

	toolChoice, err := responsesToolChoiceToChatToolChoice(req.ToolChoice)
	if err != nil {
		return nil, err
	}

	responseFormat, err := responsesTextToChatResponseFormat(req.Text)
	if err != nil {
		return nil, err
	}

	parallelToolCalls, err := responsesParallelToolCallsToChatBool(req.ParallelToolCalls)
	if err != nil {
		return nil, err
	}

	out := &dto.GeneralOpenAIRequest{
		Model:            req.Model,
		Messages:         messages,
		Stream:           req.Stream,
		StreamOptions:    req.StreamOptions,
		Temperature:      req.Temperature,
		TopP:             req.TopP,
		TopLogProbs:      req.TopLogProbs,
		Tools:            tools,
		ToolChoice:       toolChoice,
		ResponseFormat:   responseFormat,
		ParallelTooCalls: parallelToolCalls,
		User:             req.User,
		Store:            req.Store,
		Metadata:         req.Metadata,
	}

	if req.MaxOutputTokens != nil {
		out.MaxCompletionTokens = lo.ToPtr(*req.MaxOutputTokens)
	}
	if req.Reasoning != nil && req.Reasoning.Effort != "" {
		out.ReasoningEffort = req.Reasoning.Effort
	}

	return out, nil
}

func responsesInstructionsToText(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	switch common.GetJsonType(raw) {
	case "string":
		var s string
		if err := common.Unmarshal(raw, &s); err == nil {
			return strings.TrimSpace(s)
		}
	case "array":
		var items []map[string]any
		if err := common.Unmarshal(raw, &items); err == nil {
			var parts []string
			for _, item := range items {
				if text, ok := item["text"].(string); ok && text != "" {
					parts = append(parts, text)
				}
			}
			return strings.TrimSpace(strings.Join(parts, "\n"))
		}
	}
	return ""
}

func parseResponsesInputToChatMessages(raw json.RawMessage) ([]dto.Message, error) {
	if len(raw) == 0 {
		return nil, nil
	}

	switch common.GetJsonType(raw) {
	case "string":
		var s string
		if err := common.Unmarshal(raw, &s); err != nil {
			return nil, fmt.Errorf("failed to parse input string: %w", err)
		}
		return []dto.Message{{Role: "user", Content: s}}, nil
	case "array":
		// decode as raw generic items first, because shape varies per item type
		var items []map[string]any
		if err := common.Unmarshal(raw, &items); err != nil {
			return nil, fmt.Errorf("failed to parse input array: %w", err)
		}
		return responsesItemsToChatMessages(items)
	default:
		return nil, fmt.Errorf("unsupported input type: %s", common.GetJsonType(raw))
	}
}

func responsesItemsToChatMessages(items []map[string]any) ([]dto.Message, error) {
	messages := make([]dto.Message, 0, len(items))
	// pendingToolCalls buffers function_call items that should attach to the
	// most recent assistant message. If no assistant message exists yet, a new
	// assistant message is synthesized.
	var pendingToolCalls []dto.ToolCallRequest

	flushPendingToolCalls := func() {
		if len(pendingToolCalls) == 0 {
			return
		}
		if len(messages) > 0 && messages[len(messages)-1].Role == "assistant" {
			existing := messages[len(messages)-1].ParseToolCalls()
			combined := append(existing, pendingToolCalls...)
			messages[len(messages)-1].SetToolCalls(combined)
		} else {
			m := dto.Message{Role: "assistant"}
			m.SetNullContent()
			m.SetToolCalls(pendingToolCalls)
			messages = append(messages, m)
		}
		pendingToolCalls = nil
	}

	for _, item := range items {
		itemType, _ := item["type"].(string)

		// Role-bearing messages: either {role,content} or {type:"message",role,content}
		if role, ok := item["role"].(string); ok && role != "" && (itemType == "" || itemType == "message") {
			flushPendingToolCalls()
			msg, err := buildChatMessageFromResponsesItem(role, item["content"])
			if err != nil {
				return nil, err
			}
			messages = append(messages, msg)
			continue
		}

		switch itemType {
		case "function_call":
			callId := strings.TrimSpace(stringFromAny(item["call_id"]))
			name := strings.TrimSpace(stringFromAny(item["name"]))
			arguments := stringFromAny(item["arguments"])
			if callId == "" || name == "" {
				continue
			}
			pendingToolCalls = append(pendingToolCalls, dto.ToolCallRequest{
				ID:   callId,
				Type: "function",
				Function: dto.FunctionRequest{
					Name:      name,
					Arguments: arguments,
				},
			})
		case "function_call_output":
			flushPendingToolCalls()
			callId := strings.TrimSpace(stringFromAny(item["call_id"]))
			output := stringFromAny(item["output"])
			if callId == "" {
				// Preserve content but without tool_call_id chat treats it as orphan
				messages = append(messages, dto.Message{
					Role:    "user",
					Content: fmt.Sprintf("[tool_output_missing_call_id] %s", output),
				})
				continue
			}
			toolMsg := dto.Message{
				Role:       "tool",
				ToolCallId: callId,
			}
			toolMsg.SetStringContent(output)
			messages = append(messages, toolMsg)
		case "reasoning", "item_reference":
			// Cannot be represented in chat completions; drop silently.
			continue
		case "input_text", "input_image", "input_audio", "input_file":
			// Top-level content part without an explicit message wrapper: fold
			// into a user message.
			flushPendingToolCalls()
			msg, err := buildChatMessageFromResponsesItem("user", []any{item})
			if err != nil {
				return nil, err
			}
			messages = append(messages, msg)
		default:
			// Unknown item — skip rather than failing the whole request.
			continue
		}
	}
	flushPendingToolCalls()
	return messages, nil
}

func buildChatMessageFromResponsesItem(role string, content any) (dto.Message, error) {
	msg := dto.Message{Role: role}

	switch c := content.(type) {
	case nil:
		msg.SetStringContent("")
		return msg, nil
	case string:
		msg.SetStringContent(c)
		return msg, nil
	case []any:
		parts := make([]dto.MediaContent, 0, len(c))
		var onlyText strings.Builder
		allText := true
		for _, itemAny := range c {
			itemMap, ok := itemAny.(map[string]any)
			if !ok {
				allText = false
				continue
			}
			partType, _ := itemMap["type"].(string)
			switch partType {
			case "input_text", "output_text", "text":
				text := stringFromAny(itemMap["text"])
				parts = append(parts, dto.MediaContent{
					Type: dto.ContentTypeText,
					Text: text,
				})
				onlyText.WriteString(text)
			case "input_image":
				allText = false
				parts = append(parts, dto.MediaContent{
					Type:     dto.ContentTypeImageURL,
					ImageUrl: itemMap["image_url"],
				})
			case "input_audio":
				allText = false
				parts = append(parts, dto.MediaContent{
					Type:       dto.ContentTypeInputAudio,
					InputAudio: itemMap["input_audio"],
				})
			case "input_file":
				allText = false
				parts = append(parts, dto.MediaContent{
					Type: dto.ContentTypeFile,
					File: itemMap["file"],
				})
			case "input_video":
				allText = false
				parts = append(parts, dto.MediaContent{
					Type:     dto.ContentTypeVideoUrl,
					VideoUrl: itemMap["video_url"],
				})
			case "refusal":
				// treat refusal text as plain text content
				if text := stringFromAny(itemMap["refusal"]); text != "" {
					parts = append(parts, dto.MediaContent{
						Type: dto.ContentTypeText,
						Text: text,
					})
					onlyText.WriteString(text)
				}
			default:
				// unknown content type: skip to avoid passing invalid shapes upstream
				continue
			}
		}
		if allText && len(parts) > 0 {
			msg.SetStringContent(onlyText.String())
			return msg, nil
		}
		msg.SetMediaContent(parts)
		return msg, nil
	default:
		// raw json.RawMessage nested in generic map: try marshal-unmarshal round-trip
		b, err := common.Marshal(content)
		if err != nil {
			return msg, fmt.Errorf("unsupported content shape: %w", err)
		}
		switch common.GetJsonType(b) {
		case "string":
			var s string
			_ = common.Unmarshal(b, &s)
			msg.SetStringContent(s)
			return msg, nil
		case "array":
			var arr []any
			if err := common.Unmarshal(b, &arr); err != nil {
				return msg, fmt.Errorf("unsupported content shape: %w", err)
			}
			return buildChatMessageFromResponsesItem(role, arr)
		default:
			msg.SetStringContent(string(b))
			return msg, nil
		}
	}
}

func responsesToolsToChatTools(raw json.RawMessage) ([]dto.ToolCallRequest, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var arr []map[string]any
	if err := common.Unmarshal(raw, &arr); err != nil {
		return nil, fmt.Errorf("failed to parse tools: %w", err)
	}
	out := make([]dto.ToolCallRequest, 0, len(arr))
	for _, item := range arr {
		t, _ := item["type"].(string)
		switch t {
		case "function":
			// Responses: {type:"function", name, description?, parameters?}
			// Chat:      {type:"function", function:{name, description?, parameters?}}
			name, _ := item["name"].(string)
			if name == "" {
				// best-effort skip malformed
				continue
			}
			desc, _ := item["description"].(string)
			out = append(out, dto.ToolCallRequest{
				Type: "function",
				Function: dto.FunctionRequest{
					Name:        name,
					Description: desc,
					Parameters:  item["parameters"],
				},
			})
		default:
			// Non-function tools (web_search_preview, file_search, ...) have no
			// direct chat equivalent. Skip so the upstream doesn't reject.
			continue
		}
	}
	return out, nil
}

func responsesToolChoiceToChatToolChoice(raw json.RawMessage) (any, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	switch common.GetJsonType(raw) {
	case "string":
		var s string
		if err := common.Unmarshal(raw, &s); err != nil {
			return nil, err
		}
		return s, nil
	case "object":
		var m map[string]any
		if err := common.Unmarshal(raw, &m); err != nil {
			return nil, err
		}
		if t, _ := m["type"].(string); t == "function" {
			if name, ok := m["name"].(string); ok && name != "" {
				return map[string]any{
					"type":     "function",
					"function": map[string]any{"name": name},
				}, nil
			}
		}
		return m, nil
	default:
		return nil, nil
	}
}

func responsesTextToChatResponseFormat(raw json.RawMessage) (*dto.ResponseFormat, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var wrapper struct {
		Format map[string]any `json:"format"`
	}
	if err := common.Unmarshal(raw, &wrapper); err != nil {
		return nil, nil // not a format spec, safely ignore
	}
	if wrapper.Format == nil {
		return nil, nil
	}
	t, _ := wrapper.Format["type"].(string)
	if t == "" {
		return nil, nil
	}
	out := &dto.ResponseFormat{Type: t}
	if t == "json_schema" {
		// Responses: {format:{type:"json_schema", name, schema, strict, ...}}
		// Chat:      {type:"json_schema", json_schema:{name, schema, strict, ...}}
		nested := make(map[string]any)
		for k, v := range wrapper.Format {
			if k == "type" {
				continue
			}
			nested[k] = v
		}
		if b, err := common.Marshal(nested); err == nil {
			out.JsonSchema = b
		}
	}
	return out, nil
}

func responsesParallelToolCallsToChatBool(raw json.RawMessage) (*bool, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var b bool
	if err := common.Unmarshal(raw, &b); err != nil {
		return nil, nil
	}
	return &b, nil
}

func stringFromAny(v any) string {
	if v == nil {
		return ""
	}
	switch vv := v.(type) {
	case string:
		return vv
	case json.RawMessage:
		if common.GetJsonType(vv) == "string" {
			var s string
			_ = common.Unmarshal(vv, &s)
			return s
		}
		return string(vv)
	default:
		b, err := common.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		return string(b)
	}
}
