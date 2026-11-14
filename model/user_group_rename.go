package model

import (
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/samber/lo"
	"gorm.io/gorm"
)

// GroupRename renames the registered group Id to Name.
type GroupRename struct {
	Id   int    `json:"id"`
	Name string `json:"name"`
}

// maxGroupNameLength follows tasks.group, the narrowest column that stores a
// group name.
const maxGroupNameLength = 50

// maxChannelGroupListLength follows channels.group, which stores a
// comma-separated group list.
const maxChannelGroupListLength = 64

// groupOptionShape describes where an option value stores group names.
type groupOptionShape int

const (
	groupOptionMapKeys groupOptionShape = iota
	groupOptionList
	groupOptionNestedMapKeys
	groupOptionSpecialUsable
)

// groupNameOptions lists every option whose value is keyed by or lists group
// names. A rename rewrites all of them together with the database references.
// storedOnly marks aliases of another option's setting: they are rewritten
// only when a row already exists, so a new row never shadows later edits of
// the primary option.
var groupNameOptions = []struct {
	key        string
	shape      groupOptionShape
	storedOnly bool
}{
	{key: "GroupRatio", shape: groupOptionMapKeys},
	{key: "UserUsableGroups", shape: groupOptionMapKeys},
	{key: "TopupGroupRatio", shape: groupOptionMapKeys},
	{key: "GroupVendors", shape: groupOptionMapKeys},
	{key: "ModelRequestRateLimitGroup", shape: groupOptionMapKeys},
	{key: "iq_monitor_setting.group_models", shape: groupOptionMapKeys},
	{key: "GroupOrder", shape: groupOptionList},
	{key: "AutoGroups", shape: groupOptionList},
	{key: "GroupGroupRatio", shape: groupOptionNestedMapKeys},
	{key: "group_ratio_setting.group_special_usable_group", shape: groupOptionSpecialUsable},
	{key: "group_ratio_setting.group_ratio", shape: groupOptionMapKeys, storedOnly: true},
	{key: "group_ratio_setting.group_group_ratio", shape: groupOptionNestedMapKeys, storedOnly: true},
}

// groupNameColumns lists every column that stores a single group name and
// still affects routing, billing, subscriptions or statistics, with the
// column that holds the id of that group. Tokens bind their ids themselves.
// Request logs keep the name they were written with.
var groupNameColumns = []struct {
	model    any
	column   string
	idColumn string
}{
	{&User{}, "group", "group_id"},
	{&Token{}, "group", ""},
	{&SubscriptionPlan{}, "upgrade_group", "upgrade_group_id"},
	{&SubscriptionPlan{}, "downgrade_group", "downgrade_group_id"},
	{&UserSubscription{}, "upgrade_group", "upgrade_group_id"},
	{&UserSubscription{}, "prev_user_group", "prev_user_group_id"},
	{&UserSubscription{}, "downgrade_group", "downgrade_group_id"},
	{&Task{}, "group", "group_id"},
	{&ImageStudioTask{}, "group", "group_id"},
	{&QuotaData{}, "use_group", "use_group_id"},
	{&StatusProbe{}, "group_name", "group_id"},
	{&IQProbeResult{}, "group_name", "group_id"},
}

func renameGroupName(renames map[string]string, name string) string {
	if renamed, ok := renames[name]; ok {
		return renamed
	}
	return name
}

// renameJSONKeys renames map keys; a renamed key replaces an existing entry
// that already uses the new name.
func renameJSONKeys[V any](items map[string]V, rename func(string) string) map[string]V {
	renamed := make(map[string]V, len(items))
	for name, item := range items {
		if rename(name) == name {
			renamed[name] = item
		}
	}
	for name, item := range items {
		if newName := rename(name); newName != name {
			renamed[newName] = item
		}
	}
	return renamed
}

