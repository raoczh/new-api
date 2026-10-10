package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func GetPerfMetricsSummary(c *gin.Context) {
	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
	result, err := perfmetrics.QuerySummaryAll(hours, activeGroups)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func GetPerfMetrics(c *gin.Context) {
	modelName := c.Query("model")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model is required",
		})
		return
	}

	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	result, err := perfmetrics.Query(perfmetrics.QueryParams{
		Model:         modelName,
		Group:         c.Query("group"),
		Hours:         hours,
		AllowedGroups: append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto"),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

// GetGroupStatus uses the same visible groups as the model square, including
// the site's public groups when the status monitor allows anonymous access.
func GetGroupStatus(c *gin.Context) {
	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	userGroup := ""
	if userID := c.GetInt("id"); userID > 0 {
		user, err := model.GetUserCache(userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to load user groups"})
			return
		}
		userGroup = user.Group
	}
	groupDescs := map[string]string{}
	for groupName, desc := range service.GetUserUsableGroups(userGroup) {
		if ratio_setting.ContainsGroupRatio(groupName) {
			groupDescs[groupName] = desc
		}
	}

	result, err := perfmetrics.QueryGroupStatus(hours, groupDescs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	for i := range result.Groups {
		name := result.Groups[i].Group
		result.Groups[i].GroupRatio = ratio_setting.GetGroupRatio(name)
		if ratio, ok := ratio_setting.GetGroupGroupRatio(userGroup, name); userGroup != "" && ok {
			result.Groups[i].GroupRatio = ratio
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}
