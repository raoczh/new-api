package controller

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/plugins"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const zhiqiTestModel = "zhiqi-alias"

func TestZhiqiSSEPendingUsesDurableOrdinaryImagePricing(test *testing.T) {
	fixture := setupZhiqiAsyncFixture(test)
	recorder := httptest.NewRecorder()
	requestContext, _ := gin.CreateTestContext(recorder)
	requestContext.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	requestContext.Set(common.RequestIdKey, common.NewRequestId())
	const expression = `param("resolution") == "2k" ? tier("2k", fixed(0.04)) * image_count : tier("default", fixed(0.01)) * image_count`
	info := &relaycommon.RelayInfo{
		UserId: fixture.user.Id, TokenId: fixture.token.Id, TokenKey: fixture.token.Key,
		OriginModelName: zhiqiTestModel, UsingGroup: "default", UserGroup: "default", StartTime: time.Now(),
		ForcePreConsume: true, IsStream: true, ImageRequestCount: 1, RelayMode: relayconstant.RelayModeImagesGenerations,
		UserSetting:           kitdto.UserSetting{BillingPreference: "wallet_only"},
		ChannelMeta:           &relaycommon.ChannelMeta{ChannelId: fixture.channel.Id, ApiKey: fixture.channel.Key, UpstreamModelName: "gpt-image-2.6", ChannelSetting: kitdto.ChannelSettings{ZhiqiEngine: common.GetPointer(true)}},
		PriceData:             hosttypes.PriceData{GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}},
		BillingRequestInput:   &billingexpr.RequestInput{Body: []byte(`{"model":"zhiqi-alias","n":1,"resolution":"2k","aspect_ratio":"1:1"}`), ImageCount: common.GetPointer(1)},
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{BillingMode: "tiered_expr", ExprString: expression, ExprHash: billingexpr.ExprHashString(expression), GroupRatio: 1, QuotaPerUnit: common.QuotaPerUnit, EstimatedImageCount: common.GetPointer(1)},
	}
	reserved := common.QuotaRound(0.04 * common.QuotaPerUnit)
	require.Nil(test, service.PreConsumeBilling(requestContext, reserved, info))
	response := &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"text/event-stream"}},
		Body: io.NopCloser(strings.NewReader("event: image_generation.pending\ndata: {\"type\":\"image_generation.pending\",\"id\":\"vendor_private\",\"billing_status\":\"pending\"}\n\n")),
	}
	_, apiError := openai.OpenaiImageStreamHandler(requestContext, info, response)
	require.Nil(test, apiError)
	assert.True(test, requestContext.GetBool("zhiqi_image_pending"))
	assert.NotContains(test, recorder.Body.String(), "vendor_private")
	var tasks []model.Task
	require.NoError(test, model.DB.Find(&tasks).Error)
	require.Len(test, tasks, 1)
	assert.Contains(test, recorder.Body.String(), tasks[0].TaskID)
	assert.Equal(test, reserved, tasks[0].Quota)
	fixture.result.Store(`{"id":"vendor_private","object":"image.task","status":"succeeded","progress":"100%","data":[{"url":"https://cdn.example/a.png"}]}`)
	service.RunTaskPollingOnce(test.Context(), nil)
	service.RunTaskPollingOnce(test.Context(), nil)
	var completed model.Task
	require.NoError(test, model.DB.First(&completed, tasks[0].ID).Error)
	assert.Equal(test, model.TaskStatus(model.TaskStatusSuccess), completed.Status)
	assert.Equal(test, reserved, completed.Quota, "pending retains the original resolution expression, not plugin task pricing")
	assert.Zero(test, fixture.posts.Load(), "pending must only query an already submitted job")
	var owner model.User
	require.NoError(test, model.DB.First(&owner, fixture.user.Id).Error)
	assert.Equal(test, fixture.user.Quota-reserved, owner.Quota)
	query := fixture.request(http.MethodGet, "/v1/images/generations/"+completed.TaskID, "", fixture.token.Key)
	assert.Equal(test, http.StatusOK, query.Code, query.Body.String())
	assert.Contains(test, query.Body.String(), "https://cdn.example/a.png")
}

