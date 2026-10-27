package controller

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGroupProbeRotation(t *testing.T) {
	rotation := groupProbeRotation{LastModel: "a", Remaining: []string{"b", "c"}}
	assert.Equal(t, "b", rotation.Next([]string{"a", "b", "c"}))
	assert.Equal(t, "c", rotation.Next([]string{"a", "b", "c"}))
	next := rotation.Next([]string{"a", "b", "c"})
	assert.NotEqual(t, "c", next, "reshuffling must not repeat the previous model")
	assert.Len(t, rotation.Remaining, 2)
	assert.NotContains(t, rotation.Remaining, next)
	assert.Equal(t, "a", rotation.Next([]string{"a"}), "removed models must not be selected")
	assert.Equal(t, "a", rotation.Next([]string{"a"}), "a single model necessarily repeats")
	assert.Empty(t, rotation.Next(nil))
	for _, tc := range []struct {
		model     string
		endpoints []constant.EndpointType
		want      constant.EndpointType
	}{
		{"gpt-image-1", []constant.EndpointType{constant.EndpointTypeImageGeneration, constant.EndpointTypeOpenAI}, ""},
		{"gemini-2.5-flash-image", []constant.EndpointType{constant.EndpointTypeGemini, constant.EndpointTypeOpenAI}, ""},
		{"gemini-nano-banana-2.1", []constant.EndpointType{constant.EndpointTypeGemini, constant.EndpointTypeOpenAI}, ""},
		{"seedream-4", []constant.EndpointType{constant.EndpointTypeOpenAI}, ""},
		{"video-alias", []constant.EndpointType{constant.EndpointTypeOpenAIVideo, constant.EndpointTypeOpenAI}, ""},
		{"text-embedding-3-small", []constant.EndpointType{constant.EndpointTypeOpenAI}, constant.EndpointTypeEmbeddings},
		{"vector-alias", []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeEmbeddings}, constant.EndpointTypeEmbeddings},
		{"bge-reranker", []constant.EndpointType{constant.EndpointTypeOpenAI}, constant.EndpointTypeJinaRerank},
		{"claude-test", []constant.EndpointType{constant.EndpointTypeAnthropic, constant.EndpointTypeOpenAI}, constant.EndpointTypeAnthropic},
		{"custom-text", []constant.EndpointType{constant.EndpointTypeOpenAIResponse}, constant.EndpointTypeOpenAIResponse},
	} {
		assert.Equal(t, string(tc.want), probeEndpoint(tc.model, tc.endpoints), tc.model)
	}
}

// The automatic group probe skips generative media models by name. A configured
// model type must win over those name heuristics in both directions, otherwise
// a native image model with an unfamiliar name would be probed as chat and a
// text model whose name mentions "image" would never be probed.
func TestProbeEndpointFollowsConfiguredModelTypes(t *testing.T) {
	withConfiguredModelTypes(t, map[string]string{
		"zz-image-named-text": common.ModelTypeText,
		"zz-plain-image":      common.ModelTypeImage,
		"*-motion":            common.ModelTypeVideo,
	})
	openAI := []constant.EndpointType{constant.EndpointTypeOpenAI}

	assert.Equal(t, string(constant.EndpointTypeOpenAI), probeEndpoint("zz-image-named-text", openAI),
		"an explicit text type keeps a model probeable despite its name")
	assert.Equal(t, "", probeEndpoint("zz-plain-image", openAI),
		"an explicit image type skips the probe despite a neutral name")
	assert.Equal(t, "", probeEndpoint("zz-veo-motion", openAI),
		"a wildcard video entry skips the probe")
	assert.Equal(t, string(constant.EndpointTypeOpenAI), probeEndpoint("zz-unconfigured-chat", openAI))
}

func TestModelTestsRecordOnlySuccessfulManualChecksAndAllAutomaticOutcomes(t *testing.T) {
	for _, dialect := range []struct{ name, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.name, func(t *testing.T) {
			if dialect.env != "" && os.Getenv(dialect.env) == "" {
				t.Skip("set " + dialect.env + " to run this database")
			}
			testModelTestRecords(t, dialect.name, os.Getenv(dialect.env))
		})
	}
}

