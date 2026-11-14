package service

import (
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelSelectAutoGroupsTest(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := model.DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalRetryTimes := common.RetryTimes
	originalAutoGroups := setting.AutoGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	originalMaxTokenAutoGroups := setting.GetMaxTokenAutoGroups()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	common.RetryTimes = 0

	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`[]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":2}`))
	require.NoError(t, setting.UpdateMaxTokenAutoGroups("2"))

	t.Cleanup(func() {
		model.DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.RetryTimes = originalRetryTimes
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
		require.NoError(t, setting.UpdateMaxTokenAutoGroups(fmt.Sprintf("%d", originalMaxTokenAutoGroups)))

		if originalMemoryCacheEnabled && originalDB != nil &&
			originalDB.Migrator().HasTable(&model.Channel{}) && originalDB.Migrator().HasTable(&model.Ability{}) {
			model.InitChannelCache()
		}
		sqlDB, err := db.DB()
		if err == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	return db
}

func createChannelSelectAutoGroupsChannel(t *testing.T, db *gorm.DB, id int, group, modelName string) {
	t.Helper()
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id:       id,
		Type:     constant.ChannelTypeOpenAI,
		Key:      fmt.Sprintf("key-%d", id),
		Status:   common.ChannelStatusEnabled,
		Name:     fmt.Sprintf("channel-%d", id),
		Weight:   &weight,
		Models:   modelName,
		Group:    group,
		Priority: &priority,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     group,
		Model:     modelName,
		ChannelId: id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}

func TestCacheGetRandomSatisfiedChannelRetrySkipsTriedChannel(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "retry-untried-model"
	createChannelSelectAutoGroupsChannel(t, db, 2201, "default", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2202, "default", modelName)
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	for _, failed := range []int{2201, 2202} {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		AppendUsedChannel(ctx, failed)
		param := &RetryParam{Ctx: ctx, TokenGroup: "default", ModelName: modelName, Retry: common.GetPointer(1)}

		// Same-priority channels: the retry must not pick the failed one again.
		for range 20 {
			channel, _, err := CacheGetRandomSatisfiedChannel(param)
			require.NoError(t, err)
			require.NotNil(t, channel)
			assert.NotEqual(t, failed, channel.Id)
		}
	}

	// Once every channel has been tried, selection falls back instead of failing.
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	AppendUsedChannel(ctx, 2201)
	AppendUsedChannel(ctx, 2202)
	channel, _, err := CacheGetRandomSatisfiedChannel(&RetryParam{Ctx: ctx, TokenGroup: "default", ModelName: modelName, Retry: common.GetPointer(2)})
	require.NoError(t, err)
	require.NotNil(t, channel)
}

func TestCacheGetRandomSatisfiedChannelUsesTokenAutoGroupsWhenGlobalAutoIsEmpty(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "auto-groups-runtime-model"
	createChannelSelectAutoGroupsChannel(t, db, 2101, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2102, "default", modelName)
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)

	retry := 0
	param := &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "auto",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	}

	first, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, 2101, first.Id)
	assert.Equal(t, "vip", selectedGroup)
	assert.Equal(t, "vip", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
	assert.Empty(t, setting.GetAutoGroups(), "the selection must not depend on the global Auto list")

	param.IncreaseRetry()
	second, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, 2102, second.Id)
	assert.Equal(t, "default", selectedGroup)
	assert.Equal(t, "default", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
}

