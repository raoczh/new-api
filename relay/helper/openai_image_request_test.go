package helper

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLegacyDalleValidationAndPricesRemainCompatible(t *testing.T) {
	for _, tc := range []struct {
		body, size, quality string
		ratio               float64
		invalid             bool
	}{
		{body: `{"model":"dall-e-2"}`, size: "1024x1024", ratio: 1},
		{body: `{"model":"dall-e"}`, size: "1024x1024", ratio: 1},
		{body: `{"model":"dall-e-3"}`, size: "1024x1024", quality: "standard", ratio: 1},
		{body: `{"model":"dall-e-2","size":"256x256"}`, size: "256x256", ratio: 0.4},
		{body: `{"model":"dall-e-2","size":"512x512","quality":"hd"}`, size: "512x512", quality: "hd", ratio: 0.45},
		{body: `{"model":"dall-e-3","quality":"hd"}`, size: "1024x1024", quality: "hd", ratio: 2},
		{body: `{"model":"dall-e-3","size":"1024x1792","quality":"hd"}`, size: "1024x1792", quality: "hd", ratio: 3},
		{body: `{"model":"dall-e-3","size":"1792x1024"}`, size: "1792x1024", quality: "standard", ratio: 2},
		{body: `{"model":"dall-e-3","size":"256x256"}`, invalid: true},
		{body: `{"model":"dall-e-2","size":"1024x1792"}`, invalid: true},
	} {
		t.Run(tc.body, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(tc.body))
			c.Request.Header.Set("Content-Type", "application/json")
			request, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			if tc.invalid {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.size, request.Size)
			assert.Equal(t, tc.quality, request.Quality)
			assert.Equal(t, tc.ratio, request.GetTokenCountMeta().ImagePriceRatio)
		})
	}
}

// TestGetAndValidOpenAIImageRequestMultipartStream verifies multipart image
// edit parsing: the stream field is parsed and validated, and the request body
// stays replayable for the upstream request.
func TestGetAndValidOpenAIImageRequestMultipartStream(t *testing.T) {
	gin.SetMode(gin.TestMode)

	newContext := func(t *testing.T, streamValue string, withImage bool) (*gin.Context, string) {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		require.NoError(t, writer.WriteField("prompt", "edit this image"))
		require.NoError(t, writer.WriteField("stream", streamValue))
		if withImage {
			part, err := writer.CreateFormFile("image", "input.png")
			require.NoError(t, err)
			_, err = part.Write([]byte("fake image"))
			require.NoError(t, err)
		}
		require.NoError(t, writer.Close())
		originalBody := body.String()

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		return c, originalBody
	}

	t.Run("valid stream value keeps body replayable", func(t *testing.T) {
		c, originalBody := newContext(t, "true", true)

		req, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
		require.NoError(t, err)
		require.NotNil(t, req.Stream)
		require.True(t, *req.Stream)
		require.True(t, req.IsStream(c.Request))

		bodyAfterValidation, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		require.Equal(t, originalBody, string(bodyAfterValidation))

		form, err := common.ParseMultipartFormReusable(c)
		require.NoError(t, err)
		require.Equal(t, "true", url.Values(form.Value).Get("stream"))
		require.Len(t, form.File["image"], 1)
		billing, err := ResolveImageBillingRequestInput(c, &relaycommon.RelayInfo{Request: req}, billingexpr.RequestInput{})
		require.NoError(t, err)
		require.Equal(t, 1, *billing.ImageCount)
		require.NotContains(t, string(billing.Body), "fake image")
		require.NotContains(t, string(billing.Body), "edit this image")
	})

	t.Run("invalid stream value is rejected", func(t *testing.T) {
		c, _ := newContext(t, "notabool", false)

		_, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid stream value")
	})
}

