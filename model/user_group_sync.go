package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"gorm.io/gorm"
)

// The hooks below bind the group id whenever a row is written with a group
// name: the id comes from the name being written, never the other way round.
// A row is written either as a whole, where the hook sets the id on the row,
// or as a map of columns, where bindGroupIdsInUpdate adds the id column.

func (user *User) BeforeSave(tx *gorm.DB) error {
	user.GroupId = groupIdOf(user.Group)
	bindGroupIdsInUpdate(tx, map[string]string{"group": "group_id"})
	return nil
}

// BeforeCreate binds a user created without a group to the group the column
// default puts it in.
func (user *User) BeforeCreate(tx *gorm.DB) error {
	if user.Group == "" {
		user.GroupId = groupIdOf("default")
	}
	return nil
}

func (channel *Channel) BeforeSave(tx *gorm.DB) error {
	if columns, ok := tx.Statement.Dest.(map[string]any); ok {
		if group, ok := columns["group"].(string); ok {
			columns["group_ids"] = groupIdList((&Channel{Group: group}).GetGroups())
		}
		return nil
	}
	// Channels served from the cache are shared between requests, and their
	// test time and balance are saved through a column selection. Only a
	// write of the whole channel sets the ids on it.
	if len(tx.Statement.Selects) > 0 {
		return nil
	}
	channel.GroupIds = groupIdList(channel.GetGroups())
	return nil
}

// BeforeCreate binds a channel created without a group to the group the
// column default puts it in.
func (channel *Channel) BeforeCreate(tx *gorm.DB) error {
	if channel.Group == "" {
		channel.GroupIds = groupIdList([]string{"default"})
	}
	return nil
}

func (ability *Ability) BeforeSave(tx *gorm.DB) error {
	ability.GroupId = groupIdOf(ability.Group)
	bindGroupIdsInUpdate(tx, map[string]string{"group": "group_id"})
	return nil
}

func (task *Task) BeforeSave(tx *gorm.DB) error {
	task.GroupId = groupIdOf(task.Group)
	bindGroupIdsInUpdate(tx, map[string]string{"group": "group_id"})
	return nil
}

func (task *ImageStudioTask) BeforeSave(tx *gorm.DB) error {
	task.GroupId = groupIdOf(task.Group)
	bindGroupIdsInUpdate(tx, map[string]string{"group": "group_id"})
	return nil
}

func (p *SubscriptionPlan) BeforeSave(tx *gorm.DB) error {
	p.UpgradeGroupId = groupIdOf(p.UpgradeGroup)
	p.DowngradeGroupId = groupIdOf(p.DowngradeGroup)
	bindGroupIdsInUpdate(tx, map[string]string{
		"upgrade_group":   "upgrade_group_id",
		"downgrade_group": "downgrade_group_id",
	})
	return nil
}

func (s *UserSubscription) BeforeSave(tx *gorm.DB) error {
	s.UpgradeGroupId = groupIdOf(s.UpgradeGroup)
	s.PrevUserGroupId = groupIdOf(s.PrevUserGroup)
	s.DowngradeGroupId = groupIdOf(s.DowngradeGroup)
	bindGroupIdsInUpdate(tx, map[string]string{
		"upgrade_group":   "upgrade_group_id",
		"prev_user_group": "prev_user_group_id",
		"downgrade_group": "downgrade_group_id",
	})
	return nil
}

func (data *QuotaData) BeforeSave(tx *gorm.DB) error {
	data.UseGroupId = groupIdOf(data.UseGroup)
	return nil
}

func (metric *PerfMetric) BeforeSave(tx *gorm.DB) error {
	metric.GroupId = groupIdOf(metric.Group)
	return nil
}

func (probe *StatusProbe) BeforeSave(tx *gorm.DB) error {
	probe.GroupId = groupIdOf(probe.GroupName)
	return nil
}

func (result *IQProbeResult) BeforeSave(tx *gorm.DB) error {
	result.GroupId = groupIdOf(result.GroupName)
	return nil
}