// A channel restricted to Claude Code clients is skipped for every other
// request, which is served by the remaining channels of the group or refused
// when the restricted channel is the only one serving the model.
func TestClaudeCodeOnlyChannelServesOnlyClaudeCodeClients(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const sharedModel, exclusiveModel = "claude-shared", "claude-exclusive"
	createChannelSelectAutoGroupsChannel(t, db, 2301, "default", sharedModel)
	createChannelSelectAutoGroupsChannel(t, db, 2302, "default", sharedModel)
	createChannelSelectAutoGroupsChannel(t, db, 2303, "default", exclusiveModel)
	require.NoError(t, db.Model(&model.Channel{}).Where("id IN ?", []int{2301, 2303}).
		Update("settings", `{"claude_code_only":true}`).Error)
	model.InitChannelCache()
	gin.SetMode(gin.TestMode)

	const systemPrompt = `[{"type":"text","text":"You are Claude Code, Anthropic's official CLI for Claude."}]`
	const userID = `"{\"device_id\":\"d1\",\"account_uuid\":\"\",\"session_id\":\"s1\"}"`
	messagesBody := func(system, userID string) string {
		return fmt.Sprintf(`{"model":"m","max_tokens":64,"system":%s,"metadata":{"user_id":%s},"messages":[{"role":"user","content":"hi"}]}`, system, userID)
	}
	clientHeaders := map[string]string{
		"User-Agent": "claude-cli/2.1.100 (external, cli)", "X-App": "cli",
		"anthropic-beta": "claude-code-20250219", "anthropic-version": "2023-06-01",
	}
	without := func(name string) map[string]string {
		headers := map[string]string{}
		for key, value := range clientHeaders {
			if key != name {
				headers[key] = value
			}
		}
		return headers
	}
	simulated, err := NewClaudeCodeTestRequest("m")
	require.NoError(t, err)
	simulatedBody, err := common.Marshal(simulated)
	require.NoError(t, err)
	simulatedHeaders := ClaudeCodeClientHeaders()
	simulatedHeaders["anthropic-beta"], simulatedHeaders["anthropic-version"] = ClaudeCodeBetaHeader, "2023-06-01"

	selectChannel := func(modelName, path, body string, headers map[string]string) (*model.Channel, *ChannelSelectError) {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest("POST", path, strings.NewReader(body))
		ctx.Request.Header.Set("Content-Type", "application/json")
		for key, value := range headers {
			ctx.Request.Header.Set(key, value)
		}
		common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")
		channel, _, selectErr := SelectChannelForRequest(ctx, modelName, &RetryParam{
			Ctx: ctx, TokenGroup: "default", ModelName: modelName, RequestPath: path, Retry: common.GetPointer(0),
		})
		return channel, selectErr
	}

	for _, tc := range []struct {
		name       string
		path, body string
		headers    map[string]string
		claudeCode bool
	}{
		{"client request", "/v1/messages", messagesBody(systemPrompt, userID), clientHeaders, true},
		{"user id of older clients", "/v1/messages", messagesBody(systemPrompt,
			`"user_`+strings.Repeat("a", 64)+`_account__session_`+strings.Repeat("b", 36)+`"`), clientHeaders, true},
		{"billing attribution block instead of the identity prompt", "/v1/messages", messagesBody(
			`[{"type":"text","text":"x-anthropic-billing-header: cc_version=2.1.100; cc_entrypoint=cli;"}]`, userID), clientHeaders, true},
		{"one-token connectivity probe", "/v1/messages", `{"model":"m","max_tokens":1,"messages":[]}`, without("X-App"), true},
		{"request a simulated channel test sends", "/v1/messages", string(simulatedBody), simulatedHeaders, true},
		{"another client sending the same body", "/v1/messages", messagesBody(systemPrompt, userID), without("User-Agent"), false},
		{"missing X-App", "/v1/messages", messagesBody(systemPrompt, userID), without("X-App"), false},
		{"missing anthropic-beta", "/v1/messages", messagesBody(systemPrompt, userID), without("anthropic-beta"), false},
		{"a system prompt of its own", "/v1/messages", messagesBody(`[{"type":"text","text":"You are a translator."}]`, userID), clientHeaders, false},
		{"string system prompt", "/v1/messages", messagesBody(`"You are Claude Code, Anthropic's official CLI for Claude."`, userID), clientHeaders, false},
		{"user id in no client format", "/v1/messages", messagesBody(systemPrompt, `"user-42"`), clientHeaders, false},
		{"chat completions with the client's User-Agent", "/v1/chat/completions", messagesBody(systemPrompt, userID), clientHeaders, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			channel, selectErr := selectChannel(exclusiveModel, tc.path, tc.body, tc.headers)
			if tc.claudeCode {
				require.Nil(t, selectErr)
				assert.Equal(t, 2303, channel.Id)
				return
			}
			require.NotNil(t, selectErr)
			assert.Nil(t, channel)
			assert.Equal(t, 403, selectErr.StatusCode)
			assert.Equal(t, "claude_code_only", string(selectErr.Code))

			// The same request is served where the group has an open channel.
			for range 20 {
				channel, selectErr := selectChannel(sharedModel, tc.path, tc.body, tc.headers)
				require.Nil(t, selectErr)
				assert.Equal(t, 2302, channel.Id)
			}
		})
	}
}
