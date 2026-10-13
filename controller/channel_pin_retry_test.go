package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLogChannelSwitchRoutingDatabaseMatrix(t *testing.T) {
	require.NoError(t, i18n.Init())
	for _, dialect := range []struct{ kind, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.kind, func(t *testing.T) {
			dsn := os.Getenv(dialect.env)
			if dialect.env != "" && dsn == "" {
				t.Skipf("%s not configured", dialect.env)
			}
			db := modelManagementDB(t, dialect.kind, dsn)
			channels := []model.Channel{
				{Id: 1, Name: "stalled", Type: 1, Key: "test-only", Status: common.ChannelStatusEnabled, Models: "switch-test,lonely-test", Group: "default", Priority: common.GetPointer(int64(10))},
				{Id: 2, Name: "alternative", Type: 1, Key: "test-only", Status: common.ChannelStatusEnabled, Models: "switch-test", Group: "default", Priority: common.GetPointer(int64(5))},
			}
			for i := range channels {
				require.NoError(t, db.Create(&channels[i]).Error)
				require.NoError(t, channels[i].AddAbilities(db))
			}
			affinity := operation_setting.GetChannelAffinitySetting()
			previous := *affinity
			t.Cleanup(func() { *affinity = previous })
			affinity.Enabled = true
			affinity.Rules = []operation_setting.ChannelAffinityRule{{Name: "switch-test", ModelRegex: []string{".*"}, KeySources: []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Session"}}, IncludeRuleName: true, IncludeModelName: true, IncludeUsingGroup: true, TTLSeconds: 60}}
			for _, cached := range []bool{false, true} {
				common.MemoryCacheEnabled = cached
				model.InitChannelCache()
				for _, mode := range []string{"prefer", "strict"} {
					for _, scenario := range []string{"automatic", "manual", "legacy log", "with output", "no alternative", "timeout without alternative", "manual without alternative", "filtered alternative", "excluded original", "repeated disconnect without alternative", "auto without alternative"} {
						t.Run(fmt.Sprintf("cache=%t/%s/%s", cached, mode, scenario), func(t *testing.T) {
							affinity.Rules[0].SessionMode = mode
							modelName := "switch-test"
							if scenario == "no alternative" || strings.Contains(scenario, "without alternative") || scenario == "excluded original" {
								modelName = "lonely-test"
							}
							group := "default"
							if scenario == "auto without alternative" {
								group = "auto"
							}
							seed := newPinRetryContext()
							seed.Request.Header.Set("X-Session", t.Name())
							seed.Set("channel_id", 1)
							_, _ = service.GetPreferredChannelByAffinity(seed, modelName, group)
							service.RecordChannelAffinity(seed, 1)
							t.Cleanup(func() { service.ClearCurrentChannelAffinityCache(seed) })
							other := model.NewLogOther()
							service.AppendChannelAffinityAdminInfo(seed, other)
							encoded, err := common.Marshal(other.Snapshot()["admin_info"].(map[string]any)["channel_affinity"])
							require.NoError(t, err)
							var target service.ChannelAffinitySwitch
							require.NoError(t, common.Unmarshal(encoded, &target))
							target.ChannelID = 1
							if scenario == "manual" || scenario == "legacy log" || scenario == "manual without alternative" {
								if scenario == "legacy log" {
									target.CacheKeyHash = ""
								}
								recorder := modelManagementRequest(t, SwitchLogChannelAffinity, http.MethodPost, "/api/log/channel_affinity/switch", target, nil)
								require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
							} else {
								status := relaycommon.NewStreamStatus()
								status.SetEndReason(relaycommon.StreamEndReasonClientGone, context.Canceled)
								if scenario == "timeout without alternative" {
									status = relaycommon.NewStreamStatus()
									status.SetEndReason(relaycommon.StreamEndReasonTimeout, context.DeadlineExceeded)
								}
								output := int64(0)
								if scenario == "with output" {
									output = 40
								}
								service.HandleRelayAffinityFailure(seed, &relaycommon.RelayInfo{StreamStatus: status, PerformanceOutputTokens: output}, nil)
							}
							service.RecordChannelAffinity(seed, 1)
							if scenario == "repeated disconnect without alternative" {
								repeated := newPinRetryContext()
								repeated.Request.Header.Set("X-Session", t.Name())
								selected, _, selectErr := service.SelectChannelForRequest(repeated, modelName, &service.RetryParam{Ctx: repeated, TokenGroup: group, ModelName: modelName})
								require.Nil(t, selectErr)
								require.Equal(t, 1, selected.Id)
								repeated.Set("channel_id", selected.Id)
								status := relaycommon.NewStreamStatus()
								status.SetEndReason(relaycommon.StreamEndReasonClientGone, context.Canceled)
								service.HandleRelayAffinityFailure(repeated, &relaycommon.RelayInfo{StreamStatus: status}, nil)
								service.RecordChannelAffinity(repeated, 1)
								_, found := service.GetPreferredChannelByAffinity(seed, modelName, group)
								assert.False(t, found, "another canceled fallback must not restore the binding")
							}
							request := newPinRetryContext()
							request.Request.Body = io.NopCloser(strings.NewReader(fmt.Sprintf(`{"model":%q}`, modelName)))
							request.Request.Header.Set("Content-Type", "application/json")
							request.Request.Header.Set("X-Session", t.Name())
							common.SetContextKey(request, constant.ContextKeyUsingGroup, group)
							if group == "auto" {
								common.SetContextKey(request, constant.ContextKeyUserGroup, "default")
								common.SetContextKey(request, constant.ContextKeyTokenAutoGroups, []string{"default"})
							}
							if scenario == "filtered alternative" {
								service.GetChannelConstraints(request).AddFilter(dto.ChannelFilter{Kind: dto.FilterExcludeChannels, ExcludeChannelIds: []int{2}})
							}
							if scenario == "excluded original" {
								service.GetChannelConstraints(request).AddFilter(dto.ChannelFilter{Kind: dto.FilterExcludeChannels, ExcludeChannelIds: []int{1}})
							}
							middleware.Distribute()(request)
							if scenario == "excluded original" {
								assert.Equal(t, http.StatusServiceUnavailable, request.Writer.Status())
								assert.True(t, request.IsAborted(), "fallback must retain explicit request exclusions")
								return
							}
							assert.False(t, request.IsAborted())
							want := 2
							if scenario == "with output" || modelName == "lonely-test" || scenario == "filtered alternative" {
								want = 1
							}
							assert.Equal(t, want, request.GetInt("channel_id"))
							bound, found := service.GetPreferredChannelByAffinity(request, modelName, group)
							assert.True(t, found)
							assert.Equal(t, want, bound)
							if scenario == "manual" {
								recorder := modelManagementRequest(t, SwitchLogChannelAffinity, http.MethodPost, "/api/log/channel_affinity/switch", target, nil)
								assert.Equal(t, http.StatusConflict, recorder.Code, "an old log cannot replace a newer binding")
							}
						})
					}
				}
			}
		})
	}
}

func TestLogChannelSwitchRequiresAdministratorPermission(t *testing.T) {
	user, token := setupAccessTokenAudit(t)
	router := gin.New()
	router.POST("/api/log/channel_affinity/switch", middleware.AdminAuth(), middleware.RequirePermission(authz.ChannelOperate), SwitchLogChannelAffinity)
	assert.Equal(t, http.StatusUnauthorized, auditRequest(router, http.MethodPost, "/api/log/channel_affinity/switch", "").Code)
	require.NoError(t, model.DB.Model(user).Update("role", common.RoleCommonUser).Error)
	assert.Equal(t, http.StatusForbidden, auditRequest(router, http.MethodPost, "/api/log/channel_affinity/switch", token).Code)
	require.NoError(t, model.DB.Model(user).Update("role", common.RoleAdminUser).Error)
	assert.Equal(t, http.StatusConflict, auditRequest(router, http.MethodPost, "/api/log/channel_affinity/switch", token).Code, "authorized invalid payload must reach validation")
	require.NoError(t, authz.SetUserPermissions(user.Id, authz.PermissionsMap{"channel": {"operate": false}}))
	assert.Equal(t, http.StatusForbidden, auditRequest(router, http.MethodPost, "/api/log/channel_affinity/switch", token).Code, "administrators without channel operation permission cannot switch sessions")
}

func TestShouldRetryHonorsPinRetryMode(t *testing.T) {
	openaiErr := types.NewOpenAIError(errors.New("upstream"), types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError)

	c := newPinRetryContext()
	assert.True(t, service.ShouldRetryRelayError(c, openaiErr, 1))

	origin := newPinRetryContext()
	service.GetChannelConstraints(origin).AddPin(dto.ChannelPin{
		ChannelId: 2,
		Source:    dto.PinSourceOriginTask,
		Rank:      dto.PinRankOriginTask,
		RetryMode: dto.PinRetrySameChannel,
	})
	assert.True(t, service.ShouldRetryRelayError(origin, openaiErr, 1), "origin pin retries on the same channel")

	token := newPinRetryContext()
	service.GetChannelConstraints(token).AddPin(dto.ChannelPin{
		ChannelId: 1,
		Source:    dto.PinSourceToken,
		Rank:      dto.PinRankToken,
		RetryMode: dto.PinRetrySingleAttempt,
	})
	assert.Equal(t, service.PolicyDecision{Action: "stop", Reason: "pinned_channel", Source: "channel_constraint"}, service.DecideRelayRetry(token, openaiErr, 1), "token pin suppresses retry")
}

func TestShouldRetryTaskRelayHonorsPinRetryMode(t *testing.T) {
	taskErr := &dto.TaskError{StatusCode: http.StatusInternalServerError}

	c := newPinRetryContext()
	assert.Equal(t, "retry", decideTaskRetry(c, taskErr, 1).Action)

	origin := newPinRetryContext()
	service.GetChannelConstraints(origin).AddPin(dto.ChannelPin{
		ChannelId: 2,
		Source:    dto.PinSourceOriginTask,
		Rank:      dto.PinRankOriginTask,
		RetryMode: dto.PinRetrySameChannel,
	})
	assert.Equal(t, "retry", decideTaskRetry(origin, taskErr, 1).Action)

	token := newPinRetryContext()
	service.GetChannelConstraints(token).AddPin(dto.ChannelPin{
		ChannelId: 1,
		Source:    dto.PinSourceToken,
		Rank:      dto.PinRankToken,
		RetryMode: dto.PinRetrySingleAttempt,
	})
	assert.Equal(t, service.PolicyDecision{Action: "stop", Reason: "pinned_channel", Source: "channel_constraint"}, decideTaskRetry(token, taskErr, 1))
}

func TestSameChannelPinsMergeToStricterRetryMode(t *testing.T) {
	c := newPinRetryContext()
	constraints := service.GetChannelConstraints(c)
	constraints.AddPin(dto.ChannelPin{
		ChannelId: 7,
		Source:    dto.PinSourceOriginTask,
		Rank:      dto.PinRankOriginTask,
		RetryMode: dto.PinRetrySameChannel,
	})
	constraints.AddPin(dto.ChannelPin{
		ChannelId: 7,
		Source:    dto.PinSourceToken,
		Rank:      dto.PinRankToken,
		RetryMode: dto.PinRetrySingleAttempt,
	})
	pin, found, overridden := constraints.ResolvedPin()
	require.True(t, found)
	assert.Equal(t, 7, pin.ChannelId)
	assert.Equal(t, dto.PinRetrySingleAttempt, pin.RetryMode)
	assert.Empty(t, overridden)
	assert.False(t, service.ShouldRetryRelayError(c, types.NewOpenAIError(errors.New("upstream"), types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError), 1))
}

func newPinRetryContext() *gin.Context {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

func TestRequestPolicyConfigReturnsSettingsWithoutMigration(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	GetRequestPolicy(ctx)
	assert.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool           `json:"success"`
		Data    map[string]any `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Contains(t, response.Data, "options")
	assert.NotContains(t, response.Data, "migration")
	assert.NotContains(t, response.Data, "differences")
}

func TestRequestPolicyRoutingDatabaseMatrix(t *testing.T) {
	require.NoError(t, i18n.Init())
	for _, dialect := range []struct{ kind, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.kind, func(t *testing.T) {
			dsn := ""
			if dialect.env != "" {
				dsn = os.Getenv(dialect.env)
				if dsn == "" {
					t.Skipf("%s not configured", dialect.env)
				}
			}
			db := modelManagementDB(t, dialect.kind, dsn)
			previousGroups := setting.UserUsableGroups2JSONString()
			previousRatios, err := common.Marshal(ratio_setting.GetGroupRatioCopy())
			require.NoError(t, err)
			require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default"}`))
			require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))
			t.Cleanup(func() {
				require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousGroups))
				require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(string(previousRatios)))
			})
			// Channel 1 holds the session binding but is no longer usable.
			channels := []model.Channel{
				{Id: 1, Name: "A", Type: 1, Key: "test-only", Status: common.ChannelStatusAutoDisabled, Models: "policy-test", Group: "default", Priority: common.GetPointer(int64(10))},
				{Id: 2, Name: "B", Type: 1, Key: "test-only", Status: common.ChannelStatusEnabled, Models: "policy-test", Group: "default", Priority: common.GetPointer(int64(5))},
			}
			for i := range channels {
				require.NoError(t, db.Create(&channels[i]).Error)
				require.NoError(t, channels[i].AddAbilities(db))
			}
			affinity := operation_setting.GetChannelAffinitySetting()
			previousAffinity := *affinity
			t.Cleanup(func() { *affinity = previousAffinity })
			for _, cached := range []bool{false, true} {
				for _, keep := range []bool{false, true} {
					for _, tc := range []struct {
						globalMode, ruleMode string
						blocked              bool
					}{
						{"strict", "inherit", true},
						{"prefer", "strict", true},
						{"prefer", "inherit", false},
						{"strict", "prefer", false},
					} {
						t.Run(fmt.Sprintf("cache=%t/keep=%t/global=%s/rule=%s", cached, keep, tc.globalMode, tc.ruleMode), func(t *testing.T) {
							common.MemoryCacheEnabled = cached
							model.InitChannelCache()
							snapshot, err := model.BuildRequestPolicy(map[string]string{
								"channel_affinity_setting.enabled":                  "true",
								"channel_affinity_setting.session_mode":             tc.globalMode,
								"channel_affinity_setting.keep_on_channel_disabled": fmt.Sprint(keep),
								"channel_affinity_setting.rules":                    fmt.Sprintf(`[{"name":"session","model_regex":[".*"],"key_sources":[{"type":"request_header","key":"X-Session"}],"session_mode":%q}]`, tc.ruleMode),
							})
							require.NoError(t, err)
							*affinity = snapshot.Affinity
							seed := newPinRetryContext()
							seed.Request.Header.Set("X-Session", t.Name())
							_, found := service.GetPreferredChannelByAffinity(seed, "policy-test", "default")
							require.False(t, found)
							seed.Set("channel_id", 1)
							service.RecordChannelAffinity(seed, 1)
							t.Cleanup(func() { service.ClearCurrentChannelAffinityCache(seed) })
							bound, found := service.GetPreferredChannelByAffinity(seed, "policy-test", "default")
							require.True(t, found)
							require.Equal(t, 1, bound)

							request := newPinRetryContext()
							request.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"policy-test"}`))
							request.Request.Header.Set("Content-Type", "application/json")
							request.Request.Header.Set("X-Session", t.Name())
							common.SetContextKey(request, constant.ContextKeyUsingGroup, "default")
							middleware.Distribute()(request)
							events := service.RequestPolicy(request).Events()
							assert.True(t, slices.ContainsFunc(events, func(event service.PolicyEvent) bool { return event.Decision.Reason == "session_rule_matched" }), "decision events are recorded for every request")
							bound, found = service.GetPreferredChannelByAffinity(seed, "policy-test", "default")
							if tc.blocked {
								assert.Equal(t, http.StatusServiceUnavailable, request.Writer.Status())
								assert.True(t, request.IsAborted())
								assert.Equal(t, keep, found, "binding retention is independent of strict request handling")
								if found {
									assert.Equal(t, 1, bound)
								}
								return
							}
							assert.False(t, request.IsAborted())
							assert.Equal(t, 2, common.GetContextKeyInt(request, constant.ContextKeyChannelId), "prefer falls back to the next eligible channel")
							require.True(t, found)
							assert.Equal(t, 2, bound, "a successful fallback rebinds the session")
						})
					}
				}
			}
		})
	}
}