func renameGroupOption(value string, shape groupOptionShape, renames map[string]string) (string, error) {
	renameGroup := func(name string) string {
		return renameGroupName(renames, name)
	}
	var renamed any
	switch shape {
	case groupOptionList:
		var groups []string
		if err := common.UnmarshalJsonStr(value, &groups); err != nil {
			return "", err
		}
		for i, name := range groups {
			groups[i] = renameGroup(name)
		}
		renamed = groups
	case groupOptionMapKeys:
		var groups map[string]json.RawMessage
		if err := common.UnmarshalJsonStr(value, &groups); err != nil {
			return "", err
		}
		renamed = renameJSONKeys(groups, renameGroup)
	default:
		var groups map[string]map[string]json.RawMessage
		if err := common.UnmarshalJsonStr(value, &groups); err != nil {
			return "", err
		}
		renameItem := renameGroup
		if shape == groupOptionSpecialUsable {
			// 特殊可用分组的 "+:" / "-:" 前缀表示添加或移除该分组。
			renameItem = func(name string) string {
				for _, prefix := range []string{"+:", "-:"} {
					if after, ok := strings.CutPrefix(name, prefix); ok {
						return prefix + renameGroup(after)
					}
				}
				return renameGroup(name)
			}
		}
		for name, items := range groups {
			groups[name] = renameJSONKeys(items, renameItem)
		}
		renamed = renameJSONKeys(groups, renameGroup)
	}
	data, err := common.Marshal(renamed)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// renameGroupsInOptions returns the rewritten value of every group option
// that references a renamed group.
func renameGroupsInOptions(renames map[string]string) (map[string]string, error) {
	common.OptionMapRWMutex.RLock()
	current := make(map[string]string, len(groupNameOptions))
	for _, option := range groupNameOptions {
		current[option.key] = common.OptionMap[option.key]
	}
	common.OptionMapRWMutex.RUnlock()

	changed := make(map[string]string)
	for _, option := range groupNameOptions {
		value := strings.TrimSpace(current[option.key])
		if value == "" {
			continue
		}
		original, err := renameGroupOption(value, option.shape, nil)
		if err != nil {
			return nil, fmt.Errorf("parse option %s: %w", option.key, err)
		}
		renamed, err := renameGroupOption(value, option.shape, renames)
		if err != nil {
			return nil, fmt.Errorf("rewrite option %s: %w", option.key, err)
		}
		if renamed != original {
			changed[option.key] = renamed
		}
	}
	return changed, nil
}

// renameGroupInChannels rewrites the group lists of channels and moves their
// abilities to the new name. It returns whether any channel changed.
func renameGroupInChannels(tx *gorm.DB, oldName, newName string) (bool, error) {
	// Group lists are matched exactly in Go; channel tables are small enough
	// to scan, and LIKE escaping differs between databases.
	var channels []Channel
	if err := tx.Select("id", "name", "group").Find(&channels).Error; err != nil {
		return false, err
	}
	changed := false
	for _, channel := range channels {
		groups := channel.GetGroups()
		if !slices.Contains(groups, oldName) {
			continue
		}
		changed = true
		renamed := make([]string, 0, len(groups))
		for _, group := range groups {
			if group == oldName {
				group = newName
			}
			if !slices.Contains(renamed, group) {
				renamed = append(renamed, group)
			}
		}
		groupList := strings.Join(renamed, ",")
		if len(groupList) > maxChannelGroupListLength {
			return false, common.NewMessage("The group list of channel {{name}} would exceed {{max}} characters", map[string]any{
				"name": channel.Name,
				"max":  maxChannelGroupListLength,
			})
		}
		if slices.Contains(groups, newName) {
			// The channel already serves the new name, so its abilities exist.
			if err := tx.Where("channel_id = ? AND "+commonGroupCol+" = ?", channel.Id, oldName).
				Delete(&Ability{}).Error; err != nil {
				return false, err
			}
		}
		if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).UpdateColumn("group", groupList).Error; err != nil {
			return false, err
		}
	}
	// The group keeps its id, so only the name moves.
	result := tx.Model(&Ability{}).Where(commonGroupCol+" = ?", oldName).UpdateColumn("group", newName)
	if result.Error != nil {
		return false, result.Error
	}
	return changed || result.RowsAffected > 0, nil
}

// renameGroupsInUserSettings rewrites the per-user extra and hidden group
// lists and the per-user group ratios, and returns the ids of the users it
// changed.
func renameGroupsInUserSettings(tx *gorm.DB, renames map[string]string) ([]int, error) {
	// Only users with group lists or group ratios of their own can reference a
	// group in their settings; the names themselves are matched exactly in Go.
	var users []User
	if err := tx.Select("id", "setting").
		Where("setting LIKE ? OR setting LIKE ?", "%usable_groups%", "%group_ratios%").
		Find(&users).Error; err != nil {
		return nil, err
	}
	var userIds []int
	for _, user := range users {
		var setting map[string]any
		if err := common.UnmarshalJsonStr(user.Setting, &setting); err != nil {
			continue
		}
		changed := false
		for _, field := range []string{"extra_usable_groups", "hidden_usable_groups"} {
			groups, ok := setting[field].([]any)
			if !ok {
				continue
			}
			for i, group := range groups {
				name, ok := group.(string)
				if !ok {
					continue
				}
				if renamed := renameGroupName(renames, name); renamed != name {
					groups[i] = renamed
					changed = true
				}
			}
		}
		if ratios, ok := setting["group_ratios"].(map[string]any); ok {
			for name := range ratios {
				if _, renamed := renames[name]; !renamed {
					continue
				}
				setting["group_ratios"] = renameJSONKeys(ratios, func(name string) string {
					return renameGroupName(renames, name)
				})
				changed = true
				break
			}
		}
		if !changed {
			continue
		}
		data, err := common.Marshal(setting)
		if err != nil {
			return nil, err
		}
		if err := tx.Model(&User{}).Where("id = ?", user.Id).Update("setting", string(data)).Error; err != nil {
			return nil, err
		}
		userIds = append(userIds, user.Id)
	}
	return userIds, nil
}

