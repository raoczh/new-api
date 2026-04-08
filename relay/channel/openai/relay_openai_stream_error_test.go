package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOaiStreamHandler_ReturnsRetryableErrorOnFirstErrorChunk(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader("data: {\"error\":{\"message\":\"rate limit exceeded\",\"type\":\"rate_limit_error\",\"code\":429}}\n")),
	}

	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4o",
		},
	}

	usage, newAPIError := OaiStreamHandler(c, info, resp)
	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	require.Equal(t, http.StatusTooManyRequests, newAPIError.StatusCode)
	require.Contains(t, strings.ToLower(newAPIError.Error()), "rate limit")
	require.Empty(t, recorder.Body.String())
}

func TestOaiStreamHandler_ReturnsRetryableErrorAfterBufferedRoleOnlyChunk(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(
			"data: {\"id\":\"chatcmpl-1\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"gpt-4o\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"}}]}\n" +
				"data: {\"error\":{\"message\":\"rate limit exceeded\",\"type\":\"rate_limit_error\",\"code\":429}}\n",
		)),
	}

	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4o",
		},
	}

	usage, newAPIError := OaiStreamHandler(c, info, resp)
	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	require.Equal(t, http.StatusTooManyRequests, newAPIError.StatusCode)
	require.Contains(t, strings.ToLower(newAPIError.Error()), "rate limit")
	require.Empty(t, recorder.Body.String())
}
