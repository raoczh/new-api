package controller

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	stdhtml "html"
	"slices"
	"strings"
	"time"
	"unicode"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	filterdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/samber/lo"
	"github.com/tidwall/gjson"
)

const (
	// iqProbeMaxChannelAttempts bounds paid retries for one group per run.
	iqProbeMaxChannelAttempts = 3
	iqProbeTimeout            = 10 * time.Minute
	// iqProbeMaxHTMLBytes keeps one stored generation within a sane row size.
	iqProbeMaxHTMLBytes = 512 << 10
	// iqProbeMinBaseline is the number of earlier healthy results needed before
	// size comparisons are trusted.
	iqProbeMinBaseline = 4
	// A measurement below 25% of the reference is evidence on its own. Below
	// 50% it only counts together with another signal, because a randomly drawn
	// subject, scene and style legitimately differ in size.
	iqProbeSevereDropPercent = 25
	iqProbeMildDropPercent   = 50
)

// iqProbeAnimationMarkers cover SMIL, CSS (including vendor-prefixed
// keyframes), the Web Animations API and the common JS loops, so an unusual
// but real animation is not reported missing.
var iqProbeAnimationMarkers = []string{
	"<animate", "<set ", "<set>", "-keyframes", "animation:", "animation-name", "animation-duration",
	"transition:", "transition-duration", "requestanimationframe", "setinterval", "settimeout",
	"webgl", "gsap", "tween", ".animate(",
}

// iqProbePrompt is the prompt actually sent for one probe.
type iqProbePrompt struct {
	Title   string
	Content string
	// Code is the one-time verification code the generated page must contain.
	Code string
}

// drawIQProbePrompt fills the template with a random animal, scene and style
// and a fresh code, so an answer cannot be cached or prepared in advance.
func drawIQProbePrompt(config operation_setting.IQPromptConfig) iqProbePrompt {
	animal := strings.TrimSpace(lo.Sample(config.Animals))
	scene := strings.TrimSpace(lo.Sample(config.Scenes))
	style := strings.TrimSpace(lo.Sample(config.Styles))
	code := "IQ-" + rand.Text()[:8]
	content := strings.NewReplacer(
		"{{animal}}", animal, "{{scene}}", scene, "{{style}}", style,
		operation_setting.IQPromptCodePlaceholder, code,
	).Replace(strings.TrimSpace(config.Template))
	return iqProbePrompt{Title: strings.Join([]string{animal, scene, style}, " · "), Content: content, Code: code}
}

// applyIQProbePrompt turns a channel test request into an IQ generation with
// a bounded output budget. Thinking effort comes from the @effort modifier.
func applyIQProbePrompt(request dto.Request, testModel string, prompt string) error {
	maxTokens := common.GetPointer(uint(iqProbeMaxOutputTokens))
	switch req := request.(type) {
	case *dto.GeneralOpenAIRequest:
		req.Messages = []dto.Message{{Role: "user", Content: prompt}}
		req.MaxTokens = nil
		req.MaxCompletionTokens = nil
		if dto.IsOpenAIReasoningOModel(testModel) || dto.IsOpenAIGPT5Model(testModel) {
			req.MaxCompletionTokens = maxTokens
		} else {
			req.MaxTokens = maxTokens
		}
	case *dto.OpenAIResponsesRequest:
		input, err := common.Marshal([]map[string]string{{"role": "user", "content": prompt}})
		if err != nil {
			return err
		}
		req.Input = json.RawMessage(input)
		req.MaxOutputTokens = maxTokens
	case *dto.ClaudeRequest:
		req.Messages = []dto.ClaudeMessage{{Role: "user", Content: prompt}}
		req.MaxTokens = maxTokens
	case *dto.GeminiChatRequest:
		req.Contents = []dto.GeminiChatContent{{Role: "user", Parts: []dto.GeminiPart{{Text: prompt}}}}
		req.GenerationConfig.MaxOutputTokens = maxTokens
	default:
		return fmt.Errorf("IQ probe does not support request type %T", request)
	}
	return nil
}

