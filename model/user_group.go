package model

import (
	"maps"
	"slices"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// UserGroup gives every group name a stable id. Group settings, channels and
// abilities stay keyed by name, while tokens bind to the id, so renaming a
// group keeps every existing API key attached to it.
//
// Name is deliberately not unique in the database: MySQL compares strings
// case-insensitively, while group names are case-sensitive keys everywhere
// else. Lookups therefore compare names exactly in Go, and a rename updates
// every row that carries the old name.
type UserGroup struct {
	Id          int    `json:"id"`
	Name        string `json:"name" gorm:"type:varchar(64);not null"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
}

var groupRegistry = struct {
	sync.RWMutex
	names map[int]string
	ids   map[string]int
}{names: map[int]string{}, ids: map[string]int{}}

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
	groupRegistry.Lock()
	groupRegistry.names = names
	groupRegistry.ids = ids
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

// GetGroupRegistry returns the id of every group name the registry knows.
func GetGroupRegistry() map[string]int {
	groupRegistry.RLock()
	defer groupRegistry.RUnlock()
	return maps.Clone(groupRegistry.ids)
}

// EnsureGroupId returns the id bound to name, registering the name when no
// node has done so yet.
func EnsureGroupId(name string) (int, error) {
	if id, ok := GroupIdByName(name); ok {
		return id, nil
	}
	// Another node may have registered the name since the last sync.
	if err := loadGroupRegistry(); err != nil {
		return 0, err
	}
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
		if _, err := EnsureGroupId(name); err != nil {
			return err
		}
	}
	return nil
}

const groupBackfillBatchSize = 500

// InitGroupRegistry loads the group registry at startup. The master node also
// binds tokens that still reference groups only by name, which covers data
// written before group ids existed; the backfill is idempotent.
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