// renameGroupInPerfMetrics moves performance history to the new name. A
// bucket the new name already owns keeps its row, because (model, group,
// bucket) is unique.
func renameGroupInPerfMetrics(tx *gorm.DB, oldName, newName string) error {
	var taken []PerfMetric
	if err := tx.Select("model_name", "bucket_ts").Where(commonGroupCol+" = ?", newName).Find(&taken).Error; err != nil {
		return err
	}
	if len(taken) == 0 {
		return tx.Model(&PerfMetric{}).Where(commonGroupCol+" = ?", oldName).Update("group", newName).Error
	}
	takenBuckets := make(map[string]bool, len(taken))
	for _, metric := range taken {
		takenBuckets[fmt.Sprintf("%s\x00%d", metric.ModelName, metric.BucketTs)] = true
	}
	var metrics []PerfMetric
	if err := tx.Select("id", "model_name", "bucket_ts").Where(commonGroupCol+" = ?", oldName).Find(&metrics).Error; err != nil {
		return err
	}
	ids := make([]int, 0, len(metrics))
	for _, metric := range metrics {
		if !takenBuckets[fmt.Sprintf("%s\x00%d", metric.ModelName, metric.BucketTs)] {
			ids = append(ids, metric.Id)
		}
	}
	for _, chunk := range lo.Chunk(ids, 500) {
		if err := tx.Model(&PerfMetric{}).Where("id IN ?", chunk).Update("group", newName).Error; err != nil {
			return err
		}
	}
	return nil
}

// saveGroupOptions writes rewritten group options. An alias option that has
// no row of its own is left out of options, so it is neither stored nor
// applied.
func saveGroupOptions(tx *gorm.DB, options map[string]string) error {
	for _, item := range groupNameOptions {
		value, ok := options[item.key]
		if !ok {
			continue
		}
		option := Option{Key: item.key}
		if item.storedOnly {
			var count int64
			if err := tx.Model(&Option{}).Where(commonKeyCol+" = ?", item.key).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				delete(options, item.key)
				continue
			}
		}
		if err := tx.FirstOrCreate(&option, Option{Key: item.key}).Error; err != nil {
			return err
		}
		option.Value = value
		if err := tx.Save(&option).Error; err != nil {
			return err
		}
	}
	return nil
}

// validateGroupRenames resolves the requested renames against the registry
// and returns them as an old-name to new-name map.
func validateGroupRenames(renames []GroupRename) (map[string]string, error) {
	activeGroups := ratio_setting.GetGroupRatioCopy()
	byOldName := make(map[string]string, len(renames))
	seenIds := make(map[int]bool, len(renames))
	targets := make(map[string]bool, len(renames))
	for _, rename := range renames {
		newName := strings.TrimSpace(rename.Name)
		if seenIds[rename.Id] {
			return nil, common.NewMessage("Group {{id}} is renamed more than once", map[string]any{"id": rename.Id})
		}
		seenIds[rename.Id] = true
		oldName, ok := GroupNameById(rename.Id)
		if !ok {
			return nil, common.NewMessage("Group {{id}} does not exist", map[string]any{"id": rename.Id})
		}
		if newName == oldName {
			continue
		}
		// New users and channels get "default" from column defaults, so the
		// name must keep existing.
		if oldName == "default" {
			return nil, common.NewMessage("The default group cannot be renamed")
		}
		if newName == "" || newName == "auto" || strings.Contains(newName, ",") ||
			strings.HasPrefix(newName, "+:") || strings.HasPrefix(newName, "-:") ||
			utf8.RuneCountInString(newName) > maxGroupNameLength {
			return nil, common.NewMessage("Invalid group name {{name}}. Use at most {{max}} characters without commas, and do not use auto or start with +: or -:", map[string]any{
				"name": newName,
				"max":  maxGroupNameLength,
			})
		}
		if _, active := activeGroups[newName]; active || targets[newName] {
			return nil, common.NewMessage("Group name {{name}} is already in use", map[string]any{"name": newName})
		}
		targets[newName] = true
		byOldName[oldName] = newName
	}
	for oldName := range byOldName {
		if targets[oldName] {
			return nil, common.NewMessage("Group name {{name}} is already in use", map[string]any{"name": oldName})
		}
	}
	return byOldName, nil
}