// extractIQProbeText reads the generated text from a client-format response
// body. Streamed bodies are SSE; Responses streams carry text deltas.
func extractIQProbeText(body []byte, endpoint string) string {
	trimmed := bytes.TrimSpace(body)
	payloads := [][]byte{trimmed}
	if len(trimmed) > 0 && trimmed[0] != '{' {
		payloads = payloads[:0]
		for line := range bytes.SplitSeq(trimmed, []byte{'\n'}) {
			payload, ok := bytes.CutPrefix(bytes.TrimSpace(line), []byte("data:"))
			payload = bytes.TrimSpace(payload)
			if ok && len(payload) > 0 && !bytes.Equal(payload, []byte("[DONE]")) {
				payloads = append(payloads, payload)
			}
		}
	}
	var text, completed strings.Builder
	for _, payload := range payloads {
		switch constant.EndpointType(endpoint) {
		case constant.EndpointTypeOpenAIResponse:
			switch gjson.GetBytes(payload, "type").String() {
			case "response.output_text.delta":
				text.WriteString(gjson.GetBytes(payload, "delta").String())
			case "response.completed":
				completed.WriteString(responsesOutputText(gjson.GetBytes(payload, "response.output")))
			case "":
				completed.WriteString(responsesOutputText(gjson.GetBytes(payload, "output")))
			}
		case constant.EndpointTypeAnthropic:
			if gjson.GetBytes(payload, "type").String() == "content_block_delta" {
				if gjson.GetBytes(payload, "delta.type").String() == "text_delta" {
					text.WriteString(gjson.GetBytes(payload, "delta.text").String())
				}
				continue
			}
			for _, block := range gjson.GetBytes(payload, "content").Array() {
				if block.Get("type").String() == "text" {
					text.WriteString(block.Get("text").String())
				}
			}
		case constant.EndpointTypeGemini:
			for _, part := range gjson.GetBytes(payload, "candidates.0.content.parts").Array() {
				if !part.Get("thought").Bool() {
					text.WriteString(part.Get("text").String())
				}
			}
		default:
			text.WriteString(gjson.GetBytes(payload, "choices.0.message.content").String())
			text.WriteString(gjson.GetBytes(payload, "choices.0.delta.content").String())
		}
	}
	if text.Len() == 0 {
		return completed.String()
	}
	return text.String()
}

func responsesOutputText(output gjson.Result) string {
	var text strings.Builder
	for _, item := range output.Array() {
		if item.Get("type").String() != "message" {
			continue
		}
		for _, content := range item.Get("content").Array() {
			if content.Get("type").String() == "output_text" {
				text.WriteString(content.Get("text").String())
			}
		}
	}
	return text.String()
}

// extractIQProbeHTML takes the HTML document out of a model answer, which may
// wrap it in a Markdown fence or surround it with explanations.
func extractIQProbeHTML(text string) string {
	text = strings.TrimSpace(text)
	lower := strings.ToLower(text)
	if start := strings.Index(lower, "```html"); start >= 0 {
		body := text[start+len("```html"):]
		if end := strings.Index(body, "```"); end >= 0 {
			body = body[:end]
		}
		return strings.TrimSpace(body)
	}
	start := strings.Index(lower, "<!doctype")
	if start < 0 {
		start = strings.Index(lower, "<html")
	}
	if start < 0 {
		start = strings.Index(lower, "<svg")
	}
	if start < 0 {
		return text
	}
	end := len(text)
	// Closing tags may be omitted, so fall back to the outermost one present;
	// otherwise trailing explanations would be counted as page size.
	for _, closing := range []string{"</html>", "</body>", "</svg>"} {
		if idx := strings.LastIndex(lower, closing); idx >= start {
			end = idx + len(closing)
			break
		}
	}
	return strings.TrimSpace(text[start:end])
}

// iqProbeReference returns the upper quartile of past measurements. Judging
// against a high quantile instead of the median means a run of already shrunken
// results cannot drag the reference down and hide the degradation, while a
// single unusually large result still does not raise the bar.
func iqProbeReference(values []int) int {
	if len(values) == 0 {
		return 0
	}
	sorted := slices.Clone(values)
	slices.Sort(sorted)
	return sorted[(len(sorted)-1)*3/4]
}

// iqProbeDropLevel rates how far a measurement fell below the baseline:
// 0 no drop, 1 mild, 2 severe. Unusable values report no drop, so a channel
// that omits usage or a reasoning breakdown is not blamed for missing data.
func iqProbeDropLevel(current int, baseline int) int {
	if current <= 0 || baseline <= 0 {
		return 0
	}
	switch {
	case current*100 < baseline*iqProbeSevereDropPercent:
		return 2
	case current*100 < baseline*iqProbeMildDropPercent:
		return 1
	}
	return 0
}