// bindGroupIdColumn makes idColumn agree with nameColumn on every row of a
// table. A row written under a name its group was renamed from gets the
// present name, unless keepNames is set for a table whose names are part of a
// unique key. It returns the number of rows it changed.
func bindGroupIdColumn(table any, nameColumn, idColumn string, keepNames bool) (int64, error) {
	quotedName := nameColumn
	if nameColumn == "group" {
		quotedName = commonGroupCol
	}
	var pairs []struct {
		RefName string
		BoundId int
	}
	err := DB.Unscoped().Model(table).
		Select("COALESCE(" + quotedName + ", '') AS ref_name, COALESCE(" + idColumn + ", 0) AS bound_id").
		Group(quotedName + ", " + idColumn).Scan(&pairs).Error
	if err != nil {
		return 0, err
	}
	var changed int64
	for _, pair := range pairs {
		name := pair.RefName
		updates := map[string]any{}
		if isRegistrableGroupName(name) {
			if _, registered := GroupIdByName(name); !registered && !keepNames {
				if current, renamed := currentGroupName(name); renamed {
					updates[nameColumn] = current
					name = current
				}
			}
		}
		if id := groupIdOf(name); id != pair.BoundId {
			updates[idColumn] = id
		}
		if len(updates) == 0 {
			continue
		}
		rows := DB.Session(&gorm.Session{SkipHooks: true}).Unscoped().Model(table)
		if pair.RefName == "" {
			rows = rows.Where("(" + quotedName + " = '' OR " + quotedName + " IS NULL)")
		} else {
			rows = rows.Where(quotedName+" = ?", pair.RefName)
		}
		if pair.BoundId == 0 {
			rows = rows.Where("(" + idColumn + " = 0 OR " + idColumn + " IS NULL)")
		} else {
			rows = rows.Where(idColumn+" = ?", pair.BoundId)
		}
		result := rows.UpdateColumns(updates)
		if result.Error != nil {
			return changed, result.Error
		}
		changed += result.RowsAffected
	}
	return changed, nil
}

// bindChannelGroupIds makes the id list of every channel agree with its group
// list, and gives a group that is still listed under a former name its
// present name. It reports whether any group list changed.
func bindChannelGroupIds() (int64, bool, error) {
	var channels []Channel
	if err := DB.Select("id", "name", "group", "group_ids").Find(&channels).Error; err != nil {
		return 0, false, err
	}
	var bound int64
	renamedAny := false
	for i := range channels {
		channel := &channels[i]
		groups := channel.GetGroups()
		current := make([]string, 0, len(groups))
		renamed := false
		for _, group := range groups {
			if _, registered := GroupIdByName(group); !registered {
				if name, ok := currentGroupName(group); ok {
					group = name
					renamed = true
				}
			}
			if !slices.Contains(current, group) {
				current = append(current, group)
			}
		}
		if !renamed {
			ids := groupIdList(groups)
			if ids == channel.GroupIds {
				continue
			}
			if err := DB.Model(&Channel{}).Where("id = ?", channel.Id).UpdateColumn("group_ids", ids).Error; err != nil {
				return bound, renamedAny, err
			}
			bound++
			continue
		}
		groupList := strings.Join(current, ",")
		if len(groupList) > maxChannelGroupListLength {
			common.SysError(common.LogText("group check: the group list of channel %d is too long to rename, skipped", channel.Id))
			continue
		}
		var full Channel
		if err := DB.First(&full, channel.Id).Error; err != nil {
			return bound, renamedAny, err
		}
		full.Group = groupList
		err := DB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Model(&Channel{}).Where("id = ?", full.Id).UpdateColumns(map[string]any{
				"group":     groupList,
				"group_ids": groupIdList(current),
			}).Error; err != nil {
				return err
			}
			return full.UpdateAbilities(tx)
		})
		if err != nil {
			return bound, renamedAny, err
		}
		bound++
		renamedAny = true
	}
	return bound, renamedAny, nil
}

// existingGroupNames returns the names of the groups that exist: those of the
// saved group ratio option together with those in effect on this node. It
// reports false when the option was never saved or cannot be read, because
// nothing may be treated as removed on the strength of the built-in defaults.
func existingGroupNames() (map[string]bool, bool) {
	var option Option
	err := DB.Where(commonKeyCol+" = ?", "GroupRatio").First(&option).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			common.SysError(common.LogText("group check: failed to read the group ratio option: %s", err.Error()))
		}
		return nil, false
	}
	var ratios map[string]json.RawMessage
	if err := common.UnmarshalJsonStr(option.Value, &ratios); err != nil || len(ratios) == 0 {
		return nil, false
	}
	names := make(map[string]bool, len(ratios))
	for name := range ratios {
		names[name] = true
	}
	for name := range ratio_setting.GetGroupRatioCopy() {
		names[name] = true
	}
	return names, true
}