func testModelTestRecords(t *testing.T, dialect, dsn string) {
	t.Helper()
	db := modelManagementDB(t, dialect, dsn)
	require.NoError(t, db.AutoMigrate(&model.StatusProbe{}, &model.Log{}, &model.PerfMetric{}, &model.SystemTask{}, &model.SystemTaskLock{}))
	withTieredBillingConfig(t, map[string]string{
		"gpt-4o-mini": "tiered_expr", "gpt-4o": "tiered_expr",
		"vector-alias": "tiered_expr", "rank-alias": "tiered_expr",
	}, map[string]string{
		"gpt-4o-mini": `tier("base", p * 1 + c * 1)`, "gpt-4o": `tier("base", p * 1 + c * 1)`,
		"vector-alias": `tier("base", p * 1)`, "rank-alias": `tier("base", p * 1)`,
	})
	oldCache, oldLogConsume := common.MemoryCacheEnabled, common.LogConsumeEnabled
	oldDataExport := common.DataExportEnabled
	perfSetting := perf_metrics_setting.GetSetting()
	oldPerfEnabled := perfSetting.Enabled
	perfSetting.Enabled = true
	oldRatios := ratio_setting.GroupRatio2JSONString()
	common.MemoryCacheEnabled, common.LogConsumeEnabled, common.DataExportEnabled = false, true, true
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":0.35}`))
	t.Cleanup(func() {
		common.MemoryCacheEnabled, common.LogConsumeEnabled, common.DataExportEnabled = oldCache, oldLogConsume, oldDataExport
		perfSetting.Enabled = oldPerfEnabled
		model.CacheQuotaDataLock.Lock()
		model.CacheQuotaData = make(map[string]*model.QuotaData)
		model.CacheQuotaDataLock.Unlock()
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(oldRatios))
		model.InvalidatePricingCache()
	})
	user := model.User{Username: "probe-root", Password: "unused", Group: "default", Role: common.RoleRootUser, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&user).Error)
	var reject atomic.Bool
	var vectorTested, rerankTested atomic.Bool
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if reject.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":{"message":"unavailable","type":"server_error"}}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/v1/embeddings" {
			vectorTested.Store(true)
			_, _ = w.Write([]byte(`{"object":"list","data":[{"object":"embedding","embedding":[0.1,0.2],"index":0}],"usage":{"prompt_tokens":1,"total_tokens":1}}`))
			return
		}
		if r.URL.Path == "/v1/rerank" {
			rerankTested.Store(true)
			_, _ = w.Write([]byte(`{"results":[{"index":0,"relevance_score":0.9}],"usage":{"total_tokens":1}}`))
			return
		}
		_, _ = w.Write([]byte(`{"id":"test","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`))
	}))
	t.Cleanup(upstream.Close)
	channel := &model.Channel{Type: constant.ChannelTypeOpenAI, Key: "test-key", BaseURL: common.GetPointer(upstream.URL), Name: "probe", Models: "gpt-4o-mini,gpt-4o,vector-alias,rank-alias", Group: "default,vip", Status: common.ChannelStatusEnabled}
	require.NoError(t, channel.Insert())
	require.NoError(t, db.Create(&[]model.Model{
		{ModelName: "vector-alias", Endpoints: `{"embeddings":"/v1/embeddings"}`, Status: 1},
		{ModelName: "rank-alias", Endpoints: `{"jina-rerank":"/v1/rerank"}`, Status: 1},
	}).Error)
	service.InitHttpClient()
	for _, tc := range []struct {
		name         string
		options      channelTestOptions
		fail         bool
		count        int
		source       string
		expectedType int
		expectLog    bool
	}{
		{"successful manual", channelTestOptions{manual: true}, false, 2, "manual_test", 0, false},
		{"failed manual", channelTestOptions{manual: true}, true, 0, "manual_test", 0, false},
		{"successful automatic", channelTestOptions{probe: true, group: "default"}, false, 1, "auto_probe", model.LogTypeConsume, true},
		{"failed automatic", channelTestOptions{probe: true, group: "vip"}, true, 1, "auto_probe", model.LogTypeError, true},
		{"successful IQ", channelTestOptions{iqPrompt: "Reply with 42", group: "default"}, false, 0, "iq_probe", model.LogTypeConsume, true},
		{"failed IQ", channelTestOptions{iqPrompt: "Reply with 42", group: "vip"}, true, 0, "iq_probe", model.LogTypeError, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, db.Where("1 = 1").Delete(&model.StatusProbe{}).Error)
			model.CacheQuotaDataLock.Lock()
			model.CacheQuotaData = make(map[string]*model.QuotaData)
			model.CacheQuotaDataLock.Unlock()
			var logsBefore int64
			require.NoError(t, db.Model(&model.Log{}).Count(&logsBefore).Error)
			reject.Store(tc.fail)
			result := runChannelTest(context.Background(), channel, user.Id, "gpt-4o-mini", "openai", false, tc.options)
			if tc.fail {
				require.Error(t, result.localErr)
			} else {
				require.NoError(t, result.localErr)
				require.Nil(t, result.newAPIError)
			}
			if tc.fail {
				assert.Empty(t, model.CacheQuotaData, "failed probes must not enter the dashboard aggregation")
			} else if tc.expectLog {
				assert.NotEmpty(t, model.CacheQuotaData, "successful probes still record upstream usage in the dashboard aggregation")
			}
			var probes []model.StatusProbe
			require.NoError(t, db.Order("id ASC").Find(&probes).Error)
			require.Len(t, probes, tc.count)
			if tc.options.probe {
				assert.Equal(t, tc.source, probes[len(probes)-1].Source)
				assert.Equal(t, "gpt-4o-mini", probes[len(probes)-1].ModelName)
				assert.Equal(t, tc.options.group, probes[len(probes)-1].GroupName)
				assert.Equal(t, !tc.fail, probes[len(probes)-1].Success)
			}
			if !tc.expectLog {
				return
			}
			var logsAfter int64
			require.NoError(t, db.Model(&model.Log{}).Count(&logsAfter).Error)
			assert.Equal(t, logsBefore+1, logsAfter, "each upstream probe must create one usage record")
			var log model.Log
			require.NoError(t, db.Order("id DESC").First(&log).Error)
			assert.Equal(t, tc.options.group, log.Group)
			assert.Equal(t, "gpt-4o-mini", log.ModelName)
			assert.Equal(t, channel.Id, log.ChannelId)
			assert.Equal(t, user.Id, log.UserId)
			assert.Equal(t, tc.expectedType, log.Type)
			assert.NotEmpty(t, log.RequestId)
			if tc.fail {
				assert.Zero(t, log.Quota, "failed probes have no upstream usage to settle")
				assert.Zero(t, log.PromptTokens)
				assert.Zero(t, log.CompletionTokens)
			} else {
				assert.Greater(t, log.Quota, 0, "successful probes should record the upstream usage cost")
				assert.Equal(t, 1, log.PromptTokens)
				assert.Equal(t, 1, log.CompletionTokens)
			}
			if tc.options.iqPrompt != "" {
				assert.Equal(t, "IQ probe", log.TokenName)
				assert.Contains(t, log.Content, "IQ probe")
				if tc.fail {
					assert.Contains(t, log.Content, "IQ probe failed")
				}
				assert.Contains(t, log.Other, `"content_parts"`)
				return
			}
			assert.Equal(t, "Group auto probe", log.TokenName)
			if tc.fail {
				assert.Contains(t, log.Content, "Group auto probe failed")
				assert.Contains(t, log.Other, `"content_parts"`)
			}
		})
	}
	// Successful manual batch tests use the same sampling rule; scheduled channel
	// health checks stay separate from group probes.
	for _, manual := range []bool{false, true} {
		reject.Store(false)
		require.NoError(t, db.Where("1 = 1").Delete(&model.StatusProbe{}).Error)
		result := performChannelTests(context.Background(), []*model.Channel{channel}, user.Id, false, manual, 1, nil)
		require.Equal(t, 1, result.Succeeded)
		var count int64
		require.NoError(t, db.Model(&model.StatusProbe{}).Count(&count).Error)
		if manual {
			assert.EqualValues(t, 2, count)
		} else {
			assert.Zero(t, count)
		}
	}
	// The system-task lease persists the shuffled bag across independent runs.
	reject.Store(false)
	model.InvalidatePricingCache()
	previousProbeEnabled := groupProbeHandler{}.Enabled()
	t.Cleanup(func() {
		require.NoError(t, model.UpdateRequestPolicyOptions(map[string]string{
			"monitor_setting.auto_probe_enabled": fmt.Sprintf("%t", previousProbeEnabled),
		}))
	})
	require.NoError(t, model.UpdateRequestPolicyOptions(map[string]string{"monitor_setting.auto_probe_enabled": "false"}))
	assert.False(t, groupProbeHandler{}.Enabled())
	var logsBeforeDisabledRun, probesBeforeDisabledRun int64
	require.NoError(t, db.Model(&model.Log{}).Count(&logsBeforeDisabledRun).Error)
	require.NoError(t, db.Model(&model.StatusProbe{}).Count(&probesBeforeDisabledRun).Error)
	disabledTask, err := model.CreateSystemTask(model.SystemTaskTypeGroupProbe, nil, nil)
	require.NoError(t, err)
	claimedDisabledTask, ok, err := model.ClaimSystemTask(disabledTask.ID, disabledTask.Type, "probe-runner", time.Now().Add(time.Minute).Unix())
	require.NoError(t, err)
	require.True(t, ok)
	groupProbeHandler{}.Run(context.Background(), claimedDisabledTask, "probe-runner")
	var logsAfterDisabledRun, probesAfterDisabledRun int64
	require.NoError(t, db.Model(&model.Log{}).Count(&logsAfterDisabledRun).Error)
	require.NoError(t, db.Model(&model.StatusProbe{}).Count(&probesAfterDisabledRun).Error)
	assert.Equal(t, logsBeforeDisabledRun, logsAfterDisabledRun)
	assert.Equal(t, probesBeforeDisabledRun, probesAfterDisabledRun)
	storedDisabledTask, err := model.GetLatestSystemTask(model.SystemTaskTypeGroupProbe)
	require.NoError(t, err)
	assert.Equal(t, model.SystemTaskStatusSucceeded, storedDisabledTask.Status)
	require.NoError(t, model.UpdateRequestPolicyOptions(map[string]string{"monitor_setting.auto_probe_enabled": "true"}))
	assert.True(t, groupProbeHandler{}.Enabled())
	var selected []string
	for range 4 {
		task, err := model.CreateSystemTask(model.SystemTaskTypeGroupProbe, nil, nil)
		require.NoError(t, err)
		claimed, ok, err := model.ClaimSystemTask(task.ID, task.Type, "probe-runner", time.Now().Add(time.Minute).Unix())
		require.NoError(t, err)
		require.True(t, ok)
		groupProbeHandler{}.Run(context.Background(), claimed, "probe-runner")
		stored, err := model.GetLatestSystemTask(task.Type)
		require.NoError(t, err)
		assert.Equal(t, model.SystemTaskStatusSucceeded, stored.Status)
		var state groupProbeState
		require.NoError(t, stored.DecodeState(&state))
		assert.Equal(t, 2, state.Succeeded)
		selected = append(selected, state.Rotations["vip"].LastModel)
	}
	assert.ElementsMatch(t, []string{"gpt-4o-mini", "gpt-4o", "vector-alias", "rank-alias"}, selected)
	assert.True(t, vectorTested.Load(), "embedding aliases must use the embeddings endpoint")
	assert.True(t, rerankTested.Load(), "rerank aliases must use the rerank endpoint")
	var customers int64
	require.NoError(t, db.Model(&model.PerfMetric{}).Count(&customers).Error)
	assert.Zero(t, customers, "synthetic checks must not enter customer metrics")
}