type zhiqiAsyncFixture struct {
	router        *gin.Engine
	user          model.User
	token         model.Token
	channel       model.Channel
	posts         atomic.Int32
	queries       atomic.Int32
	result        atomic.Value
	onSubmit      func()
	handleRequest func(http.ResponseWriter, *http.Request)
}

func setupZhiqiAsyncFixture(t *testing.T) *zhiqiAsyncFixture {
	t.Helper()
	require.NoError(t, i18n.Init())
	database, dialect := openTaskDialectDatabase(t, &model.User{}, &model.Token{}, &model.Channel{}, &model.Ability{}, &model.Task{}, &model.Log{})
	oldDatabase, oldLogDatabase := model.DB, model.LOG_DB
	oldMain, oldLog := common.MainDatabaseType(), common.LogDatabaseType()
	oldRedis, oldMemory, oldBatch, oldConsume, oldExport := common.RedisEnabled, common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.DataExportEnabled
	oldFactory, oldTimeout := service.GetTaskAdaptorFunc, constant.TaskTimeoutMinutes
	oldQueryLimit := constant.TaskQueryLimit
	oldMaster := common.IsMasterNode
	model.DB, model.LOG_DB = database, database
	common.SetDatabaseTypes(dialect, dialect)
	// Initialize the host's quoted key/group columns against this dialect
	// without opening or migrating any database outside the isolated fixture.
	t.Setenv("LOG_SQL_DSN", "")
	common.IsMasterNode = false
	require.NoError(t, model.InitLogDB())
	common.RedisEnabled, common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.DataExportEnabled = false, false, false, true, false
	constant.TaskTimeoutMinutes = 0
	constant.TaskQueryLimit = 100
	service.GetTaskAdaptorFunc = func(platform constant.TaskPlatform) service.TaskPollingAdaptor { return relay.GetTaskAdaptor(platform) }
	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDatabase, oldLogDatabase
		common.SetDatabaseTypes(oldMain, oldLog)
		common.RedisEnabled, common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.DataExportEnabled = oldRedis, oldMemory, oldBatch, oldConsume, oldExport
		service.GetTaskAdaptorFunc, constant.TaskTimeoutMinutes = oldFactory, oldTimeout
		constant.TaskQueryLimit = oldQueryLimit
		common.IsMasterNode = oldMaster
	})
	allowPrivateTaskMediaTest(t)
	withTieredBillingConfig(t, map[string]string{zhiqiTestModel: billing_setting.BillingModeTieredExpr}, map[string]string{zhiqiTestModel: `tier("ordinary", fixed(0.03)) * image_count`})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: `{"zhiqi::zhiqi-alias":"tier(\"image\", u(\"image_count\") * 0.01)"}`}))
	fixture := &zhiqiAsyncFixture{}
	fixture.result.Store(`{"id":"vendor_private","object":"image.task","model":"gpt-image-2.6","status":"queued","progress":"0%"}`)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		assert.Equal(t, "Bearer originalchannelkey", request.Header.Get("Authorization"))
		writer.Header().Set("Content-Type", "application/json")
		if fixture.handleRequest != nil {
			fixture.handleRequest(writer, request)
			return
		}
		if request.Method == http.MethodPost {
			fixture.posts.Add(1)
			assert.Equal(t, "/v1/images/generations/async", request.URL.Path)
			var body map[string]any
			assert.NoError(t, common.DecodeJson(request.Body, &body))
			assert.Equal(t, "gpt-image-2.6", body["model"])
			assert.Equal(t, float64(1), body["n"])
			if fixture.onSubmit != nil {
				fixture.onSubmit()
			}
			writer.WriteHeader(http.StatusAccepted)
		} else {
			fixture.queries.Add(1)
			assert.Equal(t, http.MethodGet, request.Method)
			assert.Equal(t, "/v1/images/generations/vendor_private", request.URL.Path)
		}
		_, _ = writer.Write([]byte(fixture.result.Load().(string)))
	}))
	t.Cleanup(server.Close)
	fixture.user = model.User{Username: "zhiqi_owner", AffCode: "zhiqiowner", Group: "default", Status: common.UserStatusEnabled, Quota: common.QuotaRound(100 * common.QuotaPerUnit)}
	fixture.user.SetSetting(kitdto.UserSetting{BillingPreference: "wallet_only"})
	require.NoError(t, database.Create(&fixture.user).Error)
	fixture.token = model.Token{UserId: fixture.user.Id, Key: "zhiqiownertoken", Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: fixture.user.Quota}
	require.NoError(t, database.Create(&fixture.token).Error)
	fixture.channel = model.Channel{Name: "zhiqi fixture", Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, BaseURL: &server.URL, Key: "originalchannelkey", Models: zhiqiTestModel, Group: "default", ModelMapping: common.GetPointer(`{"zhiqi-alias":"gpt-image-2.6"}`)}
	fixture.channel.SetSetting(kitdto.ChannelSettings{ZhiqiEngine: common.GetPointer(true)})
	fixture.channel.SetOtherSettings(kitdto.ChannelOtherSettings{DisableTaskPollingSleep: true})
	require.NoError(t, fixture.channel.Insert())
	// Other controller fixtures can warm the process-wide alias view against
	// another database using this same plugin generation. Refresh as channel
	// management does, even when ordinary channel caching is disabled.
	model.InitChannelCache()
	generation := jsplugin.DefaultRegistry.Generation()
	plugin, found := generation.Get("zhiqi")
	require.True(t, found)
	servedModel, upstreamModel, matched := model.ResolveTaskPluginModel(generation, zhiqiTestModel, plugin.Meta.Models)
	require.True(t, matched, "fixture must publish its channel alias before accepting requests")
	require.Equal(t, zhiqiTestModel, servedModel)
	require.Equal(t, "gpt-image-2.6", upstreamModel)
	fixture.router = gin.New()
	for _, route := range plugin.Meta.Routes {
		fixture.router.Handle(route.Method, strings.ReplaceAll(route.Path, ":task_id", ":s3"), func(requestContext *gin.Context) {
			requestContext.Set(jsplugin.ContextKeyPinnedRoute, jsplugin.PinnedRoute{Generation: generation, Plugin: plugin, Route: route})
		}, middleware.TokenAuth(), middleware.PrepareTaskPluginRoute(), middleware.Distribute(), RelayTask)
	}
	return fixture
}