// removeGroupsFromOption drops the entries of removed groups from an option
// value of the given shape.
func removeGroupsFromOption(value string, shape groupOptionShape, removed func(string) bool) (string, error) {
	var kept any
	switch shape {
	case groupOptionList:
		var groups []string
		if err := common.UnmarshalJsonStr(value, &groups); err != nil {
			return "", err
		}
		kept = slices.DeleteFunc(groups, removed)
	case groupOptionMapKeys:
		var groups map[string]json.RawMessage
		if err := common.UnmarshalJsonStr(value, &groups); err != nil {
			return "", err
		}
		for name := range groups {
			if removed(name) {
				delete(groups, name)
			}
		}
		kept = groups
	default:
		var groups map[string]map[string]json.RawMessage
		if err := common.UnmarshalJsonStr(value, &groups); err != nil {
			return "", err
		}
		for name, items := range groups {
			if removed(name) {
				delete(groups, name)
				continue
			}
			for item := range items {
				target := item
				if shape == groupOptionSpecialUsable {
					// 特殊可用分组的 "+:" / "-:" 前缀表示添加或移除该分组。
					target = strings.TrimPrefix(strings.TrimPrefix(item, "+:"), "-:")
				}
				if removed(target) {
					delete(items, item)
				}
			}
		}
		kept = groups
	}
	data, err := common.Marshal(kept)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// removeGroupsFromOptions drops removed groups from every group option except
// the group ratio itself, and returns the keys it rewrote.
func removeGroupsFromOptions(removed func(string) bool) ([]string, error) {
	common.OptionMapRWMutex.RLock()
	current := make(map[string]string, len(groupNameOptions))
	for _, option := range groupNameOptions {
		current[option.key] = common.OptionMap[option.key]
	}
	common.OptionMapRWMutex.RUnlock()

	changed := make(map[string]string)
	for _, option := range groupNameOptions {
		value := strings.TrimSpace(current[option.key])
		if value == "" || option.key == "GroupRatio" || option.key == "group_ratio_setting.group_ratio" {
			continue
		}
		original, err := removeGroupsFromOption(value, option.shape, func(string) bool { return false })
		if err != nil {
			return nil, fmt.Errorf("parse option %s: %w", option.key, err)
		}
		kept, err := removeGroupsFromOption(value, option.shape, removed)
		if err != nil {
			return nil, fmt.Errorf("rewrite option %s: %w", option.key, err)
		}
		if kept != original {
			changed[option.key] = kept
		}
	}
	if len(changed) == 0 {
		return nil, nil
	}
	if err := DB.Transaction(func(tx *gorm.DB) error { return saveGroupOptions(tx, changed) }); err != nil {
		return nil, err
	}
	keys := make([]string, 0, len(changed))
	for key, value := range changed {
		if err := updateOptionMap(key, value); err != nil {
			common.SysError(common.LogText("failed to apply group option %s: %s", key, err.Error()))
		}
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys, nil
}

// removeGroupsFromUserSettings drops removed groups from the per-user extra
// and hidden group lists and the per-user group ratios, and returns the ids
// of the users it changed.
func removeGroupsFromUserSettings(removed func(string) bool) ([]int, error) {
	var users []User
	if err := DB.Select("id", "setting").
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
			kept := slices.DeleteFunc(slices.Clone(groups), func(group any) bool {
				name, ok := group.(string)
				return ok && removed(name)
			})
			if len(kept) != len(groups) {
				setting[field] = kept
				changed = true
			}
		}
		if ratios, ok := setting["group_ratios"].(map[string]any); ok {
			for name := range ratios {
				if removed(name) {
					delete(ratios, name)
					changed = true
				}
			}
		}
		if !changed {
			continue
		}
		data, err := common.Marshal(setting)
		if err != nil {
			return nil, err
		}
		if err := DB.Model(&User{}).Where("id = ?", user.Id).UpdateColumn("setting", string(data)).Error; err != nil {
			return nil, err
		}
		userIds = append(userIds, user.Id)
	}
	return userIds, nil
}