func TestGroupProbeFallsBackAcrossChannelsAndCountsGroupFailures(t *testing.T) {
	db := modelManagementDB(t, "sqlite", "")
	require.NoError(t, db.AutoMigrate(&model.StatusProbe{}, &model.Log{}, &model.SystemTask{}, &model.SystemTaskLock{}))
	withTieredBillingConfig(t,
		map[string]string{"gpt-4o-mini": "tiered_expr"},
		map[string]string{"gpt-4o-mini": `tier("base", p * 1 + c * 1)`},
	)

	oldLogConsume := common.LogConsumeEnabled
	common.LogConsumeEnabled = true
	oldRatios := ratio_setting.GroupRatio2JSONString()
	oldProbeEnabled := groupProbeHandler{}.Enabled()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))
	require.NoError(t, model.UpdateRequestPolicyOptions(map[string]string{"monitor_setting.auto_probe_enabled": "true"}))
	t.Cleanup(func() {
		common.LogConsumeEnabled = oldLogConsume
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(oldRatios))
		require.NoError(t, model.UpdateRequestPolicyOptions(map[string]string{
			"monitor_setting.auto_probe_enabled": fmt.Sprintf("%t", oldProbeEnabled),
		}))
		model.InvalidatePricingCache()
	})

	user := model.User{Username: "group-probe-root", Password: "unused", Group: "default", Role: common.RoleRootUser, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&user).Error)

	var firstRequests, secondRequests atomic.Int32
	var secondAvailable atomic.Bool
	secondAvailable.Store(true)
	firstUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		firstRequests.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"error":{"message":"first channel unavailable"}}`))
	}))
	secondUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		secondRequests.Add(1)
		if !secondAvailable.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":{"message":"second channel unavailable"}}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"probe","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`))
	}))
	t.Cleanup(firstUpstream.Close)
	t.Cleanup(secondUpstream.Close)

	modelName := "gpt-4o-mini"
	firstChannel := &model.Channel{
		Type:     constant.ChannelTypeOpenAI,
		Key:      "first-key",
		BaseURL:  common.GetPointer(firstUpstream.URL),
		Name:     "first-probe-channel",
		Models:   modelName,
		Group:    "default",
		Priority: common.GetPointer(int64(10)),
		Status:   common.ChannelStatusEnabled,
	}
	secondChannel := &model.Channel{
		Type:     constant.ChannelTypeOpenAI,
		Key:      "second-key",
		BaseURL:  common.GetPointer(secondUpstream.URL),
		Name:     "second-probe-channel",
		Models:   modelName,
		Group:    "default",
		Priority: common.GetPointer(int64(0)),
		Status:   common.ChannelStatusEnabled,
	}
	require.NoError(t, firstChannel.Insert())
	require.NoError(t, secondChannel.Insert())
	service.InitHttpClient()
	model.InvalidatePricingCache()

	runProbe := func() *model.SystemTask {
		task, err := model.CreateSystemTask(model.SystemTaskTypeGroupProbe, nil, nil)
		require.NoError(t, err)
		claimed, ok, err := model.ClaimSystemTask(task.ID, task.Type, "group-probe-runner", time.Now().Add(time.Minute).Unix())
		require.NoError(t, err)
		require.True(t, ok)
		groupProbeHandler{}.Run(context.Background(), claimed, "group-probe-runner")
		stored, err := model.GetSystemTaskByTaskID(task.TaskID)
		require.NoError(t, err)
		require.NotNil(t, stored)
		return stored
	}

	firstRun := runProbe()
	assert.Equal(t, model.SystemTaskStatusSucceeded, firstRun.Status)
	var firstState groupProbeState
	require.NoError(t, firstRun.DecodeState(&firstState))
	assert.Equal(t, 2, firstState.Tested)
	assert.Equal(t, 1, firstState.Succeeded)
	assert.Zero(t, firstState.Failed)
	assert.Equal(t, int32(1), firstRequests.Load())
	assert.Equal(t, int32(1), secondRequests.Load())

	var firstRunProbes []model.StatusProbe
	require.NoError(t, db.Order("id ASC").Find(&firstRunProbes).Error)
	require.Len(t, firstRunProbes, 2)
	assert.False(t, firstRunProbes[0].Success)
	assert.True(t, firstRunProbes[1].Success)

	var firstRunLogs []model.Log
	require.NoError(t, db.Order("id ASC").Find(&firstRunLogs).Error)
	require.Len(t, firstRunLogs, 2)
	assert.Equal(t, firstChannel.Id, firstRunLogs[0].ChannelId)
	assert.Zero(t, firstRunLogs[0].Quota)
	assert.Equal(t, secondChannel.Id, firstRunLogs[1].ChannelId)
	assert.Greater(t, firstRunLogs[1].Quota, 0)

	firstRequests.Store(0)
	secondRequests.Store(0)
	// Both channels fail on the next run; the group should contribute one
	// failure after both channel attempts are exhausted.
	secondAvailable.Store(false)
	secondRun := runProbe()
	assert.Equal(t, model.SystemTaskStatusFailed, secondRun.Status)
	var secondState groupProbeState
	require.NoError(t, secondRun.DecodeState(&secondState))
	assert.Equal(t, 2, secondState.Tested)
	assert.Zero(t, secondState.Succeeded)
	assert.Equal(t, 1, secondState.Failed)
}

