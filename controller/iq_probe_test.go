package controller

import (
	"fmt"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestParseIQModelListConvertsThinkingLevelToEffortModifier(t *testing.T) {
	specs, err := operation_setting.ParseIQModelList(" gpt-6.1-sol[HIGH], claude-sonnet ,gpt-6.1-sol[high]")
	require.NoError(t, err)
	require.Len(t, specs, 2)
	assert.Equal(t, operation_setting.IQModelSpec{Name: "gpt-6.1-sol[high]", BaseModel: "gpt-6.1-sol", Effort: "high", RequestModel: "gpt-6.1-sol@effort:high"}, specs[0])
	assert.Equal(t, "claude-sonnet", specs[1].RequestModel)

	for _, raw := range []string{"gpt-5[ultra]", "gpt-5[high", "[high]", "gpt-5@effort:high"} {
		_, err := operation_setting.ParseIQModelSpec(raw)
		assert.Error(t, err, raw)
	}
}

func TestDrawIQProbePromptFillsTemplateWithOneTimeCode(t *testing.T) {
	config := operation_setting.IQPromptConfig{
		Template: "{{animal}} in {{scene}}, {{style}}. Title {{code}}, text {{code}}.",
		Animals:  []string{" fox "}, Scenes: []string{"space"}, Styles: []string{"pixel"},
	}
	first := drawIQProbePrompt(config)
	assert.Equal(t, "fox · space · pixel", first.Title)
	assert.Regexp(t, `^IQ-[A-Z2-7]{8}$`, first.Code)
	assert.Equal(t, "fox in space, pixel. Title "+first.Code+", text "+first.Code+".", first.Content)
	assert.NotEqual(t, first.Code, drawIQProbePrompt(config).Code, "every probe gets a new code")

	encoded, err := common.Marshal(operation_setting.DefaultIQPrompt())
	require.NoError(t, err)
	require.NoError(t, operation_setting.ValidateIQPrompt(string(encoded)))

	for _, invalid := range []string{
		`[]`,
		`{"template":"draw {{animal}}","animals":["fox"],"scenes":["space"],"styles":["pixel"]}`,
		`{"template":"{{code}}","animals":[],"scenes":["space"],"styles":["pixel"]}`,
		`{"template":"{{code}}","animals":["fox"],"scenes":[" "],"styles":["pixel"]}`,
	} {
		assert.Error(t, operation_setting.ValidateIQPrompt(invalid), invalid)
	}
}

func TestApplyIQProbePromptBoundsOutputTokens(t *testing.T) {
	request := buildTestRequest("gpt-5", string(constant.EndpointTypeOpenAI), nil, false)
	require.NoError(t, applyIQProbePrompt(request, "gpt-5", "draw"))
	chat := request.(*dto.GeneralOpenAIRequest)
	assert.Nil(t, chat.MaxTokens)
	require.NotNil(t, chat.MaxCompletionTokens)
	assert.Equal(t, uint(iqProbeMaxOutputTokens), *chat.MaxCompletionTokens)
	assert.Equal(t, "draw", chat.Messages[0].Content)

	claude := buildTestRequest("claude", string(constant.EndpointTypeAnthropic), nil, false)
	require.NoError(t, applyIQProbePrompt(claude, "claude", "draw"))
	assert.Equal(t, uint(iqProbeMaxOutputTokens), *claude.(*dto.ClaudeRequest).MaxTokens)

	// IQ probes always stream so long generations keep the upstream connection alive.
	streamed := buildTestRequest("gpt-5", string(constant.EndpointTypeOpenAI), nil, true)
	require.NoError(t, applyIQProbePrompt(streamed, "gpt-5", "draw"))
	streamedChat := streamed.(*dto.GeneralOpenAIRequest)
	assert.True(t, *streamedChat.Stream)
	require.NotNil(t, streamedChat.StreamOptions)
	assert.True(t, streamedChat.StreamOptions.IncludeUsage)
}

func TestExtractIQProbeHTMLFromProtocolResponses(t *testing.T) {
	page := "<!DOCTYPE html><html><body><svg><animate/></svg></body></html>"
	fenced, err := common.Marshal(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": "Here:\n```html\n" + page + "\n```\nDone"}}}})
	require.NoError(t, err)
	assert.Equal(t, page, extractIQProbeHTML(extractIQProbeText(fenced, string(constant.EndpointTypeOpenAI))))

	stream := "event: response.output_text.delta\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"<svg><rect/>\"}\n\n" +
		"data: {\"type\":\"response.output_text.delta\",\"delta\":\"</svg> ok\"}\n\n" +
		"data: {\"type\":\"response.completed\",\"response\":{\"output\":[]}}\n\n"
	assert.Equal(t, "<svg><rect/></svg>", extractIQProbeHTML(extractIQProbeText([]byte(stream), string(constant.EndpointTypeOpenAIResponse))))

	claude := `{"content":[{"type":"thinking","thinking":"plan"},{"type":"text","text":"<html><svg></svg></html>"}]}`
	assert.Equal(t, "<html><svg></svg></html>", extractIQProbeHTML(extractIQProbeText([]byte(claude), string(constant.EndpointTypeAnthropic))))

	streams := map[constant.EndpointType]string{
		constant.EndpointTypeOpenAI: `: PING

data: {"choices":[{"delta":{"role":"assistant"}}]}

data: {"choices":[{"delta":{"reasoning_content":"plan"}}]}

data: {"choices":[{"delta":{"content":"<svg>"}}]}

data: {"choices":[{"delta":{"content":"</svg>"}}]}

data: [DONE]
`,
		constant.EndpointTypeAnthropic: `event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"plan"}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"<svg></svg>"}}
`,
		constant.EndpointTypeGemini: `data: {"candidates":[{"content":{"parts":[{"text":"plan","thought":true}]}}]}

data: {"candidates":[{"content":{"parts":[{"text":"<svg>"}]}}]}

data: {"candidates":[{"content":{"parts":[{"text":"</svg>"}]}}]}
`,
	}
	for endpoint, body := range streams {
		assert.Equal(t, "<svg></svg>", extractIQProbeHTML(extractIQProbeText([]byte(body), string(endpoint))), endpoint)
	}
}

func TestJudgeIQProbeFlagsBrokenAndShrunkOutputs(t *testing.T) {
	animated := "<html><svg><animate/></svg></html>"
	verdict, reasons := judgeIQProbe("<html>no drawing</html>", "", nil, nil)
	assert.Equal(t, model.IQProbeVerdictInvalid, verdict)
	assert.Equal(t, []string{"no_svg"}, reasons)

	verdict, reasons = judgeIQProbe("<html><svg><rect/>", "", nil, nil)
	assert.Equal(t, model.IQProbeVerdictInvalid, verdict)
	assert.Equal(t, []string{"truncated"}, reasons)

	verdict, _ = judgeIQProbe(animated, "", &dto.Usage{CompletionTokens: 10}, nil)
	assert.Equal(t, model.IQProbeVerdictNormal, verdict, "no baseline means no size comparison")

	verdict, reasons = judgeIQProbe(animated, "IQ-ABCD2345", nil, nil)
	assert.Equal(t, model.IQProbeVerdictInvalid, verdict)
	assert.Equal(t, []string{"code_missing"}, reasons)
	verdict, _ = judgeIQProbe("<html><title>IQ-ABCD2345</title><svg><animate/></svg></html>", "IQ-ABCD2345", nil, nil)
	assert.Equal(t, model.IQProbeVerdictNormal, verdict)

	// A page without </html> is a valid answer from most models, and the code
	// may be split across text nodes, escaped, or written in another case.
	verdict, _ = judgeIQProbe("<svg><animate/></svg>", "", nil, nil)
	assert.Equal(t, model.IQProbeVerdictNormal, verdict, "a missing </html> is not truncation")
	verdict, _ = judgeIQProbe(
		"<html><svg><animate/><text>IQ&#45;AB<span>CD</span>2345</text></svg></html>",
		"IQ-ABCD2345", nil, nil,
	)
	assert.Equal(t, model.IQProbeVerdictNormal, verdict, "the code may be escaped and split")
	verdict, _ = judgeIQProbe("<html><svg><animate/><text>iq-abcd2345</text></svg></html>", "IQ-ABCD2345", nil, nil)
	assert.Equal(t, model.IQProbeVerdictNormal, verdict, "code comparison ignores case")

	// Only an unfinished document counts as truncation.
	verdict, reasons = judgeIQProbe("<html><svg><animate/></svg></html><div", "", nil, nil)
	assert.Equal(t, model.IQProbeVerdictInvalid, verdict, "a dangling tag is truncation")
	assert.Equal(t, []string{"truncated"}, reasons)
	verdict, reasons = judgeIQProbe("<html><svg><animate/></svg><script>draw()", "", nil, nil)
	assert.Equal(t, model.IQProbeVerdictInvalid, verdict, "an unclosed script is truncation")
	assert.Equal(t, []string{"truncated"}, reasons)
	verdict, _ = judgeIQProbe("<html><svg><animate/></svg><script>if (2 < 3 && 5 > 4) draw()</script></html>", "", nil, nil)
	assert.Equal(t, model.IQProbeVerdictNormal, verdict, "comparisons inside a closed script are not truncation")
	verdict, _ = judgeIQProbe("<html><svg><animate/></svg><p>2 < 3</p></html>", "", nil, nil)
	assert.Equal(t, model.IQProbeVerdictNormal, verdict, "text with a less-than sign is not truncation")

	baseline := []model.IQProbeResult{
		{HTMLBytes: 8000, CompletionTokens: 4000, ReasoningTokens: 2000},
		{HTMLBytes: 9000, CompletionTokens: 5000, ReasoningTokens: 2400},
		{HTMLBytes: 10000, CompletionTokens: 6000, ReasoningTokens: 2600},
		{HTMLBytes: 11000, CompletionTokens: 7000, ReasoningTokens: 2800},
	}
	usage := &dto.Usage{CompletionTokens: 1000}
	usage.CompletionTokenDetails.ReasoningTokens = 100
	verdict, reasons = judgeIQProbe(animated, "", usage, baseline)
	assert.Equal(t, model.IQProbeVerdictSuspect, verdict)
	assert.Equal(t, []string{"html_drop", "output_drop", "reasoning_drop"}, reasons)

	// A single mild drop is normal variation for a randomly drawn subject.
	// The baseline references are 10000 HTML bytes, 6000 output and 2600
	// reasoning tokens, so a 4000-byte page is mild and 3000 output tokens are
	// not a drop at all.
	mildPage := animated + strings.Repeat("x", 4000-len(animated))
	usage = &dto.Usage{CompletionTokens: 3000}
	usage.CompletionTokenDetails.ReasoningTokens = 2400
	verdict, reasons = judgeIQProbe(mildPage, "", usage, baseline)
	assert.Equal(t, model.IQProbeVerdictNormal, verdict, "one mild drop alone is not degradation")
	assert.Empty(t, reasons)

	// Token counts differ between channels, so a token drop only corroborates a
	// visible symptom; a complete page of normal size stays normal.
	fullPage := animated + strings.Repeat("x", 9000-len(animated))
	verdict, _ = judgeIQProbe(fullPage, "", &dto.Usage{CompletionTokens: 1000}, baseline)
	assert.Equal(t, model.IQProbeVerdictNormal, verdict, "a token drop alone is not degradation")

	// A mild size drop corroborated by a token drop is suspect.
	usage = &dto.Usage{CompletionTokens: 3000}
	usage.CompletionTokenDetails.ReasoningTokens = 900
	verdict, reasons = judgeIQProbe(mildPage, "", usage, baseline)
	assert.Equal(t, model.IQProbeVerdictSuspect, verdict, "a mild drop needs corroboration")
	assert.Equal(t, []string{"html_drop", "reasoning_drop"}, reasons)

	// A channel that omits reasoning tokens must not be blamed for it.
	verdict, reasons = judgeIQProbe(mildPage, "", &dto.Usage{CompletionTokens: 3000}, baseline)
	assert.Equal(t, model.IQProbeVerdictNormal, verdict, "missing usage detail is not a drop")
	assert.Empty(t, reasons)

	// History below the minimum is not a baseline yet.
	verdict, _ = judgeIQProbe(animated, "", &dto.Usage{CompletionTokens: 10}, baseline[:iqProbeMinBaseline-1])
	assert.Equal(t, model.IQProbeVerdictNormal, verdict)
}

func TestRecordIQProbeResultKeepsLatestHistoryPerGroupModel(t *testing.T) {
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = oldDB
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	require.NoError(t, db.AutoMigrate(&model.IQProbeResult{}))

	for i := range model.IQProbeHistoryLimit + 3 {
		require.NoError(t, model.RecordIQProbeResult(&model.IQProbeResult{GroupName: "vip", ModelName: "gpt-5[high]", CreatedAt: int64(1000 + i), HTML: "<svg></svg>"}))
	}
	require.NoError(t, model.RecordIQProbeResult(&model.IQProbeResult{GroupName: "default", ModelName: "gpt-5[high]", CreatedAt: 1}))

	histories, err := model.GetIQProbeHistories([]string{"vip", "default"})
	require.NoError(t, err)
	require.Len(t, histories, model.IQProbeHistoryLimit+1)
	assert.Equal(t, int64(1000+model.IQProbeHistoryLimit+2), histories[0].CreatedAt)
	assert.Empty(t, histories[0].HTML, "list queries must not load generated HTML")

	deleted, err := model.DeleteStaleIQProbeResults(map[string][]string{"vip": {"gpt-5[high]"}})
	require.NoError(t, err)
	assert.Equal(t, int64(1), deleted)

	summary, err := model.GetIQProbeResultSummary(histories[1].ID)
	require.NoError(t, err)
	assert.Empty(t, summary.HTML, "the delete lookup must not load generated HTML")

	removed, err := model.DeleteIQProbeResult(histories[1].ID)
	require.NoError(t, err)
	assert.True(t, removed)
	_, err = model.GetIQProbeResult(histories[1].ID)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)

	removed, err = model.DeleteIQProbeResult(histories[1].ID)
	require.NoError(t, err)
	assert.False(t, removed, "deleting a missing result must not report success")
}

func TestGetIQProbeBaselineUsesOnlyRecentHealthyResults(t *testing.T) {
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = oldDB
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	require.NoError(t, db.AutoMigrate(&model.IQProbeResult{}))

	now := time.Now().Unix()
	rows := []model.IQProbeResult{
		{GroupName: "vip", ModelName: "gpt-5", Success: true, Verdict: model.IQProbeVerdictNormal, HTMLBytes: 9000, CreatedAt: now},
		{GroupName: "vip", ModelName: "gpt-5", Success: true, Verdict: model.IQProbeVerdictSuspect, HTMLBytes: 1000, CreatedAt: now},
		{GroupName: "vip", ModelName: "gpt-5", Success: true, Verdict: model.IQProbeVerdictInvalid, HTMLBytes: 10, CreatedAt: now},
		{GroupName: "vip", ModelName: "gpt-5", Success: false, Verdict: model.IQProbeVerdictFailed, HTMLBytes: 0, CreatedAt: now},
		// Older than the window: a previous model generation.
		{GroupName: "vip", ModelName: "gpt-5", Success: true, Verdict: model.IQProbeVerdictNormal, HTMLBytes: 500, CreatedAt: now - model.IQProbeBaselineWindowSeconds - 1},
		{GroupName: "vip", ModelName: "other", Success: true, Verdict: model.IQProbeVerdictNormal, HTMLBytes: 2000, CreatedAt: now},
	}
	require.NoError(t, db.Create(&rows).Error)

	baseline, err := model.GetIQProbeBaseline("vip", "gpt-5")
	require.NoError(t, err)
	require.Len(t, baseline, 2, "failed and invalid rows are not comparable")
	sizes := []int{baseline[0].HTMLBytes, baseline[1].HTMLBytes}
	slices.Sort(sizes)
	assert.Equal(t, []int{1000, 9000}, sizes)
}

func TestRequestPolicyValidatesProbeIntervals(t *testing.T) {
	policy, err := model.BuildRequestPolicy(map[string]string{"monitor_setting.auto_probe_minutes": "45", "monitor_setting.iq_probe_enabled": "true"})
	require.NoError(t, err)
	assert.Equal(t, 45.0, policy.AutoProbeMinutes)
	assert.Equal(t, float64(operation_setting.DefaultProbeMinutes), policy.IQProbeMinutes)
	assert.True(t, policy.IQProbeEnabled)

	for _, value := range []string{"0", "-5", "abc", "NaN"} {
		_, err := model.BuildRequestPolicy(map[string]string{"monitor_setting.iq_probe_minutes": value})
		assert.Error(t, err, value)
	}
}