func (fixture *zhiqiAsyncFixture) request(method, path, body, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	if token != "" {
		request.Header.Set("Authorization", "Bearer sk-"+token)
	}
	recorder := httptest.NewRecorder()
	fixture.router.ServeHTTP(recorder, request)
	return recorder
}

func TestZhiqiImageStudioUsesTheSameProtocolAndChargesWithoutSyntheticUsage(test *testing.T) {
	for _, edit := range []bool{false, true} {
		test.Run(fmt.Sprintf("edit=%t", edit), func(test *testing.T) {
			fixture := setupZhiqiAsyncFixture(test)
			withImageStudioStorage(test)
			input := service.ImageStudioRunInput{
				UserId: fixture.user.Id, Model: zhiqiTestModel, Group: "default", Prompt: "a bird",
				Params: `{"n":1,"resolution":"2k","aspect_ratio":"4:3","output_format":"webp","output_compression":0}`,
			}
			if edit {
				input.ReferenceKeys = []string{saveImageStudioTestImage(test), saveImageStudioTestImage(test)}
				input.MaskKey = saveImageStudioTestImage(test)
			}
			fixture.handleRequest = func(writer http.ResponseWriter, request *http.Request) {
				fixture.posts.Add(1)
				if edit {
					assert.Equal(test, "/v1/images/edits", request.URL.Path)
					if err := request.ParseMultipartForm(1 << 20); !assert.NoError(test, err) {
						writer.WriteHeader(http.StatusBadRequest)
						return
					}
					defer request.MultipartForm.RemoveAll()
					assert.Len(test, request.MultipartForm.Value["image"], 2)
					assert.Empty(test, request.MultipartForm.File)
					assert.Equal(test, "0", request.FormValue("output_compression"))
					assert.Equal(test, "2k", request.FormValue("resolution"))
					assert.Equal(test, "4:3", request.FormValue("aspect_ratio"))
					assert.True(test, strings.HasPrefix(request.FormValue("mask"), "https://img.example.com/"))
				} else {
					assert.Equal(test, "/v1/images/generations", request.URL.Path)
					var parameters map[string]any
					assert.NoError(test, common.DecodeJson(request.Body, &parameters))
					assert.Equal(test, "gpt-image-2.6", parameters["model"])
					assert.Equal(test, "2k", parameters["resolution"])
					assert.Equal(test, "4:3", parameters["aspect_ratio"])
					assert.Equal(test, float64(0), parameters["output_compression"])
					assert.NotContains(test, parameters, "quality")
				}
				_, _ = io.WriteString(writer, `{"data":[{"url":"https://cdn.example/bird.webp"}],"output_format":"webp"}`)
			}
			output, err := runImageStudioRelay(test.Context(), input)
			require.NoError(test, err)
			assert.Equal(test, http.StatusOK, output.StatusCode)
			assert.Contains(test, string(output.Body), "https://cdn.example/bird.webp")
			assert.NotContains(test, string(output.Body), `"usage"`)
			assert.Equal(test, int32(1), fixture.posts.Load())
			var owner model.User
			require.NoError(test, model.DB.First(&owner, fixture.user.Id).Error)
			assert.Equal(test, fixture.user.Quota-common.QuotaRound(0.03*common.QuotaPerUnit), owner.Quota)
			var consumeLog model.Log
			require.NoError(test, model.LOG_DB.Where("request_id = ?", output.RequestId).First(&consumeLog).Error)
			assert.Zero(test, consumeLog.PromptTokens)
			assert.Zero(test, consumeLog.CompletionTokens)
		})
	}
}