func TestGroupStatusRestrictsVisitorsToPublicGroupsAndAppliesMemberRatios(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.PerfMetric{}, &model.StatusProbe{}))
	oldCache := common.MemoryCacheEnabled
	oldGroups := setting.UserUsableGroups2JSONString()
	oldRatios, oldMemberRatios := ratio_setting.GroupRatio2JSONString(), ratio_setting.GroupGroupRatio2JSONString()
	common.MemoryCacheEnabled = false
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Public"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"status-private":0.35}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{"status-private":{"default":0.6}}`))
	model.InvalidatePricingCache()
	t.Cleanup(func() {
		common.MemoryCacheEnabled = oldCache
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(oldGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(oldRatios))
		require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(oldMemberRatios))
		model.InvalidatePricingCache()
	})
	user := model.User{Username: "private-monitor", Password: "unused", Group: "status-private", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&user).Error)
	for _, group := range []string{"default", "status-private"} {
		require.NoError(t, model.RecordStatusProbe(&model.StatusProbe{GroupName: group, ModelName: "observed-model", Source: "manual_test", ObservedAt: time.Now().Unix(), Success: true}))
	}
	for _, tc := range []struct {
		name        string
		userID      int
		status      int
		groups      []string
		publicRatio float64
	}{
		{"visitor", 0, http.StatusOK, []string{"default"}, 1},
		{"member", user.Id, http.StatusOK, []string{"default", "status-private"}, 0.6},
		{"deleted member fails closed", 9999, http.StatusInternalServerError, nil, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodGet, "/api/status-monitor/groups", nil)
			c.Set("id", tc.userID)
			GetGroupStatus(c)
			require.Equal(t, tc.status, w.Code)
			var response struct {
				Success bool `json:"success"`
				Data    struct {
					Groups []struct {
						Group string  `json:"group"`
						Ratio float64 `json:"group_ratio"`
					} `json:"groups"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(w.Body.Bytes(), &response))
			assert.Equal(t, tc.status == http.StatusOK, response.Success)
			var names []string
			for _, group := range response.Data.Groups {
				names = append(names, group.Group)
				if group.Group == "default" {
					assert.Equal(t, tc.publicRatio, group.Ratio)
				}
			}
			assert.Equal(t, tc.groups, names)
		})
	}
}

func TestGetChannelDefaultBaseURLsUsesBuiltInDefaults(t *testing.T) {
	originalBaseURLs := constant.ChannelBaseURLs
	constant.ChannelBaseURLs = append([]string(nil), originalBaseURLs...)
	constant.ChannelBaseURLs[constant.ChannelTypeDeepSeek] = "https://deepseek.server.example"
	t.Cleanup(func() {
		constant.ChannelBaseURLs = originalBaseURLs
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/channel/default_base_urls", nil)
	GetChannelDefaultBaseURLs(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool           `json:"success"`
		Data    map[int]string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, "https://deepseek.server.example", response.Data[constant.ChannelTypeDeepSeek])
	assert.Equal(t, "https://api.openai.com", response.Data[constant.ChannelTypeOpenAI])
	assert.NotContains(t, response.Data, constant.ChannelTypeAzure)
	assert.NotContains(t, response.Data, constant.ChannelTypeNewAPI)
	assert.NotContains(t, response.Data, constant.ChannelTypeTaskPlugin)
}

func TestValidateChannelProxy(t *testing.T) {
	tests := []struct {
		name    string
		proxy   string
		wantErr bool
	}{
		{name: "empty"},
		{name: "http", proxy: "http://proxy.example:8080"},
		{name: "https", proxy: "https://proxy.example:8443"},
		{name: "socks5", proxy: "socks5://proxy.example"},
		{name: "socks5h", proxy: "socks5h://proxy.example:1080/"},
		{name: "unsupported", proxy: "ftp://proxy.example", wantErr: true},
		{name: "path", proxy: "socks5://proxy.example:1080/path", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setting, err := common.Marshal(dto.ChannelSettings{Proxy: test.proxy})
			require.NoError(t, err)
			channel := &model.Channel{
				Type:    constant.ChannelTypeOpenAI,
				Setting: common.GetPointer(string(setting)),
			}

			err = validateChannel(channel, false)

			if test.wantErr {
				require.ErrorContains(t, err, "invalid channel proxy")
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestValidateChannelRequiresNewAPIBaseURL(t *testing.T) {
	tests := []struct {
		name    string
		baseURL *string
		wantErr bool
	}{
		{name: "missing", wantErr: true},
		{name: "blank", baseURL: common.GetPointer("  "), wantErr: true},
		{name: "configured", baseURL: common.GetPointer("https://new-api.example")},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			channel := &model.Channel{
				Type:    constant.ChannelTypeNewAPI,
				BaseURL: test.baseURL,
			}

			err := validateChannel(channel, false)

			if test.wantErr {
				require.ErrorContains(t, err, "New API channel base URL cannot be empty")
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestNewAPIChannelRegistration(t *testing.T) {
	apiType, ok := common.ChannelType2APIType(constant.ChannelTypeNewAPI)

	require.True(t, ok)
	assert.Equal(t, constant.APITypeNewAPI, apiType)
	assert.Equal(t, "New API", constant.GetChannelTypeName(constant.ChannelTypeNewAPI))
	require.Greater(t, len(constant.ChannelBaseURLs), constant.ChannelTypeNewAPI)
	assert.Empty(t, constant.ChannelBaseURLs[constant.ChannelTypeNewAPI])
}

func TestResponsesCompactChannelSupport(t *testing.T) {
	tests := []struct {
		name        string
		channelType int
		apiType     int
		want        bool
	}{
		{name: "OpenAI", channelType: constant.ChannelTypeOpenAI, apiType: constant.APITypeOpenAI, want: true},
		{name: "Azure", channelType: constant.ChannelTypeAzure, apiType: constant.APITypeOpenAI, want: true},
		{name: "Codex", channelType: constant.ChannelTypeCodex, apiType: constant.APITypeCodex, want: true},
		{name: "Advanced Custom", channelType: constant.ChannelTypeAdvancedCustom, apiType: constant.APITypeAdvancedCustom, want: true},
		{name: "Sub2API", channelType: constant.ChannelTypeSub2API, apiType: constant.APITypeSub2API, want: true},
		{name: "New API", channelType: constant.ChannelTypeNewAPI, apiType: constant.APITypeNewAPI, want: true},
		{name: "Anthropic", channelType: constant.ChannelTypeAnthropic, apiType: constant.APITypeAnthropic, want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, common.SupportsResponsesCompact(test.channelType, test.apiType))
		})
	}
}

func TestMultiprotocolGatewayEndpointTypes(t *testing.T) {
	want := []constant.EndpointType{
		constant.EndpointTypeOpenAI,
		constant.EndpointTypeOpenAIResponse,
		constant.EndpointTypeOpenAIResponseCompact,
		constant.EndpointTypeAnthropic,
		constant.EndpointTypeGemini,
		constant.EndpointTypeOpenAIAlphaSearch,
	}

	assert.Equal(t, want, common.GetEndpointTypesByChannelType(constant.ChannelTypeNewAPI, "gpt-5"))
	assert.Equal(t, want, common.GetEndpointTypesByChannelType(constant.ChannelTypeSub2API, "gpt-5"))
}

func TestCopyChannelRejectsInvalidLegacyProxySettings(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	settingBytes, err := common.Marshal(dto.ChannelSettings{
		Proxy: "socks5://proxy.example/legacy-path",
	})
	require.NoError(t, err)
	setting := string(settingBytes)
	origin := &model.Channel{
		Type:    constant.ChannelTypeOpenAI,
		Name:    "legacy proxy channel",
		Key:     "test-key",
		Models:  "gpt-test",
		Group:   "default",
		Setting: &setting,
	}
	require.NoError(t, db.Create(origin).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", origin.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/copy", nil)

	CopyChannel(ctx)

	assert.Contains(t, recorder.Body.String(), "invalid channel settings")
	var channelCount int64
	require.NoError(t, db.Model(&model.Channel{}).Count(&channelCount).Error)
	assert.Equal(t, int64(1), channelCount)
}

func TestDeleteChannelResetsProxyCacheWhenPreReadFails(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}, &model.AuditLog{}))
	service.ResetProxyClientCache()
	t.Cleanup(service.ResetProxyClientCache)

	proxyURL := "http://proxy.example:8080"
	beforeDelete, err := service.GetHttpClientWithProxy(proxyURL)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: "999999"}}
	ctx.Request = httptest.NewRequest(http.MethodDelete, "/api/channel/999999", nil)

	DeleteChannel(ctx)

	assert.Contains(t, recorder.Body.String(), `"success":true`)
	afterDelete, err := service.GetHttpClientWithProxy(proxyURL)
	require.NoError(t, err)
	assert.NotSame(t, beforeDelete, afterDelete)
}

func TestDeleteChannelBatchReportsAndAuditsActualDeletedCount(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}, &model.AuditLog{}))
	channel := &model.Channel{Name: "existing", Key: "test-key"}
	require.NoError(t, db.Create(channel).Error)

	requestBody, err := common.Marshal(ChannelBatch{Ids: []int{channel.Id, 999999}})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodDelete, "/api/channel/batch", bytes.NewReader(requestBody))
	ctx.Request.Header.Set("Content-Type", "application/json")

	DeleteChannelBatch(ctx)

	var response struct {
		Success bool  `json:"success"`
		Data    int64 `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, int64(1), response.Data)

	var auditLog model.AuditLog
	require.NoError(t, db.Order("id desc").First(&auditLog).Error)
	var auditData struct {
		Operation struct {
			Params map[string]any `json:"params"`
		} `json:"op"`
	}
	encodedAudit, err := common.Marshal(auditLog.Other)
	require.NoError(t, err)
	require.NoError(t, common.Unmarshal(encodedAudit, &auditData))
	assert.Equal(t, float64(1), auditData.Operation.Params["count"])
}

func TestSettleTestQuotaUsesTieredBilling(t *testing.T) {
	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:   "tiered_expr",
			ExprString:    `param("stream") == true ? tier("stream", p * 3) : tier("base", p * 2)`,
			ExprHash:      billingexpr.ExprHashString(`param("stream") == true ? tier("stream", p * 3) : tier("base", p * 2)`),
			GroupRatio:    1,
			EstimatedTier: "stream",
			QuotaPerUnit:  common.QuotaPerUnit,
			ExprVersion:   1,
		},
		BillingRequestInput: &billingexpr.RequestInput{
			Body: []byte(`{"stream":true}`),
		},
	}

	quota, result := settleTestQuota(info, types.PriceData{
		ModelRatio:      1,
		CompletionRatio: 2,
	}, &dto.Usage{
		PromptTokens: 1000,
	})

	require.Equal(t, 1500, quota)
	require.NotNil(t, result)
	require.Equal(t, "stream", result.MatchedTier)
}

