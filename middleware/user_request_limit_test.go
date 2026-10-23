package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useMemoryUserLimitBackend(t *testing.T) {
	t.Helper()
	previousEnabled, previousClient := common.RedisEnabled, common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	t.Cleanup(func() {
		common.RedisEnabled = previousEnabled
		common.RDB = previousClient
	})
}

func newUserRequestLimitRouter(t *testing.T, userID int, setting dto.UserSetting, handler gin.HandlerFunc) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/", func(c *gin.Context) {
		c.Set("id", userID)
		c.Set(common.RequestIdKey, "user-limit-test")
		common.SetContextKey(c, constant.ContextKeyUserSetting, setting)
	}, UserRequestLimit(), func(c *gin.Context) {
		if handler != nil {
			handler(c)
			return
		}
		c.Status(http.StatusNoContent)
	})
	return router
}

func TestUserRequestLimitRPMRejectsBeforeHandler(t *testing.T) {
	require.NoError(t, i18n.Init())
	useMemoryUserLimitBackend(t)
	userID := 7300001 + int(modelRateLimitTestUsers.Add(1))
	router := newUserRequestLimitRouter(t, userID, dto.UserSetting{RequestsPerMinute: 2}, nil)

	assert.Equal(t, http.StatusNoContent, performRateLimitRequest(router, "/", "127.0.0.1:1000").Code)
	assert.Equal(t, http.StatusNoContent, performRateLimitRequest(router, "/", "127.0.0.1:1000").Code)
	limited := performRateLimitRequest(router, "/", "127.0.0.1:1000")
	assert.Equal(t, http.StatusTooManyRequests, limited.Code)
	assert.NotEmpty(t, limited.Header().Get("Retry-After"))
}

func TestUserRequestLimitConcurrencyReleasesAfterRequest(t *testing.T) {
	require.NoError(t, i18n.Init())
	useMemoryUserLimitBackend(t)
	userID := 7300002 + int(modelRateLimitTestUsers.Add(1))
	entered, release, finished := make(chan struct{}, 1), make(chan struct{}), make(chan struct{})
	router := newUserRequestLimitRouter(t, userID, dto.UserSetting{MaxConcurrentRequests: 1}, func(c *gin.Context) {
		select {
		case entered <- struct{}{}:
		default:
		}
		<-release
		c.Status(http.StatusNoContent)
	})

	go func() {
		defer close(finished)
		assert.Equal(t, http.StatusNoContent, performRateLimitRequest(router, "/", "127.0.0.1:1000").Code)
	}()
	<-entered
	assert.Equal(t, http.StatusTooManyRequests, performRateLimitRequest(router, "/", "127.0.0.1:1000").Code)
	close(release)
	<-finished
	assert.Equal(t, http.StatusNoContent, performRateLimitRequest(router, "/", "127.0.0.1:1000").Code)
}

func TestUserRequestLimitZeroDisablesBothLimits(t *testing.T) {
	require.NoError(t, i18n.Init())
	useMemoryUserLimitBackend(t)
	userID := 7300003 + int(modelRateLimitTestUsers.Add(1))
	router := newUserRequestLimitRouter(t, userID, dto.UserSetting{}, nil)
	for range 5 {
		assert.Equal(t, http.StatusNoContent, performRateLimitRequest(router, "/", "127.0.0.1:1000").Code)
	}
}

func TestRedisUserConcurrencySharesSlotsAcrossInstances(t *testing.T) {
	require.NoError(t, i18n.Init())
	useRateLimitMiniRedis(t)
	ctx := context.Background()
	key := "rateLimit:v2:user:concurrent:42"

	allowed, err := redisAcquireUserConcurrency(ctx, key, "req-1", 1)
	require.NoError(t, err)
	assert.True(t, allowed)

	allowed, err = redisAcquireUserConcurrency(ctx, key, "req-2", 1)
	require.NoError(t, err)
	assert.False(t, allowed, "a second instance must see the slot taken")

	require.NoError(t, redisReleaseUserConcurrency(ctx, key, "req-1"))
	allowed, err = redisAcquireUserConcurrency(ctx, key, "req-2", 1)
	require.NoError(t, err)
	assert.True(t, allowed, "a released lease must free the slot")
}

func TestUserRequestLimitExpiredRedisLeaseIsReclaimed(t *testing.T) {
	require.NoError(t, i18n.Init())
	_, redisClient := useRateLimitMiniRedis(t)
	ctx := context.Background()
	key := "rateLimit:v2:user:concurrent:43"

	allowed, err := redisAcquireUserConcurrency(ctx, key, "crashed-request", 1)
	require.NoError(t, err)
	require.True(t, allowed)

	// Simulate a lease left behind by a crashed instance: the score is older
	// than the stale window, so the next acquire prunes it.
	staleScore := time.Now().Add(-userConcurrencyLease - time.Second).UnixMilli()
	require.NoError(t, redisClient.ZAdd(ctx, key, &redis.Z{Score: float64(staleScore), Member: "crashed-request"}).Err())

	allowed, err = redisAcquireUserConcurrency(ctx, key, "new-request", 1)
	require.NoError(t, err)
	assert.True(t, allowed, "a crashed request's expired lease must not pin the slot")
}

func TestUserRequestLimitRequiresAuthenticatedUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/", UserRequestLimit(), func(c *gin.Context) { c.Status(http.StatusNoContent) })

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	router.ServeHTTP(recorder, request)
	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
}
