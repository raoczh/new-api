package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
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
