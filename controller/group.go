package controller

import (
	"net/http"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetGroups(c *gin.Context) {
	groupRatios := ratio_setting.GetGroupRatioCopy()
	groupNames := make([]string, 0)
	for groupName := range groupRatios {
		groupNames = append(groupNames, groupName)
	}
	groupNames = setting.OrderedGroupNames(groupNames)
	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     "",
		"data":        groupNames,
		"group_ratio": groupRatios,
	})
}

func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]any)
	userGroup := ""
	userId := c.GetInt("id")
	userSetting := service.GetContextUserSetting(c)
	if userCache, err := model.GetUserCache(userId); err == nil {
		userGroup = userCache.Group
		userSetting = userCache.GetSetting()
	}
	userUsableGroups := service.GetUserUsableGroups(userGroup, userSetting)
	for groupName, _ := range ratio_setting.GetGroupRatioCopy() {
		// UserUsableGroups contains the groups that the user can use
		if desc, ok := userUsableGroups[groupName]; ok {
			usableGroups[groupName] = map[string]any{
				"ratio": service.GetUserGroupRatio(userGroup, groupName),
				"desc":  desc,
			}
		}
	}
	if _, ok := userUsableGroups["auto"]; ok {
		usableGroups["auto"] = map[string]any{
			"ratio": "auto",
			"desc":  setting.GetUsableGroupDescription("auto"),
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}

// GetGroupRegistry returns the stable id of every registered group name.
func GetGroupRegistry(c *gin.Context) {
	common.ApiSuccess(c, model.GetGroupRegistry())
}

// RenameGroups renames groups by id and rewrites every stored reference to
// the old names, so existing users, channels and API keys keep their groups.
func RenameGroups(c *gin.Context) {
	var request struct {
		Renames []model.GroupRename `json:"renames"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid parameters"))
		return
	}
	renamed, err := model.RenameGroups(request.Renames)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(renamed) > 0 {
		changes := make([]string, 0, len(renamed))
		for oldName, newName := range renamed {
			changes = append(changes, oldName+" -> "+newName)
		}
		slices.Sort(changes)
		recordManageAudit(c, "group.rename", map[string]any{"renames": strings.Join(changes, ", ")})
	}
	common.ApiSuccess(c, renamed)
}