func TestZhiqiAsyncParametersAndUsage(t *testing.T) {
	source, err := plugins.Source("zhiqi")
	require.NoError(t, err)
	plugin, err := jsplugin.CompilePlugin(source, jsplugin.Options{})
	require.NoError(t, err)
	assert.Empty(t, plugin.Meta.Protocols, "ordinary sync/SSE paths must stay in Go")
	assert.Empty(t, plugin.Meta.ChannelTypes, "an engine flag must not claim a global channel type")
	for _, name := range []string{"nano_banana_2", "nano-banana-2.1", "nano_banana_pro"} {
		assert.Contains(t, plugin.Meta.Models, name)
	}
	for _, testCase := range []struct {
		name  string
		extra string
		valid bool
	}{
		{"defaults", ``, true}, {"explicit zero compression", `,"output_format":"webp","output_compression":0`, true},
		{"size precedence preserved", `,"resolution":"4k","aspect_ratio":"4:3","size":"1024X1024"`, true},
		{"ratio size", `,"size":"16:9","quality":"max"`, true},
		{"GIF limits", `,"output_format":"gif","frame_count":16,"frame_duration_ms":655350`, true},
		{"URL edit", `,"reference_image_urls":["https://cdn.example/a.png","https://cdn.example/b.png"],"mask":"https://cdn.example/mask.png"`, true},
		{"empty references", `,"reference_image_urls":[]`, true}, {"false stream filtered", `,"stream":false`, true},
		{"zero n", `,"n":0`, false}, {"batch", `,"n":2`, false}, {"overflow", `,"n":18446744073709551615`, false},
		{"true stream", `,"stream":true`, false}, {"base64 response", `,"response_format":"b64_json"`, false},
		{"invalid size", `,"size":"1024X1024"`, false}, {"oversized dimensions", `,"size":"4097x1024"`, false},
		{"PNG compression", `,"output_format":"png","output_compression":0`, false},
		{"negative compression", `,"output_format":"jpeg","output_compression":-1`, false},
		{"GIF frames", `,"output_format":"gif","frame_count":17`, false}, {"GIF duration", `,"output_format":"gif","frame_duration_ms":19`, false},
		{"non GIF frames", `,"frame_count":2`, false}, {"data URL", `,"reference_image_urls":["data:image/png;base64,YQ=="]`, false},
		{"private field", `,"client_reference":"foreign"`, false}, {"callback", `,"callback_url":"https://evil.example"`, false},
		{"ratio alias", `,"ratio":"1:1"`, false}, {"passthrough", `,"metadata":{"n":8}`, false},
		{"too many references", `,"reference_image_urls":[` + strings.TrimSuffix(strings.Repeat(`"https://cdn.example/image.png",`, 17), ",") + `]`, false},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			var body map[string]any
			require.NoError(t, common.UnmarshalJsonStr(`{"model":"gpt-image-2.6","prompt":"bird"`+testCase.extra+`}`, &body))
			value, callErr := plugin.Engine.CallPath(t.Context(), "native", []string{"createImage"}, map[string]any{"body": map[string]any{"kind": "json", "value": body}})
			if !testCase.valid {
				require.Error(t, callErr)
				return
			}
			require.NoError(t, callErr)
			encoded, marshalErr := common.Marshal(value)
			require.NoError(t, marshalErr)
			var decoded struct {
				RequestBody map[string]any `json:"requestBody"`
			}
			require.NoError(t, common.Unmarshal(encoded, &decoded))
			assert.NotContains(t, decoded.RequestBody, "stream")
			assert.Equal(t, float64(1), decoded.RequestBody["n"])
			if body["quality"] == nil {
				assert.NotContains(t, decoded.RequestBody, "quality")
			}
			for name, expected := range body {
				if name == "size" && body["resolution"] != nil && body["aspect_ratio"] != nil {
					assert.NotContains(t, decoded.RequestBody, "size")
					continue
				}
				if name != "stream" {
					assert.Equal(t, expected, decoded.RequestBody[name], name)
				}
			}
		})
	}
	for _, testCase := range []struct {
		data  string
		count float64
	}{
		{`{"url":"https://cdn.example/a.png"}`, 1},
		{`[{"url":"https://cdn.example/a.png"},{"b64_json":"encoded"},{"revised_prompt":"only"}]`, 1},
		{`[{"url":"https://cdn.example/a.png"},{"url":"https://cdn.example/b.png"}]`, 2},
		{`[{"revised_prompt":"only"}]`, 0},
	} {
		var body map[string]any
		require.NoError(t, common.UnmarshalJsonStr(`{"status":"succeeded","data":`+testCase.data+`}`, &body))
		facts, callErr := plugin.Engine.Call(t.Context(), "extractUsageOnComplete", map[string]any{}, map[string]any{}, body)
		require.NoError(t, callErr)
		encoded, marshalErr := common.Marshal(facts)
		require.NoError(t, marshalErr)
		var usage map[string]float64
		require.NoError(t, common.Unmarshal(encoded, &usage))
		assert.Equal(t, testCase.count, usage["image_count"])
		if testCase.count == 0 {
			assert.Empty(t, usage, "no payload must retain reservation")
		}
	}
}