func TestZhiqiImageRequestValidatesParametersWithoutChangingOrdinaryChannels(t *testing.T) {
	for _, testCase := range []struct {
		name       string
		parameters string
		wantError  string
	}{
		{name: "omitted optional parameters", parameters: ``},
		{name: "explicit zero compression and false stream", parameters: `,"output_format":"webp","output_compression":0,"stream":false`},
		{name: "complete specification supersedes size", parameters: `,"resolution":"4k","aspect_ratio":"4:3","size":"unused"`},
		{name: "GIF boundaries", parameters: `,"output_format":"gif","frame_count":2,"frame_duration_ms":20`},
		{name: "GIF cannot stream", parameters: `,"output_format":"gif","stream":true`, wantError: "GIF"},
		{name: "non-GIF cannot have frames", parameters: `,"frame_count":2`, wantError: "GIF"},
		{name: "fractional compression", parameters: `,"output_format":"jpeg","output_compression":0.5`, wantError: "invalid"},
		{name: "unsupported compression format", parameters: `,"output_format":"png","output_compression":0`, wantError: "jpeg or webp"},
		{name: "frame count under minimum", parameters: `,"output_format":"gif","frame_count":1`, wantError: "frame_count"},
		{name: "frame duration over maximum", parameters: `,"output_format":"gif","frame_duration_ms":655351`, wantError: "frame_duration_ms"},
		{name: "zero count is rejected", parameters: `,"n":0`, wantError: "n must"},
		{name: "wrapped unsigned count is rejected", parameters: `,"n":18446744073686646784`, wantError: "n must"},
		{name: "GPT count must be one", parameters: `,"n":2`, wantError: "n=1"},
		{name: "ratio alias is not silently dropped", parameters: `,"ratio":"1:1"`, wantError: "ratio"},
		{name: "callback is private", parameters: `,"callback_url":"https://example.com"`, wantError: "callback_url"},
		{name: "uppercase pixel separator", parameters: `,"size":"1024X1024"`, wantError: "size"},
		{name: "oversized image side", parameters: `,"size":"4097x1024"`, wantError: "4096"},
	} {
		t.Run(testCase.name, func(test *testing.T) {
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			context.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{"model":"gpt-image-2.6","prompt":"a cat"`+testCase.parameters+`}`))
			context.Request.Header.Set("Content-Type", "application/json")
			common.SetContextKey(context, constant.ContextKeyChannelSetting, dto.ChannelSettings{ZhiqiEngine: common.GetPointer(true)})
			test.Cleanup(func() { common.CleanupBodyStorage(context) })
			request, err := GetAndValidOpenAIImageRequest(context, relayconstant.RelayModeImagesGenerations)
			if testCase.wantError != "" {
				require.ErrorContains(test, err, testCase.wantError)
				return
			}
			require.NoError(test, err)
			assert.Empty(test, request.Quality, "omission must not acquire a provider default")
			if request.Stream != nil {
				assert.False(test, *request.Stream)
				assert.JSONEq(test, `0`, string(request.OutputCompression))
			}
		})
	}
}

func TestZhiqiMultipartPreservesReferenceOrderAndBillingScalars(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for _, field := range [][2]string{
		{"model", "gpt-image-2.6"}, {"prompt", "private prompt"},
		{"image", "https://example.com/first.png"}, {"image", "https://example.com/second.png"},
		{"mask", "https://example.com/mask.png"}, {"resolution", "2k"}, {"aspect_ratio", "4:3"},
		{"output_format", "webp"}, {"output_compression", "0"},
	} {
		require.NoError(t, writer.WriteField(field[0], field[1]))
	}
	require.NoError(t, writer.Close())
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body.Bytes()))
	context.Request.Header.Set("Content-Type", writer.FormDataContentType())
	t.Cleanup(func() { common.CleanupBodyStorage(context) })
	request, err := ReadZhiqiImageRequest(context)
	require.NoError(t, err)
	require.Len(t, request.References, 2)
	assert.Equal(t, "https://example.com/first.png", request.References[0].Value)
	assert.Equal(t, "https://example.com/second.png", request.References[1].Value)
	require.NotNil(t, request.Mask)
	assert.Equal(t, "https://example.com/mask.png", request.Mask.Value)
	billingBody, err := request.BillingBody()
	require.NoError(t, err)
	assert.JSONEq(t, `{"model":"gpt-image-2.6","n":1,"resolution":"2k","aspect_ratio":"4:3","output_format":"webp","output_compression":0}`, string(billingBody))
	storage, err := common.GetBodyStorage(context)
	require.NoError(t, err)
	originalBody, err := storage.Bytes()
	require.NoError(t, err)
	assert.Equal(t, body.Bytes(), originalBody)
}

// Provider `parameters.n` is still bounded at ingress so a malformed multiplier
// is a client error, but the billing quantity always follows the top-level n:
// Ali image requests are served by the alibaba task plugin, which owns the
// DashScope parameters.n semantics.
func TestImageBillingRequestValidatesProviderCountWithoutOverriding(t *testing.T) {
	for _, tc := range []struct {
		body    string
		count   int
		invalid bool
	}{
		{`{"model":"z-image","n":2,"parameters":{"n":3,"prompt_extend":true}}`, 2, false},
		{`{"model":"gpt-image-2","n":2,"parameters":{"n":3}}`, 2, false},
		{`{"model":"z-image","n":2,"parameters":{"n":129}}`, 0, true},
		{`{"model":"z-image","parameters":{"n":-1}}`, 0, true},
		{`{"model":"z-image","n":2,"parameters":{}}`, 2, false},
		{`{"model":"z-image","n":2,"parameters":{"n":null}}`, 2, false},
		{`{"model":"z-image","n":2,"parameters":{"n":0}}`, 2, false},
		{`{"model":"z-image","parameters":{"n":1.5}}`, 0, true},
		{`{"model":"z-image","parameters":{"n":18446744073686646784}}`, 0, true},
		{`{"model":"z-image","parameters":{"n":128}}`, 1, false},
		{`{"model":"z-image","n":0}`, 1, false},
		{`{"model":"gpt-image-2","n":2,"parameters":{"n":0}}`, 2, false},
	} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(tc.body))
		c.Request.Header.Set("Content-Type", "application/json")
		common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
		request, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
		if tc.invalid {
			require.Error(t, err, tc.body)
			continue
		}
		require.NoError(t, err, tc.body)
		input, err := ResolveImageBillingRequestInput(c, &relaycommon.RelayInfo{Request: request}, billingexpr.RequestInput{})
		require.NoError(t, err)
		require.Equal(t, tc.count, *input.ImageCount, tc.body)
		cost, _, err := billingexpr.RunExprWithRequest(`tier("image", fixed(0.04)) * image_count`, billingexpr.TokenParams{}, input)
		require.NoError(t, err)
		require.Equal(t, float64(tc.count)*40000, cost)
	}
}

// TestGetAndValidOpenAIImageRequestNBounds guards the billing invariant that
// the image generation count can never reach quota calculation with a value
// large enough to overflow int64 into a negative charge.
func TestGetAndValidOpenAIImageRequestNBounds(t *testing.T) {
	gin.SetMode(gin.TestMode)

	newJSONContext := func(t *testing.T, body string) *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(body))
		c.Request.Header.Set("Content-Type", "application/json")
		return c
	}

	boundErr := fmt.Sprintf("n must be an integer between 1 and %d", dto.MaxImageN)

	tests := []struct {
		name    string
		body    string
		wantErr string
		wantN   uint
	}{
		{
			name:    "overflowed uint64 n is rejected",
			body:    `{"model":"gpt-image-1","prompt":"a cat","n":18446744073686646784}`,
			wantErr: boundErr,
		},
		{
			name:    "n above max is rejected",
			body:    fmt.Sprintf(`{"model":"gpt-image-1","prompt":"a cat","n":%d}`, dto.MaxImageN+1),
			wantErr: boundErr,
		},
		{
			name:  "n at max is accepted",
			body:  fmt.Sprintf(`{"model":"gpt-image-1","prompt":"a cat","n":%d}`, dto.MaxImageN),
			wantN: dto.MaxImageN,
		},
		{
			name:  "explicit n is accepted",
			body:  `{"model":"gpt-image-1","prompt":"a cat","n":3}`,
			wantN: 3,
		},
		{
			name:  "zero n defaults to 1",
			body:  `{"model":"gpt-image-1","prompt":"a cat","n":0}`,
			wantN: 1,
		},
		{
			name:  "absent n defaults to 1",
			body:  `{"model":"gpt-image-1","prompt":"a cat"}`,
			wantN: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newJSONContext(t, tt.body)
			req, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			if tt.wantErr != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, req.N)
			require.Equal(t, tt.wantN, *req.N)
			require.Equal(t, float64(tt.wantN), req.GetTokenCountMeta().BillingRatios["n"])
		})
	}

	t.Run("negative multipart n is rejected", func(t *testing.T) {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		require.NoError(t, writer.WriteField("prompt", "edit this image"))
		require.NoError(t, writer.WriteField("n", "-22904832"))
		require.NoError(t, writer.Close())

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())

		_, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
		require.Error(t, err)
		require.Contains(t, err.Error(), boundErr)
	})
}