func TestBuildTestLogOtherInjectsTieredInfo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode: "tiered_expr",
			ExprString:  `tier("base", p * 2)`,
		},
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
	priceData := types.PriceData{
		GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1},
	}
	usage := &dto.Usage{
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 12,
		},
	}

	requestRules := []billingexpr.RequestRuleTrace{{
		Cond:       `param("service_tier") == "fast"`,
		Multiplier: 2,
		Matched:    true,
	}}
	other := buildTestLogOther(ctx, info, priceData, usage, &billingexpr.TieredResult{
		MatchedTier:  "base",
		RequestRules: requestRules,
	})

	fields := other.Snapshot()
	require.Equal(t, "tiered_expr", fields["billing_mode"])
	require.Equal(t, "base", fields["matched_tier"])
	require.Equal(t, requestRules, fields["request_rules"])
	require.NotEmpty(t, fields["expr_b64"])
}

func TestResolveChannelTestUserIDUsesRequestUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("id", 2)

	userID, err := resolveChannelTestUserID(ctx)

	require.NoError(t, err)
	require.Equal(t, 2, userID)
}

func TestSelectChannelsForAutomaticTestPassiveRecoveryOnlyUsesAutoDisabled(t *testing.T) {
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusAutoDisabled},
		{Id: 3, Status: common.ChannelStatusManuallyDisabled},
	}

	selected := selectChannelsForAutomaticTest(channels, operation_setting.ChannelTestModePassiveRecovery)

	require.Len(t, selected, 1)
	require.Equal(t, 2, selected[0].Id)
}