func TestZhiqiAsyncLifecycleDatabase(t *testing.T) {
	for _, testCase := range []struct {
		name, terminal string
		charge         float64
		pending        bool
	}{
		{"success actual count", `"status":"succeeded","data":[{"url":"https://cdn.example/a.png"},{"url":"https://cdn.example/b.png"}],"metadata":{"upstream_usage":{"cost":7}}`, 0.02, false},
		{"failed generation refunds", `"status":"failed","error":{"code":"generation_failed","message":"Provider rejected generation"}`, 0, false},
		{"media failure retains charge", `"status":"failed","error":{"code":"media_storage_failed","message":"Media delivery failed"}`, 0.01, false},
		{"pending media then query failure", `"status":"failed","error":{"code":"poll_failed","message":"Status unavailable"}`, 0.01, true},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			fixture := setupZhiqiAsyncFixture(t)
			recorder := fixture.request(http.MethodPost, "/v1/images/generations/async", `{"model":"zhiqi-alias","prompt":"bird"}`, fixture.token.Key)
			require.Equal(t, http.StatusAccepted, recorder.Code, recorder.Body.String())
			var receipt map[string]any
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &receipt))
			assert.Equal(t, "image.task", receipt["object"])
			assert.Equal(t, "queued", receipt["status"])
			assert.NotContains(t, recorder.Body.String(), "vendor_private")
			publicID := receipt["id"].(string)
			var task model.Task
			require.NoError(t, model.DB.Where("task_id = ?", publicID).First(&task).Error)
			assert.Equal(t, "vendor_private", task.PrivateData.UpstreamTaskID)
			assert.Equal(t, "originalchannelkey", task.PrivateData.Key)
			assert.Equal(t, fixture.channel.Id, task.ChannelId)
			assert.Equal(t, fixture.token.Id, task.PrivateData.TokenId)
			assert.Equal(t, "gpt-image-2.6", task.Properties.UpstreamModelName)
			assert.Equal(t, common.QuotaRound(0.01*common.QuotaPerUnit), task.Quota)
			// Changing channel keys and live pricing must not rewrite saved identity or the frozen price.
			require.NoError(t, model.DB.Model(&fixture.channel).Update("key", "rotatedkey").Error)
			require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: `{"zhiqi::zhiqi-alias":"tier(\"changed\", u(\"image_count\") * 0.09)"}`}))
			if testCase.pending {
				fixture.result.Store(`{"id":"vendor_private","object":"image.task","status":"in_progress","progress":"99%"}`)
				service.RunTaskPollingOnce(t.Context(), nil)
				require.NoError(t, model.DB.Where("task_id = ?", publicID).First(&task).Error)
				assert.Equal(t, model.TaskStatus(model.TaskStatusInProgress), task.Status)
				assert.Equal(t, "99%", task.Progress)
				var generationState struct {
					Completed bool `json:"generationCompleted"`
				}
				require.NoError(t, common.Unmarshal(task.PrivateData.PluginState, &generationState))
				assert.True(t, generationState.Completed)
			}
			fixture.result.Store(`{"id":"vendor_private","object":"image.task","model":"gpt-image-2.6","progress":"100%",` + testCase.terminal + `}`)
			service.RunTaskPollingOnce(t.Context(), nil)
			service.RunTaskPollingOnce(t.Context(), nil)
			require.NoError(t, model.DB.Where("task_id = ?", publicID).First(&task).Error)
			wantQuota := common.QuotaRound(testCase.charge * common.QuotaPerUnit)
			assert.Equal(t, wantQuota, task.Quota)
			var user model.User
			require.NoError(t, model.DB.First(&user, fixture.user.Id).Error)
			assert.Equal(t, fixture.user.Quota-wantQuota, user.Quota)
			var token model.Token
			require.NoError(t, model.DB.First(&token, fixture.token.Id).Error)
			assert.Equal(t, fixture.token.RemainQuota-wantQuota, token.RemainQuota)
			assert.Equal(t, int32(1), fixture.posts.Load(), "polling must never resubmit")
			query := fixture.request(http.MethodGet, "/v1/images/generations/"+publicID, "", fixture.token.Key)
			require.Equal(t, http.StatusOK, query.Code, query.Body.String())
			assert.Contains(t, query.Body.String(), `"model":"zhiqi-alias"`)
			assert.NotContains(t, query.Body.String(), "vendor_private")
			if task.Status == model.TaskStatusFailure {
				assert.NotEmpty(t, task.FailReason)
				assert.Contains(t, query.Body.String(), `"error"`)
			}
		})
	}
}