// iqProbePageContainsCode reports whether the page shows code. Models split
// the code across text nodes, escape it, add separators or change its case, so
// entities are decoded, tags dropped and only letters and digits compared.
func iqProbePageContainsCode(html string, code string) bool {
	want := iqProbeAlnum(code)
	if want == "" {
		return true
	}
	decoded := stdhtml.UnescapeString(html)
	var text strings.Builder
	inTag := false
	for _, r := range decoded {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
		case !inTag && (unicode.IsLetter(r) || unicode.IsDigit(r)):
			text.WriteRune(unicode.ToLower(r))
		}
	}
	// Checking the decoded markup too keeps a code that only appears in an
	// attribute or a <title> recognized.
	return strings.Contains(text.String(), want) || strings.Contains(iqProbeAlnum(decoded), want)
}

func iqProbeAlnum(value string) string {
	var result strings.Builder
	for _, r := range value {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			result.WriteRune(unicode.ToLower(r))
		}
	}
	return result.String()
}

// iqProbeTruncated reports an answer that stopped mid-response. A missing
// </html> is not a defect because browsers render the page anyway, but an
// unfinished SVG, an opened <script>/<style> without its closing tag, or a
// dangling tag means the upstream cut the answer off.
func iqProbeTruncated(html string) bool {
	lower := strings.ToLower(html)
	if !strings.Contains(lower, "</svg>") {
		return true
	}
	// JS and CSS compare with < and > constantly, so their contents are removed
	// before looking for a dangling tag.
	rest, ok := iqProbeStripRawText(lower, "script")
	if !ok {
		return true
	}
	if rest, ok = iqProbeStripRawText(rest, "style"); !ok {
		return true
	}
	last := strings.LastIndexByte(rest, '<')
	if last < 0 || strings.LastIndexByte(rest, '>') > last {
		return false
	}
	// Text such as "2 < 3" does not open a tag, so it is not truncation.
	if last+1 >= len(rest) {
		return true
	}
	switch next := rest[last+1]; {
	case next == '/', next == '!', next == '?':
		return true
	case next >= 'a' && next <= 'z':
		return true
	}
	return false
}

// iqProbeStripRawText drops every <tag>…</tag> block. It reports false when an
// opened block has no closing tag.
func iqProbeStripRawText(html string, tag string) (string, bool) {
	var out strings.Builder
	rest := html
	closing := "</" + tag + ">"
	for {
		start := strings.Index(rest, "<"+tag)
		if start < 0 {
			out.WriteString(rest)
			return out.String(), true
		}
		end := strings.Index(rest[start:], closing)
		if end < 0 {
			return "", false
		}
		out.WriteString(rest[:start])
		rest = rest[start+end+len(closing):]
	}
}

// judgeIQProbe flags generations that are broken or far smaller than the
// recent history of the same group and model. It is a heuristic signal, not a
// quality score.
//
// The page size is the primary signal because it is what a reader actually
// sees. Token counts only corroborate it: channels report completion and
// reasoning tokens with different accounting, so a token drop alone is not
// evidence of degradation. A mild size drop needs that corroboration, while a
// severe drop or a missing animation stands on its own.
func judgeIQProbe(html string, code string, usage *dto.Usage, baseline []model.IQProbeResult) (string, []string) {
	lower := strings.ToLower(html)
	var invalid []string
	if !strings.Contains(lower, "<svg") {
		invalid = append(invalid, "no_svg")
	} else if iqProbeTruncated(html) {
		invalid = append(invalid, "truncated")
	}
	// A missing code means the page was not generated for this request.
	if code != "" && !iqProbePageContainsCode(html, code) {
		invalid = append(invalid, "code_missing")
	}
	if len(invalid) > 0 {
		return model.IQProbeVerdictInvalid, invalid
	}
	htmlDrop := 0
	tokenDrops := 0
	var dropped []string
	if len(baseline) >= iqProbeMinBaseline {
		htmlSizes := make([]int, 0, len(baseline))
		completions := make([]int, 0, len(baseline))
		reasonings := make([]int, 0, len(baseline))
		for _, item := range baseline {
			htmlSizes = append(htmlSizes, item.HTMLBytes)
			completions = append(completions, item.CompletionTokens)
			reasonings = append(reasonings, item.ReasoningTokens)
		}
		completionTokens, reasoningTokens := 0, 0
		if usage != nil {
			completionTokens = usage.CompletionTokens
			reasoningTokens = usage.CompletionTokenDetails.ReasoningTokens
		}
		htmlDrop = iqProbeDropLevel(len(html), iqProbeReference(htmlSizes))
		outputDrop := iqProbeDropLevel(completionTokens, iqProbeReference(completions))
		reasoningDrop := iqProbeDropLevel(reasoningTokens, iqProbeReference(reasonings))
		for _, item := range []struct {
			reason string
			level  int
		}{{"html_drop", htmlDrop}, {"output_drop", outputDrop}, {"reasoning_drop", reasoningDrop}} {
			if item.level > 0 {
				dropped = append(dropped, item.reason)
			}
		}
		// Reasoning tokens are already part of the completion count, so the two
		// are one measurement, not two.
		tokenDrops = max(outputDrop, reasoningDrop)
	}
	animated := slices.ContainsFunc(iqProbeAnimationMarkers, func(marker string) bool {
		return strings.Contains(lower, marker)
	})
	switch {
	case !animated:
		return model.IQProbeVerdictSuspect, append(dropped, "no_animation")
	case htmlDrop == 2:
		return model.IQProbeVerdictSuspect, dropped
	case htmlDrop == 1 && tokenDrops > 0:
		return model.IQProbeVerdictSuspect, dropped
	}
	return model.IQProbeVerdictNormal, nil
}