// RenameGroups renames registered groups and rewrites every stored reference
// to the old names in one transaction. Tokens follow their group ids, so
// existing API keys keep working under the new names.
func RenameGroups(renames []GroupRename) (map[string]string, error) {
	if err := loadGroupRegistry(); err != nil {
		return nil, err
	}
	byOldName, err := validateGroupRenames(renames)
	if err != nil || len(byOldName) == 0 {
		return byOldName, err
	}
	options, err := renameGroupsInOptions(byOldName)
	if err != nil {
		return nil, err
	}

	var affectedUserIds []int
	channelsChanged := false
	newNames := slices.Collect(maps.Values(byOldName))
	err = DB.Transaction(func(tx *gorm.DB) error {
		var groups []UserGroup
		if err := tx.Find(&groups).Error; err != nil {
			return err
		}
		for _, group := range groups {
			// A name taken by this rename is no longer the former name of any group.
			former := group.formerNames()
			kept := slices.DeleteFunc(slices.Clone(former), func(name string) bool {
				return slices.Contains(newNames, name)
			})
			updates := map[string]any{}
			if newName, ok := byOldName[group.Name]; ok {
				updates["name"] = newName
				kept = append(kept, group.Name)
			}
			if len(updates) == 0 && len(kept) == len(former) {
				continue
			}
			updates["former_names"] = ""
			if len(kept) > 0 {
				encoded, err := common.Marshal(kept)
				if err != nil {
					return err
				}
				updates["former_names"] = string(encoded)
			}
			if err := tx.Model(&UserGroup{}).Where("id = ?", group.Id).Updates(updates).Error; err != nil {
				return err
			}
		}
		for oldName, newName := range byOldName {
			var userIds []int
			if err := tx.Model(&User{}).Where(commonGroupCol+" = ?", oldName).Pluck("id", &userIds).Error; err != nil {
				return err
			}
			affectedUserIds = append(affectedUserIds, userIds...)
			for _, target := range groupNameColumns {
				where := target.column + " = ?"
				if target.column == "group" {
					where = commonGroupCol + " = ?"
				}
				if err := tx.Session(&gorm.Session{SkipHooks: true}).Model(target.model).
					Where(where, oldName).Update(target.column, newName).Error; err != nil {
					return fmt.Errorf("rename group in %T.%s: %w", target.model, target.column, err)
				}
			}
			if err := renameGroupInPerfMetrics(tx, oldName, newName); err != nil {
				return err
			}
			changed, err := renameGroupInChannels(tx, oldName, newName)
			if err != nil {
				return err
			}
			channelsChanged = channelsChanged || changed
		}
		settingUserIds, err := renameGroupsInUserSettings(tx, byOldName)
		if err != nil {
			return err
		}
		affectedUserIds = append(affectedUserIds, settingUserIds...)
		return saveGroupOptions(tx, options)
	})
	if err != nil {
		return nil, err
	}

	for key, value := range options {
		if err := updateOptionMap(key, value); err != nil {
			common.SysError(common.LogText("failed to apply renamed group option %s: %s", key, err.Error()))
		}
	}
	refreshGroupRegistryAfterOptionSync()
	// Rows that already carried a new name before a group took it belong to
	// that group now, and a channel that listed both names lists one.
	if _, err := bindStoredGroupIds(); err != nil {
		common.SysError(common.LogText("failed to bind group ids after group rename: %s", err.Error()))
	}
	slices.Sort(affectedUserIds)
	if err := invalidateUserCaches(slices.Compact(affectedUserIds)); err != nil {
		common.SysError(common.LogText("failed to invalidate user caches after group rename: %s", err.Error()))
	}
	if err := getSubscriptionPlanCache().Purge(); err != nil {
		common.SysError(common.LogText("failed to purge subscription plan cache: %s", err.Error()))
	}
	if err := getSubscriptionPlanInfoCache().Purge(); err != nil {
		common.SysError(common.LogText("failed to purge subscription plan info cache: %s", err.Error()))
	}
	if channelsChanged {
		InitChannelCache()
	}
	InvalidatePricingCache()
	return byOldName, nil
}