func TestZhiqiAsyncAuthorizationAndPriceGuard(t *testing.T) {
	fixture := setupZhiqiAsyncFixture(t)
	path := "/v1/images/generations/async"
	body := `{"model":"zhiqi-alias","prompt":"bird"}`
	unauthenticated := fixture.request(http.MethodPost, path, body, "")
	assert.Equal(t, http.StatusUnauthorized, unauthenticated.Code)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: `{}`}))
	priceError := fixture.request(http.MethodPost, path, body, fixture.token.Key)
	assert.Equal(t, http.StatusBadRequest, priceError.Code, priceError.Body.String())
	assert.Contains(t, priceError.Body.String(), "model_price_error")
	assert.Contains(t, priceError.Body.String(), "zhiqi::zhiqi-alias")
	assert.Zero(t, fixture.posts.Load(), "ordinary fixed expression is rejected before paid work")
	for _, settings := range []string{`{"zhiqi_engine":false,"image_reference_as_url":true}`, `{"task_plugin_key":"zhiqi"}`} {
		require.NoError(t, model.DB.Model(&fixture.channel).Update("setting", settings).Error)
		recorder := fixture.request(http.MethodPost, path, body, fixture.token.Key)
		assert.Equal(t, http.StatusServiceUnavailable, recorder.Code, recorder.Body.String())
		assert.Zero(t, fixture.posts.Load())
	}
	task := model.Task{TaskID: "task_owned_image", UserId: fixture.user.Id, Platform: "zhiqi", Status: model.TaskStatusSuccess, Progress: "100%", Properties: model.Properties{OriginModelName: zhiqiTestModel}, Data: []byte(`{"id":"private","object":"image.task","data":[{"url":"https://cdn.example/secret.png"}]}`)}
	require.NoError(t, model.DB.Create(&task).Error)
	otherUser := model.User{Username: "zhiqi_other", AffCode: "zhiqiother", Group: "default", Status: common.UserStatusEnabled, Quota: fixture.user.Quota}
	require.NoError(t, model.DB.Create(&otherUser).Error)
	otherToken := model.Token{UserId: otherUser.Id, Key: "zhiqiothertoken", Status: common.TokenStatusEnabled, ExpiredTime: -1, UnlimitedQuota: true}
	require.NoError(t, model.DB.Create(&otherToken).Error)
	queryPath := "/v1/images/generations/" + task.TaskID
	for _, requestToken := range []string{otherToken.Key, fixture.token.Key} {
		if requestToken == fixture.token.Key {
			require.NoError(t, model.DB.Model(&task).Update("platform", "sora").Error)
		}
		recorder := fixture.request(http.MethodGet, queryPath, "", requestToken)
		assert.Equal(t, http.StatusNotFound, recorder.Code)
		assert.NotContains(t, recorder.Body.String(), "secret.png")
	}
	require.NoError(t, model.DB.Model(&task).Update("platform", "zhiqi").Error)
	require.NoError(t, model.DB.Model(&fixture.token).Updates(map[string]any{"model_limits_enabled": true, "model_limits": "other-model"}).Error)
	denied := fixture.request(http.MethodGet, queryPath, "", fixture.token.Key)
	assert.Equal(t, http.StatusNotFound, denied.Code)
	assert.NotContains(t, denied.Body.String(), "secret.png")
}

