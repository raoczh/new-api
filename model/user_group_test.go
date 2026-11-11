package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// useGroupOptions applies group options for one test and restores the
// previous in-memory settings afterwards.
func useGroupOptions(t *testing.T, values map[string]string) {
	t.Helper()
	previousMap := common.OptionMap
	previous := map[string]string{
		"GroupRatio":                 ratio_setting.GroupRatio2JSONString(),
		"UserUsableGroups":           setting.UserUsableGroups2JSONString(),
		"GroupGroupRatio":            ratio_setting.GroupGroupRatio2JSONString(),
		"AutoGroups":                 setting.AutoGroups2JsonString(),
		"GroupOrder":                 setting.GroupOrderJSONString(),
		"ModelRequestRateLimitGroup": setting.ModelRequestRateLimitGroup2JSONString(),
		"group_ratio_setting.group_special_usable_group": ratio_setting.GetGroupRatioSetting().
			GroupSpecialUsableGroup.MarshalJSONString(),
	}
	common.OptionMap = map[string]string{}
	t.Cleanup(func() {
		for key, value := range previous {
			_ = updateOptionMap(key, value)
		}
		common.OptionMap = previousMap
		DB.Exec("DELETE FROM options")
	})
	for key, value := range values {
		require.NoError(t, updateOptionMap(key, value))
	}
	require.NoError(t, RefreshGroupRegistry())
}

func TestRenameGroupKeepsCachedTokensAndRewritesGroupOptions(t *testing.T) {
	truncateTables(t)
	useUserCacheMiniRedis(t)
	useGroupOptions(t, map[string]string{
		"GroupRatio":                 `{"default":1,"vip":2}`,
		"GroupGroupRatio":            `{"vip":{"default":0.5,"vip":0.8}}`,
		"AutoGroups":                 `["vip","default"]`,
		"GroupOrder":                 `["vip","default"]`,
		"ModelRequestRateLimitGroup": `{"vip":[10,5]}`,
		"group_ratio_setting.group_special_usable_group": `{"vip":{"+:vip":"VIP","-:default":""}}`,
	})
	token := Token{UserId: 1, Key: "group-rename-token", Name: "vip", Status: common.TokenStatusEnabled,
		ExpiredTime: -1, UnlimitedQuota: true, Group: "vip"}
	require.NoError(t, token.Insert())
	// Warm the Redis cache: the rename must not depend on invalidating it.
	cached, err := GetTokenByKey(token.Key, false)
	require.NoError(t, err)
	require.Equal(t, "vip", cached.Group)

	vipId, ok := GroupIdByName("vip")
	require.True(t, ok)
	_, err = RenameGroups([]GroupRename{{Id: vipId, Name: "vip-pro"}})
	require.NoError(t, err)

	cached, err = cacheGetTokenByKey(token.Key)
	require.NoError(t, err, "the cached token stays valid across the rename")
	assert.Equal(t, "vip-pro", cached.Group)
	assert.Equal(t, map[string]float64{"default": 1, "vip-pro": 2}, ratio_setting.GetGroupRatioCopy())
	ratio, ok := ratio_setting.GetGroupGroupRatio("vip-pro", "vip-pro")
	assert.True(t, ok)
	assert.Equal(t, 0.8, ratio)
	special, ok := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get("vip-pro")
	require.True(t, ok)
	assert.Equal(t, map[string]string{"+:vip-pro": "VIP", "-:default": ""}, special)
	assert.Equal(t, []string{"vip-pro", "default"}, setting.GetAutoGroups())
	assert.JSONEq(t, `["vip-pro","default"]`, setting.GroupOrderJSONString())
	assert.JSONEq(t, `{"vip-pro":[10,5]}`, setting.ModelRequestRateLimitGroup2JSONString())
}

func TestRenameGroupsRejectsUnsafeRenames(t *testing.T) {
	truncateTables(t)
	useGroupOptions(t, map[string]string{"GroupRatio": `{"default":1,"vip":2,"svip":3}`})
	defaultId, _ := GroupIdByName("default")
	vipId, _ := GroupIdByName("vip")
	svipId, _ := GroupIdByName("svip")

	tests := []struct {
		name    string
		renames []GroupRename
	}{
		{"default group", []GroupRename{{Id: defaultId, Name: "basic"}}},
		{"active target", []GroupRename{{Id: vipId, Name: "svip"}}},
		{"swap", []GroupRename{{Id: vipId, Name: "svip"}, {Id: svipId, Name: "vip"}}},
		{"same target twice", []GroupRename{{Id: vipId, Name: "gold"}, {Id: svipId, Name: "gold"}}},
		{"routing mode name", []GroupRename{{Id: vipId, Name: "auto"}}},
		{"comma", []GroupRename{{Id: vipId, Name: "a,b"}}},
		{"special usable prefix", []GroupRename{{Id: vipId, Name: "+:vip"}}},
		{"too long", []GroupRename{{Id: vipId, Name: strings.Repeat("g", maxGroupNameLength+1)}}},
		{"unknown id", []GroupRename{{Id: 9999, Name: "gold"}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := RenameGroups(tt.renames)
			require.Error(t, err)
			assert.Equal(t, map[string]float64{"default": 1, "vip": 2, "svip": 3}, ratio_setting.GetGroupRatioCopy())
			name, _ := GroupNameById(vipId)
			assert.Equal(t, "vip", name)
		})
	}
}
