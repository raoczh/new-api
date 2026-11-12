package controller

import (
	"maps"
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
	// 分组关联的厂商由管理员在分组设置里配置；一并返回，创建密钥时按厂商挑选线路。
	vendorByID := make(map[int]model.PricingVendor)
	for _, vendor := range model.GetVendors() {
		vendorByID[vendor.ID] = vendor
	}
	vendors := make([]model.PricingVendor, 0)
	listed := make(map[int]bool)
	for groupName, vendorID := range setting.GetGroupVendors() {
		group, ok := usableGroups[groupName]
		if !ok || vendorID == 0 {
			continue
		}
		vendor, known := vendorByID[vendorID]
		if !known {
			vendor, known = model.GetDefaultVendorByID(vendorID)
		}
		if !known {
			continue
		}
		group["vendor_id"] = vendorID
		if !listed[vendorID] {
			listed[vendorID] = true
			vendors = append(vendors, vendor)
		}
	}
	slices.SortFunc(vendors, func(a, b model.PricingVendor) int { return strings.Compare(a.Name, b.Name) })
	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     "",
		"data":        usableGroups,
		"vendors":     vendors,
		"group_order": setting.OrderedGroupNames(slices.Collect(maps.Keys(usableGroups))),
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
