package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func parseFlowQuotaTimeRange(c *gin.Context) (int64, int64, bool) {
	startTimestamp, err := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	if err != nil || startTimestamp <= 0 {
		common.ApiErrorMsg(c, "invalid start_timestamp")
		return 0, 0, false
	}
	endTimestamp, err := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if err != nil || endTimestamp <= 0 {
		common.ApiErrorMsg(c, "invalid end_timestamp")
		return 0, 0, false
	}
	if endTimestamp < startTimestamp {
		common.ApiErrorMsg(c, "invalid time range")
		return 0, 0, false
	}
	return startTimestamp, endTimestamp, true
}

// parseAdminQuotaTimeRange validates administrator dashboard queries with the
// same rules as the self endpoint: a malformed timestamp is rejected instead of
// silently collapsing the window, and the range must stay within the configured
// log range. Missing bounds fall back to the most recent maxRange window.
func parseAdminQuotaTimeRange(c *gin.Context) (int64, int64, bool) {
	startTimestamp, ok := parseOptionalTimestamp(c, "start_timestamp")
	if !ok {
		return 0, 0, false
	}
	endTimestamp, ok := parseOptionalTimestamp(c, "end_timestamp")
	if !ok {
		return 0, 0, false
	}
	startTimestamp, err := limitLogTimeRange(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return 0, 0, false
	}
	if endTimestamp == 0 {
		endTimestamp = common.GetTimestamp()
	}
	if endTimestamp < startTimestamp {
		common.ApiErrorMsg(c, "invalid time range")
		return 0, 0, false
	}
	return startTimestamp, endTimestamp, true
}

// parseOptionalTimestamp returns 0 when the parameter is absent and rejects a
// present but malformed value.
func parseOptionalTimestamp(c *gin.Context, key string) (int64, bool) {
	raw := c.Query(key)
	if raw == "" {
		return 0, true
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value < 0 {
		common.ApiErrorMsg(c, "invalid "+key)
		return 0, false
	}
	return value, true
}

func GetAllQuotaDates(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseAdminQuotaTimeRange(c)
	if !ok {
		return
	}
	username := c.Query("username")
	modelName := c.Query("model_name")
	dates, err := model.GetAllQuotaDates(startTimestamp, endTimestamp, username, modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetQuotaDatesByUser(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseAdminQuotaTimeRange(c)
	if !ok {
		return
	}
	dates, err := model.GetQuotaDataGroupByUser(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
}

func GetUserQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, endTimestamp, ok := parseFlowQuotaTimeRange(c)
	if !ok {
		return
	}
	startTimestamp, err := limitLogTimeRange(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	modelName := c.Query("model_name")
	dates, err := model.GetQuotaDataByUserId(userId, modelName, startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetAllFlowQuotaDates(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseAdminQuotaTimeRange(c)
	if !ok {
		return
	}
	username := c.Query("username")
	modelName := c.Query("model_name")
	dates, err := model.GetFlowQuotaData(startTimestamp, endTimestamp, username, modelName, 0, c.GetInt("role"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
}

func GetUserFlowQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, endTimestamp, ok := parseFlowQuotaTimeRange(c)
	if !ok {
		return
	}
	startTimestamp, err := limitLogTimeRange(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	modelName := c.Query("model_name")
	dates, err := model.GetFlowQuotaData(startTimestamp, endTimestamp, "", modelName, userId, common.RoleCommonUser)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
}

// parseVisionTokenUsageRange validates the overview chart windows. The raw
// consume logs are scanned row by row, so the window stays short.
func parseVisionTokenUsageRange(c *gin.Context) (int64, int64, bool) {
	startTimestamp, endTimestamp, ok := parseFlowQuotaTimeRange(c)
	if !ok {
		return 0, 0, false
	}
	if endTimestamp-startTimestamp > 7*24*3600 {
		common.ApiErrorMsg(c, "时间跨度不能超过 7 天")
		return 0, 0, false
	}
	return startTimestamp, endTimestamp, true
}

// GetUserTokenUsage returns the caller's hourly token usage split into input,
// output, cache creation and cache read for the dashboard overview chart.
func GetUserTokenUsage(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseVisionTokenUsageRange(c)
	if !ok {
		return
	}
	usage, err := model.GetUserHourlyTokenUsage(c.GetInt("id"), startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usage,
	})
}

// GetUserModelDistribution returns the caller's per-model consume totals
// (requests, tokens, quota) for the dashboard model distribution chart.
func GetUserModelDistribution(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseVisionTokenUsageRange(c)
	if !ok {
		return
	}
	distribution, err := model.GetUserModelDistribution(c.GetInt("id"), startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    distribution,
	})
}

// GetSiteTokenUsage returns the whole site's hourly token usage for
// administrators.
func GetSiteTokenUsage(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseVisionTokenUsageRange(c)
	if !ok {
		return
	}
	usage, err := model.GetHourlyTokenUsage(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usage,
	})
}

// GetSiteModelDistribution returns the whole site's per-model consume totals for
// administrators.
func GetSiteModelDistribution(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseVisionTokenUsageRange(c)
	if !ok {
		return
	}
	distribution, err := model.GetModelDistribution(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    distribution,
	})
}