func TestSelectChannelsForAutomaticTestScheduledSkipsManualDisabled(t *testing.T) {
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusAutoDisabled},
		{Id: 3, Status: common.ChannelStatusManuallyDisabled},
	}

	selected := selectChannelsForAutomaticTest(channels, operation_setting.ChannelTestModeScheduledAll)

	require.Len(t, selected, 2)
	require.Equal(t, 1, selected[0].Id)
	require.Equal(t, 2, selected[1].Id)
}

func TestSelectChannelsForAutomaticTestAutoBanOnlyUsesEligibleChannels(t *testing.T) {
	autoBanEnabled := 1
	autoBanDisabled := 0
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled, AutoBan: &autoBanEnabled},
		{Id: 2, Status: common.ChannelStatusEnabled, AutoBan: &autoBanDisabled},
		{Id: 3, Status: common.ChannelStatusAutoDisabled, AutoBan: &autoBanEnabled},
		{Id: 4, Status: common.ChannelStatusManuallyDisabled, AutoBan: &autoBanEnabled},
		{Id: 5, Status: common.ChannelStatusEnabled},
	}

	selected := selectChannelsForAutomaticTest(channels, operation_setting.ChannelTestModeAutoBanOnly)

	require.Len(t, selected, 2)
	require.Equal(t, 1, selected[0].Id)
	require.Equal(t, 3, selected[1].Id)
}

