package setting

import (
	"errors"
	"maps"
	"slices"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var groupDisplay = struct {
	sync.RWMutex
	order   []string
	vendors map[string]int
}{order: []string{}, vendors: map[string]int{}}

func ValidateGroupOrder(value string) error {
	var order []string
	if err := common.UnmarshalJsonStr(value, &order); err != nil {
		return err
	}
	if order == nil {
		return errors.New("group order must be a JSON array")
	}
	seen := map[string]bool{}
	for _, name := range order {
		if strings.TrimSpace(name) == "" || seen[name] {
			return errors.New("group order must contain unique non-empty group names")
		}
		seen[name] = true
	}
	return nil
}

func UpdateGroupOrder(value string) error {
	if err := ValidateGroupOrder(value); err != nil {
		return err
	}
	var order []string
	if err := common.UnmarshalJsonStr(value, &order); err != nil {
		return err
	}
	groupDisplay.Lock()
	groupDisplay.order = order
	groupDisplay.Unlock()
	return nil
}

// OrderedGroupNames filters stale settings and appends newly added groups in
// name order, so every caller uses the same stable display order.
func OrderedGroupNames(names []string) []string {
	remaining := map[string]bool{}
	for _, name := range names {
		remaining[name] = true
	}
	groupDisplay.RLock()
	ordered := make([]string, 0, len(remaining))
	for _, name := range groupDisplay.order {
		if remaining[name] {
			ordered = append(ordered, name)
			delete(remaining, name)
		}
	}
	groupDisplay.RUnlock()
	tail := slices.Sorted(maps.Keys(remaining))
	return append(ordered, tail...)
}

func GroupOrderJSONString() string {
	groupDisplay.RLock()
	defer groupDisplay.RUnlock()
	return common.GetJsonString(groupDisplay.order)
}

func ValidateGroupVendors(value string) error {
	var vendors map[string]int
	if err := common.UnmarshalJsonStr(value, &vendors); err != nil {
		return err
	}
	if vendors == nil {
		return errors.New("group vendors must be a JSON object")
	}
	for name := range vendors {
		if strings.TrimSpace(name) == "" {
			return errors.New("group vendors must contain non-empty group names")
		}
	}
	return nil
}

func UpdateGroupVendors(value string) error {
	if err := ValidateGroupVendors(value); err != nil {
		return err
	}
	var vendors map[string]int
	if err := common.UnmarshalJsonStr(value, &vendors); err != nil {
		return err
	}
	groupDisplay.Lock()
	groupDisplay.vendors = vendors
	groupDisplay.Unlock()
	return nil
}

func GetGroupVendors() map[string]int {
	groupDisplay.RLock()
	defer groupDisplay.RUnlock()
	return maps.Clone(groupDisplay.vendors)
}

func GroupVendorsJSONString() string {
	groupDisplay.RLock()
	defer groupDisplay.RUnlock()
	return common.GetJsonString(groupDisplay.vendors)
}
