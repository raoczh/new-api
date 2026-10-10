package model

import (
	"testing"

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
