package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
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

// TestSyncGroupReferencesBindsIdsAndClearsRemovedGroups covers the startup
// check on data written before group ids existed: every reference gets the id
// of its group, what a removed group left behind is cleared unless something
// still belongs to it, and a row written under a former name follows the
// rename.
func TestSyncGroupReferencesBindsIdsAndClearsRemovedGroups(t *testing.T) {
	truncateTables(t)
	// "gone" was removed and nothing belongs to it; "kept" was removed while a
	// user still belongs to it; "legacy" was removed while a key still uses it.
	useGroupOptions(t, map[string]string{
		"GroupRatio":       `{"default":1,"vip":2}`,
		"UserUsableGroups": `{"default":"Default","vip":"VIP","gone":"Gone","kept":"Kept"}`,
		"GroupGroupRatio":  `{"vip":{"gone":0.5,"default":0.8},"gone":{"vip":1}}`,
		"AutoGroups":       `["vip","gone"]`,
		"GroupOrder":       `["gone","vip","default","kept"]`,
		"group_ratio_setting.group_special_usable_group": `{"vip":{"+:gone":"Gone","-:default":""}}`,
	})
	require.NoError(t, DB.Create(&Option{Key: "GroupRatio", Value: `{"default":1,"vip":2}`}).Error)
	for _, name := range []string{"gone", "kept"} {
		_, err := EnsureGroupId(name)
		require.NoError(t, err)
	}
	legacyToken := Token{UserId: 1, Key: "group-sync-token", Name: "legacy", Status: common.TokenStatusEnabled,
		ExpiredTime: -1, UnlimitedQuota: true, Group: "legacy"}
	require.NoError(t, legacyToken.Insert())

	// The previous release wrote these rows with a group name and no id.
	legacy := DB.Session(&gorm.Session{SkipHooks: true})
	member := User{Username: "group-sync-member", AffCode: "group-sync-member", Group: "vip"}
	require.NoError(t, legacy.Create(&member).Error)
	holdout := User{Username: "group-sync-holdout", AffCode: "group-sync-holdout", Group: "kept",
		Setting: `{"extra_usable_groups":["gone","vip"],"hidden_usable_groups":["gone"],"group_ratios":{"gone":0.5,"vip":0.7}}`}
	require.NoError(t, legacy.Create(&holdout).Error)
	channel := Channel{Name: "group-sync-channel", Key: "sk-group-sync", Group: "default,vip", Models: "gpt-4o",
		Status: common.ChannelStatusEnabled}
	require.NoError(t, legacy.Create(&channel).Error)
	require.NoError(t, legacy.Create(&[]Ability{
		{Group: "default", Model: "gpt-4o", ChannelId: channel.Id, Enabled: true},
		{Group: "vip", Model: "gpt-4o", ChannelId: channel.Id, Enabled: true},
	}).Error)
	require.NoError(t, legacy.Create(&[]QuotaData{
		{UserID: member.Id, Username: member.Username, ModelName: "gpt-4o", CreatedAt: 3600, UseGroup: "vip"},
		// History of a removed group written by a release that already bound ids.
		{UserID: member.Id, Username: member.Username, ModelName: "gpt-4o", CreatedAt: 7200, UseGroup: "gone",
			UseGroupId: groupIdOf("gone")},
	}).Error)

	vipId, _ := GroupIdByName("vip")
	defaultId, _ := GroupIdByName("default")
	keptId, _ := GroupIdByName("kept")
	require.NotZero(t, vipId)
	for range 2 {
		require.NoError(t, SyncGroupReferences(), "a repeated startup changes nothing and still succeeds")

		var users []User
		require.NoError(t, DB.Order("id").Find(&users).Error)
		require.Len(t, users, 2)
		assert.Equal(t, vipId, users[0].GroupId)
		assert.Equal(t, keptId, users[1].GroupId, "a removed group that still owns a user keeps its id")
		assert.JSONEq(t, `{"extra_usable_groups":["vip"],"hidden_usable_groups":[],"group_ratios":{"vip":0.7}}`, users[1].Setting)
		var storedChannel Channel
		require.NoError(t, DB.First(&storedChannel, channel.Id).Error)
		assert.Equal(t, common.GetJsonString([]int{defaultId, vipId}), "["+storedChannel.GroupIds+"]")
		var abilities []Ability
		require.NoError(t, DB.Order("group_id").Find(&abilities).Error)
		require.Len(t, abilities, 2)
		assert.ElementsMatch(t, []int{defaultId, vipId}, []int{abilities[0].GroupId, abilities[1].GroupId})
		var quotaData []QuotaData
		require.NoError(t, DB.Order("created_at").Find(&quotaData).Error)
		require.Len(t, quotaData, 2)
		assert.Equal(t, vipId, quotaData[0].UseGroupId)
		assert.Equal(t, "gone", quotaData[1].UseGroup, "history keeps the name it was written with")
		assert.Zero(t, quotaData[1].UseGroupId, "a removed group has no id")

		registered := GetGroupRegistry()
		assert.NotContains(t, registered, "gone", "the id of a removed group nothing refers to is dropped")
		assert.Contains(t, registered, "kept")
		assert.Contains(t, registered, "legacy", "a key still reads its group through this id")
		assert.Equal(t, map[string]string{"default": "Default", "vip": "VIP", "kept": "Kept"}, setting.GetUserUsableGroupsCopy())
		assert.JSONEq(t, `["vip","default","kept"]`, setting.GroupOrderJSONString())
		assert.Equal(t, []string{"vip"}, setting.GetAutoGroups())
		assert.JSONEq(t, `{"vip":{"default":0.8}}`, ratio_setting.GroupGroupRatio2JSONString())
		special, ok := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get("vip")
		require.True(t, ok)
		assert.Equal(t, map[string]string{"-:default": ""}, special)
	}

	// A row written with a group name carries the id from then on.
	created := User{Username: "group-sync-created", AffCode: "group-sync-created", Group: "vip"}
	require.NoError(t, DB.Create(&created).Error)
	assert.Equal(t, vipId, created.GroupId)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", created.Id).Update("group", "default").Error)
	require.NoError(t, DB.First(&created, created.Id).Error)
	assert.Equal(t, defaultId, created.GroupId)

	// A node that has not seen the rename yet writes the old name.
	_, err := RenameGroups([]GroupRename{{Id: vipId, Name: "vip-pro"}})
	require.NoError(t, err)
	require.NoError(t, legacy.Create(&Task{TaskID: "group-sync-stale", UserId: member.Id, Group: "vip"}).Error)
	require.NoError(t, SyncGroupReferences())
	var task Task
	require.NoError(t, DB.Where("task_id = ?", "group-sync-stale").First(&task).Error)
	assert.Equal(t, "vip-pro", task.Group)
	assert.Equal(t, vipId, task.GroupId)
	require.NoError(t, DB.First(&member, member.Id).Error)
	assert.Equal(t, "vip-pro", member.Group)
	assert.Equal(t, vipId, member.GroupId, "a rename keeps the id")
}
