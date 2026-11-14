package model

import (
	"maps"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"gorm.io/gorm"
)

// UserGroup gives every group name a stable id. Every table that stores a
// group name also stores this id next to it. Tokens read their group through
// the id, so renaming a group keeps every existing API key attached to it; the
// other tables keep the name as the working value and carry the id as the
// binding that a rename and the startup check follow.
//
// Name is deliberately not unique in the database: MySQL compares strings
// case-insensitively, while group names are case-sensitive keys everywhere
// else. Lookups therefore compare names exactly in Go, and a rename updates
// every row that carries the old name.
type UserGroup struct {
	Id          int    `json:"id"`
	Name        string `json:"name" gorm:"type:varchar(64);not null"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
	// FormerNames is the JSON list of names this group was renamed from. A row
	// written under one of them after the rename still finds its group.
	FormerNames string `json:"-" gorm:"type:text"`
}

func (group *UserGroup) formerNames() []string {
	var names []string
	if group.FormerNames != "" {
		_ = common.UnmarshalJsonStr(group.FormerNames, &names)
	}
	return names
}

var groupRegistry = struct {
	sync.RWMutex
	names map[int]string
	ids   map[string]int
	// former maps a name no group uses any more to the one group that was
	// renamed from it.
	former map[string]int
}{names: map[int]string{}, ids: map[string]int{}, former: map[string]int{}}

// isRegistrableGroupName reports whether a token group value names a real
// group: an empty value follows the user's group and "auto" is a routing mode.
func isRegistrableGroupName(name string) bool {
	return name != "" && name != "auto"
}

func storeGroupRegistry(groups []UserGroup) {
	names := make(map[int]string, len(groups))
	ids := make(map[string]int, len(groups))
	for _, group := range groups {
		names[group.Id] = group.Name
		if id, ok := ids[group.Name]; !ok || group.Id < id {
			ids[group.Name] = group.Id
		}
	}
	former := make(map[string]int)
	ambiguous := make(map[string]bool)
	for _, group := range groups {
		for _, name := range group.formerNames() {
			if _, inUse := ids[name]; inUse || ambiguous[name] {
				continue
			}
			if id, ok := former[name]; ok && id != group.Id {
				delete(former, name)
				ambiguous[name] = true
				continue
			}
			former[name] = group.Id
		}
	}
	groupRegistry.Lock()
	groupRegistry.names = names
	groupRegistry.ids = ids
	groupRegistry.former = former
	groupRegistry.Unlock()
}

func loadGroupRegistry() error {
	var groups []UserGroup
	if err := DB.Order("id").Find(&groups).Error; err != nil {
		return err
	}
	storeGroupRegistry(groups)
	return nil
}

func GroupNameById(id int) (string, bool) {
	groupRegistry.RLock()
	defer groupRegistry.RUnlock()
	name, ok := groupRegistry.names[id]
	return name, ok
}

func GroupIdByName(name string) (int, bool) {
	groupRegistry.RLock()
	defer groupRegistry.RUnlock()
	id, ok := groupRegistry.ids[name]
	return id, ok
}

// groupIdOf returns the id bound to name, or 0 for a name that is not a
// registered group.
func groupIdOf(name string) int {
	id, _ := GroupIdByName(name)
	return id
}

// groupIdList encodes the ids of a channel's groups in the order of its group
// list, with 0 for a name that is not a registered group.
func groupIdList(groups []string) string {
	ids := make([]string, len(groups))
	for i, group := range groups {
		ids[i] = strconv.Itoa(groupIdOf(strings.TrimSpace(group)))
	}
	return strings.Join(ids, ",")
}

// currentGroupName returns the present name of the group that was renamed
// from name. It reports false for a name that is in use or was never a group.
func currentGroupName(name string) (string, bool) {
	groupRegistry.RLock()
	defer groupRegistry.RUnlock()
	id, ok := groupRegistry.former[name]
	if !ok {
		return "", false
	}
	current, ok := groupRegistry.names[id]
	return current, ok
}

// bindGroupIdsInUpdate adds the group id to an update that sets a group name
// through a map of columns. idByNameColumn maps each name column to its id
// column.
func bindGroupIdsInUpdate(tx *gorm.DB, idByNameColumn map[string]string) {
	columns, ok := tx.Statement.Dest.(map[string]any)
	if !ok {
		return
	}
	for nameColumn, idColumn := range idByNameColumn {
		if name, ok := columns[nameColumn].(string); ok {
			columns[idColumn] = groupIdOf(name)
		}
	}
}

// GetGroupRegistry returns the id of every group name the registry knows.
func GetGroupRegistry() map[string]int {
	groupRegistry.RLock()
	defer groupRegistry.RUnlock()
	return maps.Clone(groupRegistry.ids)
}

// EnsureGroupId returns the id a reference to name binds to: the group with
// that name, or else the group that was renamed from it. A name nothing is
// known about is registered.
func EnsureGroupId(name string) (int, error) {
	if id, ok := GroupIdByName(name); ok {
		return id, nil
	}
	// Another node may have registered or renamed the group since the last sync.
	if err := loadGroupRegistry(); err != nil {
		return 0, err
	}
	if id, ok := GroupIdByName(name); ok {
		return id, nil
	}
	groupRegistry.RLock()
	renamedId, renamed := groupRegistry.former[name]
	groupRegistry.RUnlock()
	if renamed {
		return renamedId, nil
	}
	return registerGroupName(name)
}

// registerGroupName gives name an id of its own. A name listed in the group
// ratios is a group in its own right even when another group was once called
// that.
func registerGroupName(name string) (int, error) {
	if id, ok := GroupIdByName(name); ok {
		return id, nil
	}
	group := UserGroup{Name: name, CreatedTime: common.GetTimestamp()}
	if err := DB.Create(&group).Error; err != nil {
		return 0, err
	}
	groupRegistry.Lock()
	groupRegistry.names[group.Id] = group.Name
	groupRegistry.ids[group.Name] = group.Id
	delete(groupRegistry.former, group.Name)
	groupRegistry.Unlock()
	return group.Id, nil
}

// RefreshGroupRegistry reloads the registry and registers groups that were
// added to the group ratio settings since the last refresh.
func RefreshGroupRegistry() error {
	if err := loadGroupRegistry(); err != nil {
		return err
	}
	names := slices.Sorted(maps.Keys(ratio_setting.GetGroupRatioCopy()))
	for _, name := range names {
		if !isRegistrableGroupName(name) {
			continue
		}
		if _, err := registerGroupName(name); err != nil {
			return err
		}
	}
	return nil
}

const groupBackfillBatchSize = 500

// InitGroupRegistry loads the group registry at startup. The master node also
// binds tokens that still reference groups only by name, which covers data
// written before group ids existed; the backfill is idempotent. Every other
// stored group reference is checked by SyncGroupReferences once the caches
// it has to invalidate are connected.
func InitGroupRegistry() error {
	if err := RefreshGroupRegistry(); err != nil {
		return err
	}
	if !common.IsMasterNode {
		return nil
	}
	return backfillTokenGroupIds()
}

func backfillTokenGroupIds() error {
	pending := "((group_id = 0 AND " + commonGroupCol + " NOT IN (?)) OR " +
		"(auto_groups <> '' AND (auto_group_ids IS NULL OR auto_group_ids = '')))"
	bound := 0
	lastId := 0
	for {
		var tokens []Token
		err := DB.Model(&Token{}).
			Select("id", "group", "group_id", "auto_groups", "auto_group_ids").
			Where("id > ?", lastId).
			Where(pending, []string{"", "auto"}).
			Order("id").Limit(groupBackfillBatchSize).
			Find(&tokens).Error
		if err != nil {
			return err
		}
		if len(tokens) == 0 {
			break
		}
		lastId = tokens[len(tokens)-1].Id
		tokenIdsByGroup := make(map[int][]int)
		for i := range tokens {
			token := &tokens[i]
			if token.GroupId == 0 && isRegistrableGroupName(token.Group) {
				groupId, err := EnsureGroupId(token.Group)
				if err != nil {
					return err
				}
				tokenIdsByGroup[groupId] = append(tokenIdsByGroup[groupId], token.Id)
			}
			if token.AutoGroups == "" || token.AutoGroupIds != "" {
				continue
			}
			names, err := token.GetAutoGroups()
			if err != nil {
				common.SysError(common.LogText("failed to parse auto groups for token %d: %v", token.Id, err))
				continue
			}
			if len(names) == 0 {
				continue
			}
			autoGroupIds, err := groupIdsJSON(names)
			if err != nil {
				return err
			}
			if err := DB.Model(&Token{}).Where("id = ?", token.Id).
				Update("auto_group_ids", autoGroupIds).Error; err != nil {
				return err
			}
			bound++
		}
		for groupId, tokenIds := range tokenIdsByGroup {
			if err := DB.Model(&Token{}).Where("id IN ?", tokenIds).
				Update("group_id", groupId).Error; err != nil {
				return err
			}
			bound += len(tokenIds)
		}
	}
	if bound > 0 {
		common.SysLog(common.LogText("bound %d token group references to group ids", bound))
	}
	return nil
}