type iqProbeHandler struct{}

func (iqProbeHandler) Type() string  { return model.SystemTaskTypeIQProbe }
func (iqProbeHandler) Enabled() bool { return model.CurrentRequestPolicy().IQProbeEnabled }
func (iqProbeHandler) Interval() time.Duration {
	return operation_setting.ProbeInterval(model.CurrentRequestPolicy().IQProbeMinutes)
}
func (iqProbeHandler) NewPayload() any { return nil }

// iqProbeTaskPayload is empty for scheduled runs. A manual run may target one
// group and pool model; otherwise it probes every configured group once.
type iqProbeTaskPayload struct {
	Manual bool   `json:"manual,omitempty"`
	Group  string `json:"group,omitempty"`
	Model  string `json:"model,omitempty"`
}

type iqProbeState struct {
	Rotations map[string]*groupProbeRotation `json:"rotations"`
	Tested    int                            `json:"tested"`
	Succeeded int                            `json:"succeeded"`
	Failed    int                            `json:"failed"`
	Skipped   int                            `json:"skipped"`
}

// iqProbePools returns configured pools whose groups still exist.
func iqProbePools() map[string][]operation_setting.IQModelSpec {
	pools := operation_setting.IQGroupModelSpecs()
	for group := range pools {
		if !ratio_setting.ContainsGroupRatio(group) {
			delete(pools, group)
		}
	}
	return pools
}

func (iqProbeHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	payload := iqProbeTaskPayload{}
	if err := task.DecodePayload(&payload); err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	if !payload.Manual && !(iqProbeHandler{}).Enabled() {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, nil, nil)
		return
	}
	state := iqProbeState{}
	previous, err := model.GetPreviousSystemTask(task.Type, task.ID)
	if err == nil && previous != nil {
		err = previous.DecodeState(&state)
	}
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	if state.Rotations == nil {
		state.Rotations = map[string]*groupProbeRotation{}
	}
	state.Tested, state.Succeeded, state.Failed, state.Skipped = 0, 0, 0, 0
	promptConfig := operation_setting.IQPrompt()
	userID, err := resolveChannelTestUserID(nil)
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	pools := iqProbePools()
	poolNames := make(map[string][]string, len(pools))
	for group, specs := range pools {
		for _, spec := range specs {
			poolNames[group] = append(poolNames[group], spec.Name)
		}
	}
	groups := make([]string, 0, len(pools))
	for group := range pools {
		if payload.Group == "" || payload.Group == group {
			groups = append(groups, group)
		}
	}
	slices.Sort(groups)
	for _, group := range groups {
		if ctx.Err() != nil || (!payload.Manual && !(iqProbeHandler{}).Enabled()) {
			break
		}
		specs := pools[group]
		var spec operation_setting.IQModelSpec
		if payload.Model != "" {
			index := slices.IndexFunc(specs, func(item operation_setting.IQModelSpec) bool { return item.Name == payload.Model })
			if index < 0 {
				state.Skipped++
				continue
			}
			spec = specs[index]
		} else {
			rotation := state.Rotations[group]
			if rotation == nil {
				rotation = &groupProbeRotation{}
				state.Rotations[group] = rotation
			}
			name := rotation.Next(poolNames[group])
			spec = specs[slices.IndexFunc(specs, func(item operation_setting.IQModelSpec) bool { return item.Name == name })]
		}
		prompt := drawIQProbePrompt(promptConfig)
		// Persist before making a paid request so interruptions retain rotation.
		if err = model.UpdateSystemTaskState(task.TaskID, runnerID, state); err != nil {
			finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, state, err)
			return
		}
		source := "auto"
		if payload.Manual {
			source = "manual"
		}
		record := runIQProbeForGroup(ctx, userID, group, spec, prompt)
		if record == nil {
			state.Skipped++
			continue
		}
		record.Source = source
		state.Tested++
		if record.Success {
			state.Succeeded++
		} else {
			state.Failed++
		}
		if ctx.Err() != nil && !record.Success {
			// An interrupted run is not a model failure.
			break
		}
		if err = model.RecordIQProbeResult(record); err != nil {
			finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, state, err)
			return
		}
	}
	if _, err = model.DeleteStaleIQProbeResults(poolNames); err != nil {
		common.SysError("failed to delete stale IQ probe results: " + err.Error())
	}
	if err = model.UpdateSystemTaskState(task.TaskID, runnerID, state); err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, state, err)
		return
	}
	if ctx.Err() != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, state, ctx.Err())
		return
	}
	if state.Failed > 0 {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, state, fmt.Errorf("%d IQ probes failed", state.Failed))
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, state, nil)
}

