package model

import (
	"slices"
	"time"
)

// IQProbeHistoryLimit is the number of results kept per group and model.
const IQProbeHistoryLimit = 20

// IQProbeBaselineWindowSeconds bounds how far back a healthy result still
// counts as a comparison point, so outputs from an earlier model generation
// do not keep distorting the baseline.
const IQProbeBaselineWindowSeconds = 7 * 24 * 60 * 60

const (
	IQProbeVerdictNormal  = "normal"
	IQProbeVerdictSuspect = "suspect"
	IQProbeVerdictInvalid = "invalid"
	IQProbeVerdictFailed  = "failed"
)

// IQProbeResult stores one IQ monitor generation. Channel identity is not
// stored because the public page only reports groups and models.
type IQProbeResult struct {
	ID               int64    `json:"id" gorm:"primaryKey"`
	GroupName        string   `json:"group_name" gorm:"size:64;index:idx_iq_probe_group_model_ts,priority:1"`
	ModelName        string   `json:"model_name" gorm:"size:191;index:idx_iq_probe_group_model_ts,priority:2"`
	Code             string   `json:"code" gorm:"size:32"`
	PromptTitle      string   `json:"prompt_title" gorm:"size:255"`
	Prompt           string   `json:"prompt,omitempty" gorm:"type:text"`
	Source           string   `json:"source" gorm:"size:16"`
	Success          bool     `json:"success"`
	Verdict          string   `json:"verdict" gorm:"size:16"`
	VerdictReasons   string   `json:"verdict_reasons" gorm:"size:255"`
	ErrorMessage     string   `json:"error_message" gorm:"type:text"`
	HTML             LongText `json:"html,omitempty"`
	HTMLBytes        int      `json:"html_bytes"`
	LatencyMs        int64    `json:"latency_ms"`
	PromptTokens     int      `json:"prompt_tokens"`
	CompletionTokens int      `json:"completion_tokens"`
	ReasoningTokens  int      `json:"reasoning_tokens"`
	CreatedAt        int64    `json:"created_at" gorm:"index:idx_iq_probe_group_model_ts,priority:3;index"`
}

// iqProbeSummaryColumns omits the prompt and generated HTML from list queries.
var iqProbeSummaryColumns = []string{
	"id", "group_name", "model_name", "code", "prompt_title", "source", "success",
	"verdict", "verdict_reasons", "error_message", "html_bytes", "latency_ms",
	"prompt_tokens", "completion_tokens", "reasoning_tokens", "created_at",
}

// RecordIQProbeResult inserts a result and trims older rows for the same
// group and model beyond IQProbeHistoryLimit.
func RecordIQProbeResult(result *IQProbeResult) error {
	if err := DB.Create(result).Error; err != nil {
		return err
	}
	var keepIDs []int64
	if err := DB.Model(&IQProbeResult{}).
		Where("group_name = ? AND model_name = ?", result.GroupName, result.ModelName).
		Order("created_at desc, id desc").Limit(IQProbeHistoryLimit).
		Pluck("id", &keepIDs).Error; err != nil {
		return err
	}
	if len(keepIDs) < IQProbeHistoryLimit {
		return nil
	}
	return DB.Where("group_name = ? AND model_name = ? AND id NOT IN ?", result.GroupName, result.ModelName, keepIDs).
		Delete(&IQProbeResult{}).Error
}

// GetIQProbeBaseline returns recent successful results used to judge a new
// result against the same group and model. Only normal results count: failed
// and invalid ones carry no usable measurements, and suspect ones would let a
// sustained degradation pull the reference down until it looks normal again.
// Results older than IQProbeBaselineWindowSeconds are ignored because the
// group model may have changed since.
func GetIQProbeBaseline(groupName string, modelName string) ([]IQProbeResult, error) {
	results := []IQProbeResult{}
	err := DB.Select("html_bytes", "completion_tokens", "reasoning_tokens").
		Where("group_name = ? AND model_name = ? AND success = ? AND verdict = ? AND created_at >= ?",
			groupName, modelName, true, IQProbeVerdictNormal, time.Now().Unix()-IQProbeBaselineWindowSeconds).
		Order("created_at desc, id desc").Limit(IQProbeHistoryLimit).
		Find(&results).Error
	return results, err
}

// GetIQProbeHistories returns result summaries for the given groups, newest
// first, capped per group and model by the retention cleanup.
func GetIQProbeHistories(groups []string) ([]IQProbeResult, error) {
	results := []IQProbeResult{}
	if len(groups) == 0 {
		return results, nil
	}
	err := DB.Select(iqProbeSummaryColumns).Where("group_name IN ?", groups).
		Order("created_at desc, id desc").Find(&results).Error
	return results, err
}

func GetIQProbeResult(id int64) (*IQProbeResult, error) {
	result := &IQProbeResult{}
	if err := DB.First(result, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return result, nil
}

// GetIQProbeResultSummary loads one result without its generated HTML.
func GetIQProbeResultSummary(id int64) (*IQProbeResult, error) {
	result := &IQProbeResult{}
	if err := DB.Select(iqProbeSummaryColumns).First(result, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return result, nil
}

// DeleteIQProbeResult removes one stored result. It reports false when the row
// no longer exists, so a repeated delete is not treated as success.
func DeleteIQProbeResult(id int64) (bool, error) {
	result := DB.Where("id = ?", id).Delete(&IQProbeResult{})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

// DeleteStaleIQProbeResults removes results whose group and model are no
// longer in a configured IQ monitor pool.
func DeleteStaleIQProbeResults(pools map[string][]string) (int64, error) {
	type pair struct {
		GroupName string
		ModelName string
	}
	var pairs []pair
	if err := DB.Model(&IQProbeResult{}).Distinct("group_name", "model_name").Find(&pairs).Error; err != nil {
		return 0, err
	}
	var deleted int64
	for _, item := range pairs {
		if slices.Contains(pools[item.GroupName], item.ModelName) {
			continue
		}
		tx := DB.Where("group_name = ? AND model_name = ?", item.GroupName, item.ModelName).Delete(&IQProbeResult{})
		if tx.Error != nil {
			return deleted, tx.Error
		}
		deleted += tx.RowsAffected
	}
	return deleted, nil
}
