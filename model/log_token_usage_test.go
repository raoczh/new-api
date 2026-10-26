package model

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserHourlyTokenUsageSplitsCacheTokensBySemantic(t *testing.T) {
	truncateTables(t)

	logs := []Log{
		// OpenAI semantic: prompt_tokens includes cached tokens.
		{UserId: 1, Type: LogTypeConsume, CreatedAt: 7200 + 10, PromptTokens: 1000, CompletionTokens: 50,
			Other: `{"cache_tokens":300}`},
		// Anthropic semantic: prompt_tokens already excludes cache read/creation.
		{UserId: 1, Type: LogTypeConsume, CreatedAt: 7200 + 20, PromptTokens: 200, CompletionTokens: 30,
			Other: `{"claude":true,"cache_tokens":400,"cache_creation_tokens":100}`},
		// Split 5m/1h cache creation without the total field.
		{UserId: 1, Type: LogTypeConsume, CreatedAt: 3600 + 5, PromptTokens: 10, CompletionTokens: 5,
			Other: `{"usage_semantic":"anthropic","cache_creation_tokens_5m":20,"cache_creation_tokens_1h":30}`},
		// Claude upstream converted to OpenAI semantic: usage_semantic wins over claude.
		{UserId: 1, Type: LogTypeConsume, CreatedAt: 3600 + 7, PromptTokens: 1000, CompletionTokens: 2,
			Other: `{"claude":true,"usage_semantic":"openai","cache_tokens":600,"cache_creation_tokens":100}`},
		// Malformed metadata keeps raw token counts.
		{UserId: 1, Type: LogTypeConsume, CreatedAt: 3600 + 6, PromptTokens: 7, CompletionTokens: 3, Other: `not-json`},
		// Excluded: other user, error log, outside window.
		{UserId: 2, Type: LogTypeConsume, CreatedAt: 7200, PromptTokens: 999},
		{UserId: 1, Type: LogTypeError, CreatedAt: 7200, PromptTokens: 999},
		{UserId: 1, Type: LogTypeConsume, CreatedAt: 20000, PromptTokens: 999},
	}
	for i := range logs {
		require.NoError(t, LOG_DB.Create(&logs[i]).Error)
	}

	usage, err := GetUserHourlyTokenUsage(1, 3600, 10799)
	require.NoError(t, err)
	require.Len(t, usage, 2)

	assert.Equal(t, HourlyTokenUsage{
		CreatedAt: 3600, RequestCount: 3,
		InputTokens: 17 + 300, OutputTokens: 10, CacheCreationTokens: 150, CacheReadTokens: 600,
	}, usage[0])
	assert.Equal(t, HourlyTokenUsage{
		CreatedAt: 7200, RequestCount: 2,
		InputTokens: 700 + 200, OutputTokens: 80, CacheCreationTokens: 100, CacheReadTokens: 700,
	}, usage[1])
}

func TestGetHourlyTokenUsageAggregatesEveryUser(t *testing.T) {
	truncateTables(t)

	logs := []Log{
		{UserId: 1, Username: "alice", Type: LogTypeConsume, CreatedAt: 3600 + 10, ModelName: "gpt-a", PromptTokens: 100, CompletionTokens: 10, Quota: 30},
		{UserId: 2, Username: "bob", Type: LogTypeConsume, CreatedAt: 3600 + 20, ModelName: "gpt-a", PromptTokens: 200, CompletionTokens: 20, Quota: 20},
		{UserId: 2, Username: "bob", Type: LogTypeError, CreatedAt: 3600 + 30, ModelName: "gpt-a", PromptTokens: 999},
	}
	for i := range logs {
		require.NoError(t, LOG_DB.Create(&logs[i]).Error)
	}

	usage, err := GetHourlyTokenUsage(3600, 7199)
	require.NoError(t, err)
	require.Len(t, usage, 1)
	assert.Equal(t, HourlyTokenUsage{
		CreatedAt: 3600, RequestCount: 2,
		InputTokens: 300, OutputTokens: 30,
	}, usage[0])

	distribution, err := GetModelDistribution(3600, 7199)
	require.NoError(t, err)
	require.Len(t, distribution, 1)
	assert.Equal(t, ModelUsageSummary{
		ModelName: "gpt-a", RequestCount: 2, TotalTokens: 330, ActualCost: 50,
	}, distribution[0])
}

