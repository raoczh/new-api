package model

import (
	"errors"
	"slices"

	"github.com/QuantumNous/new-api/common"
)

// HourlyTokenUsage is one hour of a user's consume-log token usage, split by
// prompt cache category. InputTokens excludes cache reads and cache creation
// so the four token fields never overlap.
type HourlyTokenUsage struct {
	CreatedAt           int64 `json:"created_at"`
	RequestCount        int64 `json:"request_count"`
	InputTokens         int64 `json:"input_tokens"`
	OutputTokens        int64 `json:"output_tokens"`
	CacheCreationTokens int64 `json:"cache_creation_tokens"`
	CacheReadTokens     int64 `json:"cache_read_tokens"`
}

type tokenUsageLogRow struct {
	CreatedAt        int64
	PromptTokens     int
	CompletionTokens int
	Other            string
}

type tokenUsageLogOther struct {
	Claude              bool   `json:"claude"`
	UsageSemantic       string `json:"usage_semantic"`
	CacheTokens         int    `json:"cache_tokens"`
	CacheCreationTokens int    `json:"cache_creation_tokens"`
	CacheCreation5m     int    `json:"cache_creation_tokens_5m"`
	CacheCreation1h     int    `json:"cache_creation_tokens_1h"`
}

// tokenUsageSplit is one consume log's token usage with the prompt cache
// categories separated from ordinary input.
type tokenUsageSplit struct {
	inputTokens         int64
	outputTokens        int64
	cacheCreationTokens int64
	cacheReadTokens     int64
}

func (s tokenUsageSplit) total() int64 {
	return s.inputTokens + s.outputTokens + s.cacheCreationTokens + s.cacheReadTokens
}

// splitLogTokenUsage separates a consume log's prompt cache tokens from its
// input tokens. Anthropic-semantic logs already store prompt_tokens without
// cache tokens; OpenAI-semantic logs include them, so they are subtracted for
// those rows. An explicit usage_semantic wins over the claude flag, which only
// marks the upstream request format and is also set on OpenAI-semantic logs
// converted from Claude. Malformed metadata only loses the cache split for
// that row.
func splitLogTokenUsage(row tokenUsageLogRow) tokenUsageSplit {
	var other tokenUsageLogOther
	if row.Other != "" {
		_ = common.UnmarshalJsonStr(row.Other, &other)
	}
	cacheRead := int64(max(other.CacheTokens, 0))
	cacheCreation := int64(max(other.CacheCreationTokens, other.CacheCreation5m+other.CacheCreation1h, 0))
	input := int64(max(row.PromptTokens, 0))
	anthropicSemantic := other.Claude
	if other.UsageSemantic != "" {
		anthropicSemantic = other.UsageSemantic == "anthropic"
	}
	if !anthropicSemantic {
		input = max(input-cacheRead-cacheCreation, 0)
	}
	return tokenUsageSplit{
		inputTokens:         input,
		outputTokens:        int64(max(row.CompletionTokens, 0)),
		cacheCreationTokens: cacheCreation,
		cacheReadTokens:     cacheRead,
	}
}

// GetUserHourlyTokenUsage aggregates a user's consume logs into hourly buckets.
func GetUserHourlyTokenUsage(userId int, startTimestamp int64, endTimestamp int64) ([]HourlyTokenUsage, error) {
	rows, err := LOG_DB.Table("logs").
		Select("created_at, prompt_tokens, completion_tokens, other").
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at <= ?",
			userId, LogTypeConsume, startTimestamp, endTimestamp).
		Rows()
	if err != nil {
		common.SysError("failed to query token usage logs: " + err.Error())
		return nil, errors.New("查询 Token 用量失败")
	}
	defer rows.Close()

	buckets := map[int64]*HourlyTokenUsage{}
	order := make([]int64, 0, 24)
	for rows.Next() {
		var row tokenUsageLogRow
		if err := LOG_DB.ScanRows(rows, &row); err != nil {
			common.SysError("failed to scan token usage log: " + err.Error())
			return nil, errors.New("查询 Token 用量失败")
		}

		split := splitLogTokenUsage(row)

		hour := row.CreatedAt - row.CreatedAt%3600
		bucket, ok := buckets[hour]
		if !ok {
			bucket = &HourlyTokenUsage{CreatedAt: hour}
			buckets[hour] = bucket
			order = append(order, hour)
		}
		bucket.RequestCount++
		bucket.InputTokens += split.inputTokens
		bucket.OutputTokens += split.outputTokens
		bucket.CacheCreationTokens += split.cacheCreationTokens
		bucket.CacheReadTokens += split.cacheReadTokens
	}
	if err := rows.Err(); err != nil {
		common.SysError("failed to iterate token usage logs: " + err.Error())
		return nil, errors.New("查询 Token 用量失败")
	}

	slices.Sort(order)
	result := make([]HourlyTokenUsage, 0, len(order))
	for _, hour := range order {
		result = append(result, *buckets[hour])
	}
	return result, nil
}
