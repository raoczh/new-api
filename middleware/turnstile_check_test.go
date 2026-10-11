package middleware

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type turnstileTestTransport func(*http.Request) (*http.Response, error)

func (f turnstileTestTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func TestTurnstileVerificationRejectsFailuresAndBoundsRequests(t *testing.T) {
	previousClient := turnstileHTTPClient
	previousEnabled := common.TurnstileCheckEnabled
	previousSecret := common.TurnstileSecretKey
	common.TurnstileCheckEnabled = true
	common.TurnstileSecretKey = "test-secret"
	t.Cleanup(func() {
		turnstileHTTPClient = previousClient
		common.TurnstileCheckEnabled = previousEnabled
		common.TurnstileSecretKey = previousSecret
	})

	for _, tc := range []struct {
		name    string
		body    string
		status  int
		stall   bool
		cancel  bool
		missing bool
		allowed bool
		message string
	}{
		{name: "valid token", body: `{"success":true}`, status: http.StatusOK, allowed: true},
		{name: "expired or replayed token", body: `{"success":false,"error-codes":["timeout-or-duplicate"]}`, status: http.StatusOK, message: "Turnstile 校验失败"},
		{name: "invalid secret", body: `{"success":false,"error-codes":["invalid-input-secret"]}`, status: http.StatusOK, message: "Turnstile 校验失败"},
		{name: "upstream HTTP failure", body: `{"success":true}`, status: http.StatusServiceUnavailable, message: "HTTP 503"},
		{name: "malformed response", body: `invalid`, status: http.StatusOK, message: "invalid"},
		{name: "stalled siteverify", stall: true, message: "Turnstile siteverify request failed"},
		{name: "canceled request", stall: true, cancel: true, message: "context canceled"},
		{name: "missing token", missing: true, message: "Turnstile token 为空"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			turnstileHTTPClient = &http.Client{
				Timeout: 100 * time.Millisecond,
				Transport: turnstileTestTransport(func(request *http.Request) (*http.Response, error) {
					calls++
					require.NoError(t, request.ParseForm())
					assert.Equal(t, "test-secret", request.Form.Get("secret"))
					assert.Equal(t, "test-token", request.Form.Get("response"))
					assert.Equal(t, "192.0.2.10", request.Form.Get("remoteip"))
					if tc.stall {
						<-request.Context().Done()
						return nil, request.Context().Err()
					}
					return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body)), Header: make(http.Header)}, nil
				}),
			}
			reachedHandler := false
			router := gin.New()
			require.NoError(t, router.SetTrustedProxies(nil))
			router.GET("/verification", TurnstileCheck(), func(c *gin.Context) {
				reachedHandler = true
				c.Status(http.StatusNoContent)
			})
			path := "/verification?turnstile=test-token"
			if tc.missing {
				path = "/verification"
			}
			request := httptest.NewRequest(http.MethodGet, path, nil)
			request.RemoteAddr = "192.0.2.10:1234"
			if tc.cancel {
				ctx, cancel := context.WithCancel(request.Context())
				cancel()
				request = request.WithContext(ctx)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			assert.Equal(t, tc.allowed, reachedHandler)
			if tc.allowed {
				assert.Equal(t, http.StatusNoContent, response.Code)
			} else {
				assert.Equal(t, http.StatusOK, response.Code)
				assert.Contains(t, response.Body.String(), tc.message)
				assert.Contains(t, response.Body.String(), `"success":false`)
			}
			if tc.missing {
				assert.Zero(t, calls)
			} else {
				assert.Equal(t, 1, calls, "single-use tokens must not be retried automatically")
			}
		})
	}
}

func TestAccessLoggerRedactsTurnstileTokenWithoutChangingRequest(t *testing.T) {
	previousWriter := gin.DefaultWriter
	var output bytes.Buffer
	gin.DefaultWriter = &output
	t.Cleanup(func() { gin.DefaultWriter = previousWriter })
	router := gin.New()
	SetUpLogger(router)
	router.GET("/api/verification", func(c *gin.Context) {
		assert.Equal(t, "private-token", c.Query("turnstile"))
		assert.Equal(t, "receiver@example.com", c.Query("email"))
		c.Status(http.StatusNoContent)
	})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/verification?email=receiver@example.com&turnstile=private-token", nil))
	assert.Equal(t, http.StatusNoContent, response.Code)
	assert.Contains(t, output.String(), "/api/verification")
	assert.NotContains(t, output.String(), "private-token")
}
