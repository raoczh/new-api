package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGroupDisplaySettingsValidateAndApplyOrdering(t *testing.T) {
	previousOrder := GroupOrderJSONString()
	previousVendors := GroupVendorsJSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateGroupOrder(previousOrder))
		require.NoError(t, UpdateGroupVendors(previousVendors))
	})

	for _, invalid := range []string{`{}`, `null`, `["one","one"]`, `[" "]`} {
		assert.Error(t, ValidateGroupOrder(invalid))
	}
	for _, invalid := range []string{`[]`, `null`, `{" ":1}`} {
		assert.Error(t, ValidateGroupVendors(invalid))
	}
	assert.NoError(t, ValidateGroupVendors(`{"group":-1006}`))

	require.NoError(t, UpdateGroupOrder(`["premium","default"]`))
	require.NoError(t, UpdateGroupVendors(`{"premium":7,"default":3}`))
	assert.Equal(t, []string{"premium", "default", "new"}, OrderedGroupNames([]string{"new", "default", "premium"}))
	assert.Equal(t, map[string]int{"premium": 7, "default": 3}, GetGroupVendors())

	vendors := GetGroupVendors()
	vendors["premium"] = 99
	assert.Equal(t, 7, GetGroupVendors()["premium"], "callers cannot mutate configured vendor assignments")
}