func TestRunChannelTestWorkersHonorsConfiguredConcurrency(t *testing.T) {
	originalInterval := common.RequestInterval
	common.RequestInterval = 0
	t.Cleanup(func() { common.RequestInterval = originalInterval })

	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusEnabled},
		{Id: 3, Status: common.ChannelStatusEnabled},
		{Id: 4, Status: common.ChannelStatusEnabled},
	}
	started := make(chan struct{}, len(channels))
	release := make(chan struct{})
	var active atomic.Int32
	var maxActive atomic.Int32
	progress := make([]int, 0, len(channels)+1)
	summaryResult := make(chan channelTestSummary, 1)

	go func() {
		summaryResult <- runChannelTestWorkers(
			context.Background(),
			channels,
			2,
			func(_ context.Context, _ *model.Channel) channelTestSummary {
				current := active.Add(1)
				defer active.Add(-1)
				for {
					observed := maxActive.Load()
					if current <= observed || maxActive.CompareAndSwap(observed, current) {
						break
					}
				}
				started <- struct{}{}
				<-release
				return channelTestSummary{Tested: 1, Succeeded: 1}
			},
			func(processed, _ int) {
				progress = append(progress, processed)
			},
		)
	}()

	<-started
	<-started
	select {
	case <-started:
		t.Fatal("started more channel tests than the configured concurrency")
	default:
	}
	close(release)

	summary := <-summaryResult

	assert.Equal(t, int32(2), maxActive.Load())
	assert.Equal(t, channelTestSummary{Tested: 4, Succeeded: 4}, summary)
	assert.Equal(t, []int{0, 1, 2, 3, 4}, progress)
}