// groupsStillAssigned counts, per table, the rows that still belong to a group
// outside the saved group ratios. Such rows are reported and left alone:
// moving a user, key, channel or plan to another group changes what is billed.
func groupsStillAssigned(active map[string]bool) (map[string]map[string]int64, error) {
	activeNames := []string{"", "auto"}
	for name := range active {
		activeNames = append(activeNames, name)
	}
	assigned := make(map[string]map[string]int64)
	count := func(label, name string, total int64) {
		if assigned[label] == nil {
			assigned[label] = make(map[string]int64)
		}
		assigned[label][name] += total
	}
	owners := []struct {
		label  string
		table  any
		column string
		scope  string
	}{
		{"users", &User{}, "group", ""},
		{"tokens", &Token{}, "group", ""},
		{"subscription_plans", &SubscriptionPlan{}, "upgrade_group", ""},
		{"subscription_plans", &SubscriptionPlan{}, "downgrade_group", ""},
		{"user_subscriptions", &UserSubscription{}, "upgrade_group", "status = 'active'"},
		{"user_subscriptions", &UserSubscription{}, "prev_user_group", "status = 'active'"},
		{"user_subscriptions", &UserSubscription{}, "downgrade_group", "status = 'active'"},
	}
	for _, owner := range owners {
		column := owner.column
		if column == "group" {
			column = commonGroupCol
		}
		var rows []struct {
			RefName string
			Total   int64
		}
		query := DB.Model(owner.table).Select(column+" AS ref_name, COUNT(*) AS total").
			Where(column+" NOT IN ?", activeNames)
		if owner.scope != "" {
			query = query.Where(owner.scope)
		}
		if err := query.Group(column).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			count(owner.label, row.RefName, row.Total)
		}
	}
	var channels []Channel
	if err := DB.Select("id", "group").Find(&channels).Error; err != nil {
		return nil, err
	}
	for i := range channels {
		for _, group := range channels[i].GetGroups() {
			if group != "" && !active[group] {
				count("channels", group, 1)
			}
		}
	}
	return assigned, nil
}

// removeUnusedGroupIds deletes the registry rows of groups that no longer
// exist and that nothing is bound to. Keys read their group through the id,
// so a row a key still points at has to stay.
func removeUnusedGroupIds(inUseNames func(string) bool) (int64, error) {
	inUse := make(map[int]bool)
	var groupIds []int
	if err := DB.Model(&Token{}).Where("group_id > 0").Distinct().Pluck("group_id", &groupIds).Error; err != nil {
		return 0, err
	}
	for _, id := range groupIds {
		inUse[id] = true
	}
	var autoGroupIds []string
	if err := DB.Model(&Token{}).Where("auto_group_ids IS NOT NULL AND auto_group_ids <> ''").
		Distinct().Pluck("auto_group_ids", &autoGroupIds).Error; err != nil {
		return 0, err
	}
	for _, encoded := range autoGroupIds {
		var ids []int
		if err := common.UnmarshalJsonStr(encoded, &ids); err != nil {
			continue
		}
		for _, id := range ids {
			inUse[id] = true
		}
	}
	var groups []UserGroup
	if err := DB.Find(&groups).Error; err != nil {
		return 0, err
	}
	var unused []int
	for _, group := range groups {
		if !inUseNames(group.Name) && !inUse[group.Id] {
			unused = append(unused, group.Id)
		}
	}
	if len(unused) == 0 {
		return 0, nil
	}
	result := DB.Where("id IN ?", unused).Delete(&UserGroup{})
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, loadGroupRegistry()
}

