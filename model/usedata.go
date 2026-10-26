package model

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// QuotaData 柱状图数据
type QuotaData struct {
	Id                  int    `json:"id"`
	UserID              int    `json:"user_id" gorm:"index"`
	Username            string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName           string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt           int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	UseGroup            string `json:"use_group" gorm:"index;size:64;default:''"`
	TokenID             int    `json:"token_id" gorm:"index;default:0"`
	ChannelID           int    `json:"channel_id" gorm:"index;default:0"`
	NodeName            string `json:"node_name" gorm:"index;size:64;default:''"`
	TokenUsed           int    `json:"token_used" gorm:"default:0"`
	Count               int    `json:"count" gorm:"default:0"`
	Quota               int    `json:"quota" gorm:"default:0"`
	CacheReadTokens     int64  `json:"cache_read_tokens" gorm:"default:0"`
	CacheCreationTokens int64  `json:"cache_creation_tokens" gorm:"default:0"`
}

type QuotaDataLogParams struct {
	UserID              int
	Username            string
	ModelName           string
	Quota               int
	CreatedAt           int64
	TokenUsed           int
	CacheReadTokens     int64
	CacheCreationTokens int64
	UseGroup            string
	TokenID             int
	ChannelID           int
	NodeName            string
}

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog(common.LogText("updating dashboard data..."))
			SaveQuotaDataCache()
		}
		time.Sleep(time.Duration(common.DataExportInterval) * time.Minute)
	}
}

var CacheQuotaData = make(map[string]*QuotaData)
var CacheQuotaDataLock = sync.Mutex{}

func logQuotaDataCache(quotaData *QuotaData) {
	key := quotaDataCacheKey(quotaData)
	count := quotaData.Count
	quota := quotaData.Quota
	tokenUsed := quotaData.TokenUsed
	cachedQuotaData, ok := CacheQuotaData[key]
	if ok {
		cachedQuotaData.Count += count
		cachedQuotaData.Quota += quota
		cachedQuotaData.TokenUsed += tokenUsed
		cachedQuotaData.CacheReadTokens += quotaData.CacheReadTokens
		cachedQuotaData.CacheCreationTokens += quotaData.CacheCreationTokens
		quotaData = cachedQuotaData
	}
	CacheQuotaData[key] = quotaData
}

// quotaDataCacheKey identifies one dashboard bucket. The user id identifies the
// account, so a rename mid-hour or a settlement path that resolves the name at
// a different moment still lands in the same bucket; only legacy rows without a
// user id fall back to the name.
func quotaDataCacheKey(quotaData *QuotaData) string {
	userIdentity := fmt.Sprintf("%d", quotaData.UserID)
	if quotaData.UserID == 0 {
		userIdentity = "name:" + quotaData.Username
	}
	return fmt.Sprintf("%s\x00%s\x00%d\x00%s\x00%d\x00%d\x00%s",
		userIdentity,
		quotaData.ModelName,
		quotaData.CreatedAt,
		quotaData.UseGroup,
		quotaData.TokenID,
		quotaData.ChannelID,
		quotaData.NodeName,
	)
}

// quotaDataBucketQuery matches the persisted row that a cache entry belongs to,
// using the same identity as quotaDataCacheKey.
func quotaDataBucketQuery(db *gorm.DB, quotaData *QuotaData) *gorm.DB {
	query := db.Where("user_id = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
		quotaData.UserID, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName)
	if quotaData.UserID == 0 {
		query = query.Where("username = ?", quotaData.Username)
	}
	return query
}

// logQuotaData records one dashboard row. count is separate from quota because
// settlements and refunds adjust the same hourly bucket without being a new
// request.
func logQuotaData(params QuotaDataLogParams, count int) {
	// 只精确到小时
	createdAt := params.CreatedAt - (params.CreatedAt % 3600)
	quotaData := &QuotaData{
		UserID:              params.UserID,
		Username:            params.Username,
		ModelName:           params.ModelName,
		CreatedAt:           createdAt,
		UseGroup:            params.UseGroup,
		TokenID:             params.TokenID,
		ChannelID:           params.ChannelID,
		NodeName:            params.NodeName,
		Count:               count,
		Quota:               params.Quota,
		TokenUsed:           params.TokenUsed,
		CacheReadTokens:     max(0, params.CacheReadTokens),
		CacheCreationTokens: max(0, params.CacheCreationTokens),
	}

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(quotaData)
}