func TestZhiqiEngineChannelBindings(t *testing.T) {
	for _, channelType := range []int{constant.ChannelTypeOpenAI, constant.ChannelTypeNewAPI, constant.ChannelTypeCustom, constant.ChannelTypeAdvancedCustom, constant.ChannelTypeTaskPlugin, constant.ChannelTypeGemini} {
		for _, setting := range []struct {
			json    string
			enabled bool
		}{
			{`{"zhiqi_engine":true}`, true}, {`{"image_reference_as_url":true}`, true},
			{`{"zhiqi_engine":false,"image_reference_as_url":true}`, false}, {`{"task_plugin_key":"zhiqi"}`, false},
		} {
			t.Run(fmt.Sprintf("%d/%s", channelType, setting.json), func(t *testing.T) {
				channel := model.Channel{Type: channelType, Setting: &setting.json}
				matched, _ := model.ChannelSatisfiesFilters(&channel, "gpt-image-2.6", []dto.ChannelFilter{{Kind: dto.FilterTaskPluginIdentity, TaskPluginKey: "zhiqi"}})
				expected := setting.enabled && channelType != constant.ChannelTypeTaskPlugin && channelType != constant.ChannelTypeGemini
				assert.Equal(t, expected, matched)
				if channelType == constant.ChannelTypeAdvancedCustom {
					for _, path := range []string{"/v1/images/generations", "/v1/images/edits", "/v1/images/generations/async", "/zhiqi/v1/images/generations/async"} {
						pathMatched, _ := model.ChannelSatisfiesFilters(&channel, "gpt-image-2.6", []dto.ChannelFilter{{Kind: dto.FilterRequestPath, RequestPath: path}})
						assert.Equal(t, expected, pathMatched, "image route %s", path)
					}
					chatMatched, _ := model.ChannelSatisfiesFilters(&channel, "gpt-image-2.6", []dto.ChannelFilter{{Kind: dto.FilterRequestPath, RequestPath: "/v1/chat/completions"}})
					assert.False(t, chatMatched, "the image engine must not bypass unrelated custom routes")
				}
			})
		}
	}
	plugin, found := jsplugin.DefaultRegistry.Generation().Get("zhiqi")
	require.True(t, found)
	for _, baseURL := range []string{"https://gateway.example/", "https://gateway.example/v1/"} {
		value, err := plugin.Engine.Call(context.Background(), "buildQueryRequest", map[string]any{"baseUrl": baseURL, "upstream": map[string]any{"kind": "new_api"}, "taskId": "private/id", "apiKey": "key"})
		require.NoError(t, err)
		encoded, err := common.Marshal(value)
		require.NoError(t, err)
		assert.Contains(t, string(encoded), "https://gateway.example/v1/images/generations/private%2Fid")
	}
}