func TestRunChannelTestWorkersStopsAfterCancellation(t *testing.T) {
	originalInterval := common.RequestInterval
	common.RequestInterval = 0
	t.Cleanup(func() { common.RequestInterval = originalInterval })

	ctx, cancel := context.WithCancel(context.Background())
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusEnabled},
		{Id: 3, Status: common.ChannelStatusEnabled},
		{Id: 4, Status: common.ChannelStatusEnabled},
	}
	started := make(chan struct{}, len(channels))
	progress := make([]int, 0, 1)
	summaryResult := make(chan channelTestSummary, 1)

	go func() {
		summaryResult <- runChannelTestWorkers(
			ctx,
			channels,
			2,
			func(ctx context.Context, _ *model.Channel) channelTestSummary {
				started <- struct{}{}
				<-ctx.Done()
				return channelTestSummary{Tested: 1, Succeeded: 1}
			},
			func(processed, _ int) {
				progress = append(progress, processed)
			},
		)
	}()

	<-started
	<-started
	cancel()

	summary := <-summaryResult

	select {
	case <-started:
		t.Fatal("started another channel test after cancellation")
	default:
	}
	assert.Equal(t, channelTestSummary{Tested: 2, Succeeded: 2}, summary)
	assert.Equal(t, []int{0}, progress)
}

func TestTestAllChannelsRejectsExistingActiveTask(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.SystemTask{}, &model.SystemTaskLock{}))

	existing, err := model.CreateSystemTask(model.SystemTaskTypeChannelTest, nil, nil)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/test", nil)

	TestAllChannels(ctx)

	require.Equal(t, http.StatusConflict, recorder.Code)
	require.Contains(t, recorder.Body.String(), existing.TaskID)
	require.Contains(t, recorder.Body.String(), "A channel test task is already running or queued")
}