func LogQuotaData(params QuotaDataLogParams) {
	logQuotaData(params, 1)
}

// LogQuotaDataAdjustment corrects an existing dashboard bucket instead of
// recording a new request. It is used for task settlement differences, refunds
// and token backfills: the request count stays untouched, quota may be negative,
// and token counters may be filled in after the consume row was written.
func LogQuotaDataAdjustment(params QuotaDataLogParams) {
	logQuotaData(params, 0)
}

func SaveQuotaDataCache() {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	size := len(CacheQuotaData)
	// 如果缓存中有数据，就保存到数据库中
	// 1. 先查询数据库中是否有数据
	// 2. 如果有数据，就更新数据
	// 3. 如果没有数据，就插入数据
	for _, quotaData := range CacheQuotaData {
		quotaDataDB := &QuotaData{}
		quotaDataBucketQuery(DB.Table("quota_data"), quotaData).First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			//quotaDataDB.Count += quotaData.Count
			//quotaDataDB.Quota += quotaData.Quota
			//DB.Table("quota_data").Save(quotaDataDB)
			increaseQuotaData(quotaData)
		} else {
			DB.Table("quota_data").Create(quotaData)
		}
	}
	CacheQuotaData = make(map[string]*QuotaData)
	common.SysLog(common.LogText("saved dashboard data, %d records", size))
}

func increaseQuotaData(quotaData *QuotaData) {
	err := quotaDataBucketQuery(DB.Table("quota_data"), quotaData).
		Updates(map[string]any{
			"count":                 gorm.Expr("count + ?", quotaData.Count),
			"quota":                 gorm.Expr("quota + ?", quotaData.Quota),
			"token_used":            gorm.Expr("token_used + ?", quotaData.TokenUsed),
			"cache_read_tokens":     gorm.Expr("cache_read_tokens + ?", quotaData.CacheReadTokens),
			"cache_creation_tokens": gorm.Expr("cache_creation_tokens + ?", quotaData.CacheCreationTokens),
		}).Error
	if err != nil {
		common.SysLog(common.LogText("increaseQuotaData error: %s", err))
	}
}

func GetQuotaDataByUsername(username string, modelName string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	query := DB.Table("quota_data").
		Select("user_id, max(username) as username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime)
	if query, err = filterQuotaDataModel(query, modelName); err != nil {
		return nil, err
	}
	err = query.Group("user_id, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataByUserId(userId int, modelName string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	query := DB.Table("quota_data").
		Select("user_id, max(username) as username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime)
	if query, err = filterQuotaDataModel(query, modelName); err != nil {
		return nil, err
	}
	err = query.Group("user_id, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").
		Select("user_id, max(username) as username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		// Users are identified by id: renaming an account must not split its
		// history, and two accounts sharing a display name must stay apart.
		Group("user_id, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetAllQuotaDates(startTime int64, endTime int64, username string, modelName string) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(username, modelName, startTime, endTime)
	}
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	// only select model_name, sum(count) as count, sum(quota) as quota, model_name, created_at from quota_data group by model_name, created_at;
	//err = DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime).Find(&quotaDatas).Error
	query := DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if query, err = filterQuotaDataModel(query, modelName); err != nil {
		return nil, err
	}
	err = query.Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}

// filterQuotaDataModel applies the dashboard model filter with the same
// semantics as usage-log search: an exact model name unless the value contains
// "%" as an explicit wildcard. A plain LIKE would make "gpt" also match
// "gpt-4o" and every other variant.
func filterQuotaDataModel(query *gorm.DB, modelName string) (*gorm.DB, error) {
	if modelName == "" {
		return query, nil
	}
	if !strings.Contains(modelName, "%") {
		return query.Where("model_name = ?", modelName), nil
	}
	pattern, err := sanitizeLikePattern(modelName)
	if err != nil {
		return nil, err
	}
	return query.Where("model_name LIKE ? ESCAPE '!'", pattern), nil
}