func TestZhiqiSubmissionNeverRepeatsPaidWork(t *testing.T) {
	t.Run("accepted malformed receipt does not retry", func(t *testing.T) {
		fixture := setupZhiqiAsyncFixture(t)
		originalRetryTimes := common.RetryTimes
		common.RetryTimes = 2
		t.Cleanup(func() { common.RetryTimes = originalRetryTimes })
		fixture.result.Store(`{"object":"image.task","status":"queued"}`)
		recorder := fixture.request(http.MethodPost, "/v1/images/generations/async", `{"model":"zhiqi-alias","prompt":"bird"}`, fixture.token.Key)
		assert.Equal(t, http.StatusBadGateway, recorder.Code, recorder.Body.String())
		assert.Equal(t, int32(1), fixture.posts.Load())
	})
	t.Run("disconnect after submission retains durable task", func(t *testing.T) {
		fixture := setupZhiqiAsyncFixture(t)
		requestContext, cancel := context.WithCancel(t.Context())
		defer cancel()
		fixture.onSubmit = cancel
		request := httptest.NewRequest(http.MethodPost, "/v1/images/generations/async", strings.NewReader(`{"model":"zhiqi-alias","prompt":"bird"}`)).WithContext(requestContext)
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer sk-"+fixture.token.Key)
		recorder := httptest.NewRecorder()
		fixture.router.ServeHTTP(recorder, request)
		assert.Equal(t, http.StatusAccepted, recorder.Code, recorder.Body.String())
		var tasks []model.Task
		require.NoError(t, model.DB.Find(&tasks).Error)
		require.Len(t, tasks, 1)
		assert.Equal(t, "vendor_private", tasks[0].PrivateData.UpstreamTaskID)
		assert.Equal(t, common.QuotaRound(0.01*common.QuotaPerUnit), tasks[0].Quota)
		assert.Equal(t, int32(1), fixture.posts.Load())
	})
}