// bindStoredGroupIds makes the group id of every stored group reference agree
// with the group name stored next to it, and gives a row written under a name
// its group was renamed from the present name. It returns the number of rows
// it changed.
func bindStoredGroupIds() (int64, error) {
	// Users read their group through a cache that outlives a restart.
	var renamedUserIds []int
	groupRegistry.RLock()
	formerNames := slices.Collect(maps.Keys(groupRegistry.former))
	groupRegistry.RUnlock()
	if len(formerNames) > 0 {
		if err := DB.Model(&User{}).Where(commonGroupCol+" IN ?", formerNames).Pluck("id", &renamedUserIds).Error; err != nil {
			return 0, err
		}
	}

	var bound int64
	for _, target := range groupNameColumns {
		if target.idColumn == "" {
			continue
		}
		changed, err := bindGroupIdColumn(target.model, target.column, target.idColumn, false)
		if err != nil {
			return bound, fmt.Errorf("bind group ids in %T.%s: %w", target.model, target.column, err)
		}
		bound += changed
	}
	var perfGroups []string
	if err := DB.Model(&PerfMetric{}).Distinct().Pluck(commonGroupCol, &perfGroups).Error; err != nil {
		return bound, err
	}
	for _, group := range perfGroups {
		if current, renamed := currentGroupName(group); renamed {
			if err := renameGroupInPerfMetrics(DB, group, current); err != nil {
				return bound, err
			}
		}
	}
	channelsBound, channelsRenamed, err := bindChannelGroupIds()
	if err != nil {
		return bound, err
	}
	bound += channelsBound
	// (model, group, bucket) and (group, model, channel) are unique, so these
	// rows keep the name they have and only take its id.
	for _, table := range []any{&PerfMetric{}, &Ability{}} {
		changed, err := bindGroupIdColumn(table, "group", "group_id", true)
		if err != nil {
			return bound, fmt.Errorf("bind group ids in %T: %w", table, err)
		}
		bound += changed
	}
	if channelsRenamed {
		InitChannelCache()
	}
	if err := invalidateUserCaches(renamedUserIds); err != nil {
		common.SysError(common.LogText("failed to invalidate user caches after the group check: %s", err.Error()))
	}
	return bound, nil
}

// SyncGroupReferences is the startup check of every stored group reference,
// run by the master node after the options, the group registry and Redis are
// ready. It binds rows that name a group without its id, corrects names a
// group was renamed from, and clears what removed groups left behind in the
// group settings, the per-user group settings and the group registry. Users,
// API keys, channels and plans that still belong to a removed group are only
// reported. The check changes nothing on a second run.
func SyncGroupReferences() error {
	if err := RefreshGroupRegistry(); err != nil {
		return err
	}
	active, saved := existingGroupNames()
	bound, err := bindStoredGroupIds()
	if err != nil {
		return err
	}
	if bound > 0 {
		common.SysLog(common.LogText("group check: bound %d rows to their group ids", bound))
	}
	if !saved {
		return nil
	}

	assigned, err := groupsStillAssigned(active)
	if err != nil {
		return err
	}
	stillAssigned := make(map[string]bool)
	labels := make([]string, 0, len(assigned))
	for label, groups := range assigned {
		labels = append(labels, label)
		for name := range groups {
			stillAssigned[name] = true
		}
	}
	slices.Sort(labels)
	for _, label := range labels {
		names := make([]string, 0, len(assigned[label]))
		for name, total := range assigned[label] {
			names = append(names, fmt.Sprintf("%s (%d)", name, total))
		}
		slices.Sort(names)
		common.SysLog(common.LogText("group check: %s still assigned to removed groups: %s", label, strings.Join(names, ", ")))
	}
	// A removed group that still owns users, keys, channels or plans keeps its
	// id and its settings, so nothing changes for them until an administrator
	// moves them.
	leftover := func(name string) bool {
		return name != "auto" && !active[name] && !stillAssigned[name]
	}
	removedIds, err := removeUnusedGroupIds(func(name string) bool { return !leftover(name) })
	if err != nil {
		return err
	}
	if removedIds > 0 {
		common.SysLog(common.LogText("group check: removed %d unused group ids of removed groups", removedIds))
		// History rows of those groups keep their name and lose the id.
		if _, err := bindStoredGroupIds(); err != nil {
			return err
		}
	}
	optionKeys, err := removeGroupsFromOptions(leftover)
	if err != nil {
		return err
	}
	if len(optionKeys) > 0 {
		common.SysLog(common.LogText("group check: removed leftover groups from settings: %s", strings.Join(optionKeys, ", ")))
	}
	userIds, err := removeGroupsFromUserSettings(leftover)
	if err != nil {
		return err
	}
	if len(userIds) > 0 {
		common.SysLog(common.LogText("group check: removed leftover groups from the settings of %d users", len(userIds)))
		if err := invalidateUserCaches(userIds); err != nil {
			common.SysError(common.LogText("failed to invalidate user caches after the group check: %s", err.Error()))
		}
	}
	return nil
}