// runIQProbeForGroup sends the prompt through up to iqProbeMaxChannelAttempts
// channels of the group. It returns nil when no channel can serve the model.
func runIQProbeForGroup(ctx context.Context, userID int, group string, spec operation_setting.IQModelSpec, prompt iqProbePrompt) *model.IQProbeResult {
	record := &model.IQProbeResult{
		GroupName: group, ModelName: spec.Name, Code: prompt.Code,
		PromptTitle: prompt.Title, Prompt: prompt.Content, Verdict: model.IQProbeVerdictFailed,
	}
	var triedChannelIDs []int
	attempted := false
	for ctx.Err() == nil && len(triedChannelIDs) < iqProbeMaxChannelAttempts {
		var filters []filterdto.ChannelFilter
		if len(triedChannelIDs) > 0 {
			filters = []filterdto.ChannelFilter{{Kind: filterdto.FilterExcludeChannels, ExcludeChannelIds: triedChannelIDs}}
		}
		channel, selectErr := model.GetRandomSatisfiedChannel(group, spec.BaseModel, 0, filters)
		if selectErr != nil || channel == nil {
			break
		}
		triedChannelIDs = append(triedChannelIDs, channel.Id)
		if channel.Type == constant.ChannelTypeTaskPlugin {
			continue
		}
		endpoint := channelProbeEndpoint(channel, spec.BaseModel)
		switch constant.EndpointType(endpoint) {
		case constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse, constant.EndpointTypeAnthropic, constant.EndpointTypeGemini:
		default:
			continue
		}
		attempted = true
		started := time.Now()
		probeCtx, cancel := context.WithTimeout(ctx, iqProbeTimeout)
		// Generations run for minutes; a non-stream request sends no bytes until
		// the end, so proxies in front of the upstream (Cloudflare 524) cut it off.
		result := runChannelTest(probeCtx, channel, userID, spec.RequestModel, endpoint, true, channelTestOptions{group: group, iqPrompt: prompt.Content})
		cancel()
		record.LatencyMs = time.Since(started).Milliseconds()
		if result.localErr != nil || result.newAPIError != nil {
			if result.newAPIError != nil {
				record.ErrorMessage = result.newAPIError.MaskSensitiveErrorWithStatusCode()
			} else {
				record.ErrorMessage = result.localErr.Error()
			}
			continue
		}
		html := extractIQProbeHTML(extractIQProbeText(result.responseBody, endpoint))
		baseline, err := model.GetIQProbeBaseline(group, spec.Name)
		if err != nil {
			common.SysError("failed to load IQ probe baseline: " + err.Error())
		}
		// Judge the whole answer before trimming it for storage: cutting first
		// would leave a dangling tag and report a complete generation as
		// truncated.
		verdict, reasons := judgeIQProbe(html, prompt.Code, result.usage, baseline)
		record.Success, record.ErrorMessage = true, ""
		record.Verdict, record.VerdictReasons = verdict, strings.Join(reasons, ",")
		// HTMLBytes keeps the full size so later probes compare like with like,
		// while the stored document is capped to keep the row small.
		record.HTMLBytes = len(html)
		record.HTML = model.LongText(html[:min(len(html), iqProbeMaxHTMLBytes)])
		if result.usage != nil {
			record.PromptTokens = result.usage.PromptTokens
			record.CompletionTokens = result.usage.CompletionTokens
			record.ReasoningTokens = result.usage.CompletionTokenDetails.ReasoningTokens
		}
		return record
	}
	if !attempted {
		return nil
	}
	return record
}