// The dashboard's quota_data token total must use the same non-overlapping
// definition as the raw-log charts; otherwise the two admin views disagree.
func TestRecordConsumeLogWritesNormalizedTokensToQuotaData(t *testing.T) {
	truncateTables(t)
	resetQuotaDataCache(t)
	gin.SetMode(gin.TestMode)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("username", "alice")

	openAIOther := NewLogOther()
	openAIOther.SetPublic("cache_tokens", 300)
	openAIOther.SetPublic("cache_creation_tokens", 100)
	openAIOther.SetPublic("cache_write_tokens", 100)
	RecordConsumeLog(ctx, 1, RecordConsumeLogParams{
		ModelName:        "gpt-a",
		PromptTokens:     1000,
		CompletionTokens: 50,
		Quota:            120,
		Group:            "default",
		Other:            openAIOther,
	})

	// Anthropic semantics keep cache tokens out of prompt_tokens, so the total
	// must add them back instead of reporting prompt + completion only.
	anthropicOther := NewLogOther()
	anthropicOther.SetPublic("claude", true)
	anthropicOther.SetPublic("usage_semantic", "anthropic")
	anthropicOther.SetPublic("cache_tokens", 300)
	anthropicOther.SetPublic("cache_creation_tokens_5m", 60)
	anthropicOther.SetPublic("cache_creation_tokens_1h", 40)
	RecordConsumeLog(ctx, 1, RecordConsumeLogParams{
		ModelName:        "claude-a",
		PromptTokens:     200,
		CompletionTokens: 30,
		Quota:            80,
		Group:            "default",
		Other:            anthropicOther,
	})

	SaveQuotaDataCache()

	var rows []QuotaData
	require.NoError(t, DB.Order("model_name").Find(&rows).Error)
	require.Len(t, rows, 2)
	assert.Equal(t, "claude-a", rows[0].ModelName)
	assert.Equal(t, 1, rows[0].Count)
	assert.Equal(t, 630, rows[0].TokenUsed)
	assert.Equal(t, int64(300), rows[0].CacheReadTokens)
	assert.Equal(t, int64(100), rows[0].CacheCreationTokens)
	assert.Equal(t, "gpt-a", rows[1].ModelName)
	assert.Equal(t, 1, rows[1].Count)
	assert.Equal(t, 120, rows[1].Quota)
	assert.Equal(t, 1050, rows[1].TokenUsed)
}

// Task settlement and refunds correct the bucket created at submission: they
// must not add a request count, and refunds must reverse both quota and tokens.
func TestRecordTaskBillingLogAdjustsExistingQuotaDataBucket(t *testing.T) {
	truncateTables(t)
	resetQuotaDataCache(t)
	gin.SetMode(gin.TestMode)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	ctx.Set("username", "alice")
	// Submission: the task has no token split yet, so only quota and count land.
	RecordConsumeLog(ctx, 1, RecordConsumeLogParams{
		ModelName: "gpt-a",
		Quota:     100,
		Group:     "default",
		Other:     NewLogOther(),
	})
	// Completion backfills the token total, then a refund reverses part of it.
	// Both adjustments target the submission hour so they land in one bucket.
	now := common.GetTimestamp()
	submittedAt := now - now%3600
	RecordTaskBillingLog(RecordTaskBillingLogParams{
		UserId:        1,
		LogType:       LogTypeConsume,
		ModelName:     "gpt-a",
		Quota:         0,
		Group:         "default",
		Other:         NewLogOther(),
		StatCreatedAt: submittedAt,
		StatTokenUsed: 60,
	})
	RecordTaskBillingLog(RecordTaskBillingLogParams{
		UserId:        1,
		LogType:       LogTypeRefund,
		ModelName:     "gpt-a",
		Quota:         40,
		Group:         "default",
		Other:         NewLogOther(),
		StatCreatedAt: submittedAt,
		StatTokenUsed: 20,
	})
	SaveQuotaDataCache()

	var rows []QuotaData
	require.NoError(t, DB.Find(&rows).Error)
	require.Len(t, rows, 1)
	assert.Equal(t, 1, rows[0].Count, "refunds must not create a request of their own")
	assert.Equal(t, 60, rows[0].Quota)
	assert.Equal(t, 40, rows[0].TokenUsed)
}
