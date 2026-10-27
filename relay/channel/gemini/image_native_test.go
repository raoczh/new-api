package gemini

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func withGeminiModelType(t *testing.T, modelTypes map[string]string) {
	t.Helper()
	settings := model_setting.GetGlobalSettings()
	original := settings.ModelTypes
	t.Cleanup(func() { settings.ModelTypes = original })
	settings.ModelTypes = modelTypes
}

func TestIsGeminiNativeImageModel(t *testing.T) {
	withGeminiModelType(t, map[string]string{"*-image": "image", "*nano-banana*": "image"})

	assert.True(t, IsGeminiNativeImageModel(&relaycommon.RelayInfo{OriginModelName: "gemini-nano-banana"}))
	assert.True(t, IsGeminiNativeImageModel(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gemini-3-pro-image-preview"}}))
	// Imagen stays on its own :predict transport.
	assert.False(t, IsGeminiNativeImageModel(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "imagen-4.0-generate-001"}}))
	assert.False(t, IsGeminiNativeImageModel(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gemini-2.0-flash"}}))
	assert.False(t, IsGeminiNativeImageModel(nil))
}

func TestBuildGeminiNativeImageRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withGeminiModelType(t, map[string]string{"*-image": "image"})

	newContext := func(t *testing.T) *gin.Context {
		t.Helper()
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
		return ctx
	}

	t.Run("text only", func(t *testing.T) {
		ctx := newContext(t)
		info := &relaycommon.RelayInfo{
			OriginModelName: "gemini-3-pro-image-preview",
			ChannelMeta: &relaycommon.ChannelMeta{
				UpstreamModelName: "gemini-3-pro-image-preview",
			},
			IsStream: true,
		}
		converted, err := buildGeminiNativeImageRequest(ctx, info, dto.ImageRequest{
			Prompt:  "a cat",
			Size:    "1792x1024",
			Quality: "hd",
		})
		require.NoError(t, err)

		request, ok := converted.(*dto.GeminiChatRequest)
		require.True(t, ok)
		require.Len(t, request.Contents, 1)
		require.Len(t, request.Contents[0].Parts, 1)
		assert.Equal(t, "a cat", request.Contents[0].Parts[0].Text)
		assert.Equal(t, []string{"TEXT", "IMAGE"}, request.GenerationConfig.ResponseModalities)

		var imageConfig geminiNativeImageConfig
		require.NoError(t, common.Unmarshal(request.GenerationConfig.ImageConfig, &imageConfig))
		assert.Equal(t, "16:9", imageConfig.AspectRatio)
		assert.Equal(t, "2K", imageConfig.ImageSize)
		// The upstream call is always non-streaming.
		assert.False(t, info.IsStream)
	})

	t.Run("reference image before prompt", func(t *testing.T) {
		ctx := newContext(t)
		info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gemini-3-pro-image-preview"}}
		const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
		converted, err := buildGeminiNativeImageRequest(ctx, info, dto.ImageRequest{
			Prompt: "make it blue",
			Image:  json.RawMessage(`"` + pngBase64 + `"`),
		})
		require.NoError(t, err)

		request := converted.(*dto.GeminiChatRequest)
		parts := request.Contents[0].Parts
		require.Len(t, parts, 2)
		require.NotNil(t, parts[0].InlineData)
		assert.Equal(t, "image/png", parts[0].InlineData.MimeType)
		assert.Equal(t, pngBase64, parts[0].InlineData.Data)
		assert.Equal(t, "make it blue", parts[1].Text)
	})

	t.Run("rejects multiple images", func(t *testing.T) {
		ctx := newContext(t)
		two := uint(2)
		_, err := buildGeminiNativeImageRequest(ctx, &relaycommon.RelayInfo{}, dto.ImageRequest{Prompt: "a cat", N: &two})
		require.Error(t, err)
		var apiErr *types.NewAPIError
		require.ErrorAs(t, err, &apiErr)
		assert.Contains(t, apiErr.Error(), "one image per request")
	})

	t.Run("rejects stream", func(t *testing.T) {
		ctx := newContext(t)
		stream := true
		_, err := buildGeminiNativeImageRequest(ctx, &relaycommon.RelayInfo{}, dto.ImageRequest{Prompt: "a cat", Stream: &stream})
		require.Error(t, err)
	})

	t.Run("rejects mask", func(t *testing.T) {
		ctx := newContext(t)
		_, err := buildGeminiNativeImageRequest(ctx, &relaycommon.RelayInfo{}, dto.ImageRequest{
			Prompt: "a cat",
			Mask:   json.RawMessage(`"https://example.com/mask.png"`),
		})
		require.Error(t, err)
	})

	t.Run("omits imageSize for nano banana", func(t *testing.T) {
		ctx := newContext(t)
		converted, err := buildGeminiNativeImageRequest(ctx, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gemini-nano-banana"}}, dto.ImageRequest{
			Prompt:  "a cat",
			Quality: "hd",
		})
		require.NoError(t, err)
		request := converted.(*dto.GeminiChatRequest)
		assert.Empty(t, request.GenerationConfig.ImageConfig)
	})
}

func TestGeminiNativeImageHandlerExtractsInlineImages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	response := `{
		"candidates": [{
			"content": {"role": "model", "parts": [
				{"text": "here you go"},
				{"inlineData": {"mimeType": "image/png", "data": "AAAA"}}
			]},
			"finishReason": "STOP"
		}],
		"usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 20, "totalTokenCount": 30}
	}`
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(response)),
	}
	info := &relaycommon.RelayInfo{RelayMode: constant.RelayModeImagesGenerations}

	usage, apiErr := GeminiNativeImageHandler(ctx, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	var imageResponse dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResponse))
	require.Len(t, imageResponse.Data, 1)
	assert.Equal(t, "AAAA", imageResponse.Data[0].B64Json)
	assert.Equal(t, 30, usage.TotalTokens)
}

func TestGeminiNativeImageHandlerReportsBlockedPrompt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	response := `{"promptFeedback": {"blockReason": "SAFETY"}, "candidates": []}`
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(response)),
	}
	info := &relaycommon.RelayInfo{RelayMode: constant.RelayModeImagesGenerations}

	_, apiErr := GeminiNativeImageHandler(ctx, info, resp)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.True(t, info.PerformanceBusinessRejection)
}

func TestGetRequestURLAvoidsStreamingForNativeImageModels(t *testing.T) {
	withGeminiModelType(t, map[string]string{"*-image": "image"})
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-3-pro-image-preview",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://example.com",
			UpstreamModelName: "gemini-3-pro-image-preview",
		},
		IsStream:    true,
		RelayFormat: types.RelayFormatOpenAIImage,
	}
	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.True(t, strings.HasSuffix(url, ":generateContent"), url)

	// Chat traffic keeps streaming.
	info.RelayFormat = types.RelayFormatOpenAI
	url, err = adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Contains(t, url, ":streamGenerateContent?alt=sse")
}
