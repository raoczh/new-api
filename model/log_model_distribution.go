package model

import (
	"errors"
	"slices"

	"github.com/QuantumNous/new-api/common"
)

// ModelUsageSummary is one model's consume-log totals for a user inside a time
// window. ActualCost is in quota units, the unit stored on the log row.
type ModelUsageSummary struct {
	ModelName    string `json:"model_name"`
	RequestCount int64  `json:"request_count"`
	TotalTokens  int64  `json:"total_tokens"`
	ActualCost   int64  `json:"actual_cost"`
}

type modelUsageLogRow struct {
	ModelName        string
	PromptTokens     int
	CompletionTokens int
	Quota            int
	Other            string
}

// GetUserModelDistribution aggregates a user's consume logs per model, ordered
// by request count so callers can show the most used models first.
func GetUserModelDistribution(userId int, startTimestamp int64, endTimestamp int64) ([]ModelUsageSummary, error) {
	rows, err := LOG_DB.Table("logs").
		Select("model_name, prompt_tokens, completion_tokens, quota, other").
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at <= ?",
			userId, LogTypeConsume, startTimestamp, endTimestamp).
		Rows()
	if err != nil {
		common.SysError("failed to query model distribution logs: " + err.Error())
		return nil, errors.New("查询模型用量失败")
	}
	defer rows.Close()

	totals := map[string]*ModelUsageSummary{}
	for rows.Next() {
		var row modelUsageLogRow
		if err := LOG_DB.ScanRows(rows, &row); err != nil {
			common.SysError("failed to scan model distribution log: " + err.Error())
			return nil, errors.New("查询模型用量失败")
		}

		summary, ok := totals[row.ModelName]
		if !ok {
			summary = &ModelUsageSummary{ModelName: row.ModelName}
			totals[row.ModelName] = summary
		}
		split := splitLogTokenUsage(tokenUsageLogRow{
			PromptTokens:     row.PromptTokens,
			CompletionTokens: row.CompletionTokens,
			Other:            row.Other,
		})
		summary.RequestCount++
		summary.TotalTokens += split.total()
		summary.ActualCost += int64(max(row.Quota, 0))
	}
	if err := rows.Err(); err != nil {
		common.SysError("failed to iterate model distribution logs: " + err.Error())
		return nil, errors.New("查询模型用量失败")
	}

	result := make([]ModelUsageSummary, 0, len(totals))
	for _, summary := range totals {
		result = append(result, *summary)
	}
	slices.SortFunc(result, func(a, b ModelUsageSummary) int {
		return int(b.RequestCount - a.RequestCount)
	})
	return result, nil
}
