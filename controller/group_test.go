package controller

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetGroupsReturnsOrderedNamesAndGlobalRatios(t *testing.T) {
	previousRatios := ratio_setting.GroupRatio2JSONString()
	previousOrder := setting.GroupOrderJSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousRatios))
		require.NoError(t, setting.UpdateGroupOrder(previousOrder))
	})
	require.NoError(t, setting.UpdateGroupOrder(`["premium","default"]`))

	for _, tc := range []struct {
		name   string
		ratios string
		groups []string
		want   map[string]float64
	}{
		{
			name:   "configured groups preserve zero and fractional ratios",
			ratios: `{"default":1,"premium":1.23456,"free":0}`,
			groups: []string{"premium", "default", "free"},
			want:   map[string]float64{"default": 1, "premium": 1.23456, "free": 0},
		},
		{
			name:   "empty configuration returns empty collections",
			ratios: `{}`,
			groups: []string{},
			want:   map[string]float64{},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(tc.ratios))
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			GetGroups(ctx)

			require.Equal(t, http.StatusOK, recorder.Code)
			var response struct {
				Success    bool               `json:"success"`
				Data       []string           `json:"data"`
				GroupRatio map[string]float64 `json:"group_ratio"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.True(t, response.Success)
			assert.Equal(t, tc.groups, response.Data)
			assert.Equal(t, tc.want, response.GroupRatio)
		})
	}
}

// TestRenameGroupsDatabaseMatrix upgrades data written before group ids
// existed, then renames a group and checks every stored reference on each
// supported database.
func TestRenameGroupsDatabaseMatrix(t *testing.T) {
	for _, dialect := range []struct{ kind, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.kind, func(t *testing.T) {
			if dialect.env != "" && os.Getenv(dialect.env) == "" {
				t.Skip("set " + dialect.env + " to run this database")
			}
			db := modelManagementDB(t, dialect.kind, os.Getenv(dialect.env))
			require.NoError(t, db.AutoMigrate(&model.Token{}, &model.UserGroup{}, &model.SubscriptionPlan{},
				&model.UserSubscription{}, &model.Task{}, &model.ImageStudioTask{}, &model.QuotaData{},
				&model.PerfMetric{}, &model.StatusProbe{}, &model.IQProbeResult{}))
			previousRatios := ratio_setting.GroupRatio2JSONString()
			previousUsable := setting.UserUsableGroups2JSONString()
			t.Cleanup(func() {
				require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousRatios))
				require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousUsable))
			})
			require.NoError(t, model.UpdateOption("GroupRatio", `{"default":1,"vip":2}`))
			require.NoError(t, model.UpdateOption("UserUsableGroups", `{"default":"Default","vip":"VIP"}`))

			// Rows written by the previous release reference groups by name only.
			user := model.User{Username: "rename-matrix", AffCode: "rename-matrix", Group: "vip",
				Setting: `{"extra_usable_groups":["vip"]}`}
			require.NoError(t, db.Create(&user).Error)
			legacyTokens := []model.Token{
				{UserId: user.Id, Key: "rename-matrix-vip", Name: "vip", Status: common.TokenStatusEnabled, ExpiredTime: -1, Group: "vip"},
				{UserId: user.Id, Key: "rename-matrix-auto", Name: "auto", Status: common.TokenStatusEnabled, ExpiredTime: -1,
					Group: "auto", AutoGroups: `["vip","default"]`},
				{UserId: user.Id, Key: "rename-matrix-user", Name: "user", Status: common.TokenStatusEnabled, ExpiredTime: -1},
			}
			require.NoError(t, db.Create(&legacyTokens).Error)
			channels := []model.Channel{
				{Name: "rename-matrix-a", Key: "sk-a", Group: "default,vip", Models: "gpt-4o", Status: common.ChannelStatusEnabled},
				// "vip-pro" is the name of a deleted group that the channel still lists.
				{Name: "rename-matrix-b", Key: "sk-b", Group: "vip,vip-pro", Models: "gpt-4o", Status: common.ChannelStatusEnabled},
			}
			require.NoError(t, db.Create(&channels).Error)
			for i := range channels {
				require.NoError(t, channels[i].AddAbilities(nil))
			}
			plan := model.SubscriptionPlan{Title: "VIP", PriceAmount: 1, Currency: "USD", DurationUnit: model.SubscriptionDurationMonth,
				DurationValue: 1, Enabled: true, UpgradeGroup: "vip"}
			require.NoError(t, db.Create(&plan).Error)
			require.NoError(t, db.Create(&model.Task{TaskID: "rename-matrix-task", UserId: user.Id, Group: "vip"}).Error)
			require.NoError(t, db.Create(&[]model.PerfMetric{
				{ModelName: "gpt-4o", Group: "vip", BucketTs: 100, RequestCount: 1},
				{ModelName: "gpt-4o", Group: "vip", BucketTs: 200, RequestCount: 2},
				{ModelName: "gpt-4o", Group: "vip-pro", BucketTs: 200, RequestCount: 3},
			}).Error)

			previousMaster := common.IsMasterNode
			common.IsMasterNode = true
			t.Cleanup(func() { common.IsMasterNode = previousMaster })
			vipId := 0
			for range 2 {
				require.NoError(t, model.InitGroupRegistry())
				var tokens []model.Token
				require.NoError(t, db.Order("id").Find(&tokens).Error)
				id, ok := model.GroupIdByName("vip")
				require.True(t, ok)
				defaultId, _ := model.GroupIdByName("default")
				require.True(t, vipId == 0 || vipId == id, "a repeated startup must keep the group id")
				vipId = id
				assert.Equal(t, vipId, tokens[0].GroupId)
				assert.JSONEq(t, common.GetJsonString([]int{vipId, defaultId}), tokens[1].AutoGroupIds)
				assert.Zero(t, tokens[2].GroupId)
				var registered int64
				require.NoError(t, db.Model(&model.UserGroup{}).Count(&registered).Error)
				assert.Equal(t, int64(2), registered)
			}

			var rejected struct{ Success bool }
			modelManagementRequest(t, RenameGroups, http.MethodPost, "/api/option/groups/rename",
				map[string]any{"renames": []model.GroupRename{{Id: vipId, Name: "default"}}}, &rejected)
			assert.False(t, rejected.Success)

			var response struct {
				Success bool              `json:"success"`
				Message string            `json:"message"`
				Data    map[string]string `json:"data"`
			}
			modelManagementRequest(t, RenameGroups, http.MethodPost, "/api/option/groups/rename",
				map[string]any{"renames": []model.GroupRename{{Id: vipId, Name: "vip-pro"}}}, &response)
			require.True(t, response.Success, response.Message)
			assert.Equal(t, map[string]string{"vip": "vip-pro"}, response.Data)

			token, err := model.GetTokenByKey("rename-matrix-vip", true)
			require.NoError(t, err)
			assert.Equal(t, "vip-pro", token.Group)
			autoToken, err := model.GetTokenByKey("rename-matrix-auto", true)
			require.NoError(t, err)
			autoGroups, err := autoToken.GetAutoGroups()
			require.NoError(t, err)
			assert.Equal(t, []string{"vip-pro", "default"}, autoGroups)

			var reloadedUser model.User
			require.NoError(t, db.First(&reloadedUser, user.Id).Error)
			assert.Equal(t, "vip-pro", reloadedUser.Group)
			assert.JSONEq(t, `{"extra_usable_groups":["vip-pro"]}`, reloadedUser.Setting)
			var reloadedChannels []model.Channel
			require.NoError(t, db.Order("id").Find(&reloadedChannels).Error)
			require.Len(t, reloadedChannels, 2)
			assert.Equal(t, "default,vip-pro", reloadedChannels[0].Group)
			assert.Equal(t, "vip-pro", reloadedChannels[1].Group)
			var abilities []model.Ability
			require.NoError(t, db.Order("channel_id").Find(&abilities).Error)
			abilityGroups := map[int][]string{}
			for _, ability := range abilities {
				abilityGroups[ability.ChannelId] = append(abilityGroups[ability.ChannelId], ability.Group)
			}
			assert.ElementsMatch(t, []string{"default", "vip-pro"}, abilityGroups[channels[0].Id])
			assert.Equal(t, []string{"vip-pro"}, abilityGroups[channels[1].Id])
			var reloadedPlan model.SubscriptionPlan
			require.NoError(t, db.First(&reloadedPlan, plan.Id).Error)
			assert.Equal(t, "vip-pro", reloadedPlan.UpgradeGroup)
			var task model.Task
			require.NoError(t, db.Where("task_id = ?", "rename-matrix-task").First(&task).Error)
			assert.Equal(t, "vip-pro", task.Group)
			var metrics []model.PerfMetric
			require.NoError(t, db.Order("bucket_ts, request_count").Find(&metrics).Error)
			require.Len(t, metrics, 3)
			assert.Equal(t, []string{"vip-pro", "vip", "vip-pro"}, []string{metrics[0].Group, metrics[1].Group, metrics[2].Group},
				"a bucket the new name already owns keeps its row")

			var storedRatio model.Option
			require.NoError(t, db.Where(&model.Option{Key: "GroupRatio"}).First(&storedRatio).Error)
			assert.JSONEq(t, `{"default":1,"vip-pro":2}`, storedRatio.Value)
			var storedUsable model.Option
			require.NoError(t, db.Where(&model.Option{Key: "UserUsableGroups"}).First(&storedUsable).Error)
			assert.JSONEq(t, `{"default":"Default","vip-pro":"VIP"}`, storedUsable.Value)
			name, ok := model.GroupNameById(vipId)
			assert.True(t, ok)
			assert.Equal(t, "vip-pro", name)
		})
	}
}

// TestGetUserGroupsReportsConfiguredVendors covers the vendor a group is
// assigned to in the group settings, which the API key dialog uses to offer
// routes by vendor.
func TestGetUserGroupsReportsConfiguredVendors(t *testing.T) {
	db := modelManagementDB(t, "sqlite", "")
	previousRatios := ratio_setting.GroupRatio2JSONString()
	previousUsable := setting.UserUsableGroups2JSONString()
	previousVendors := setting.GroupVendorsJSONString()
	previousOrder := setting.GroupOrderJSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousRatios))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousUsable))
		require.NoError(t, setting.UpdateGroupVendors(previousVendors))
		require.NoError(t, setting.UpdateGroupOrder(previousOrder))
		model.InvalidatePricingCache()
	})
	vendor := model.Vendor{Name: "Anthropic", Icon: "Claude.Color", Description: "Long-form writing", Status: 1}
	require.NoError(t, db.Create(&vendor).Error)
	model.InvalidatePricingCache()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"claude-b":1.5,"claude-a":2,"internal":1}`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","claude-a":"Stable","claude-b":"Budget"}`))
	require.NoError(t, setting.UpdateGroupOrder(`["claude-a","claude-b","default"]`))
	require.NoError(t, setting.UpdateGroupVendors(common.GetJsonString(map[string]int{
		"claude-a": vendor.Id, "claude-b": vendor.Id, "internal": vendor.Id, "default": 0,
	})))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	GetUserGroups(ctx)

	var response struct {
		Success bool `json:"success"`
		Data    map[string]struct {
			VendorID int `json:"vendor_id"`
		} `json:"data"`
		Vendors    []model.PricingVendor `json:"vendors"`
		GroupOrder []string              `json:"group_order"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response), recorder.Body.String())
	require.True(t, response.Success)
	assert.Equal(t, vendor.Id, response.Data["claude-a"].VendorID)
	assert.Equal(t, vendor.Id, response.Data["claude-b"].VendorID)
	assert.Zero(t, response.Data["default"].VendorID)
	assert.NotContains(t, response.Data, "internal", "a group the user cannot use stays hidden")
	assert.Equal(t, []string{"claude-a", "claude-b", "default"}, response.GroupOrder)
	assert.Equal(t, []model.PricingVendor{{ID: vendor.Id, Name: "Anthropic", Description: "Long-form writing", Icon: "Claude.Color"}}, response.Vendors)
}
