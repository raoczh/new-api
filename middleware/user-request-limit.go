package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
)

// Per-user relay limits are stored in dto.UserSetting and enforced here.
// Zero means unlimited, matching the model-level rate limit settings.
const (
	userRPMWindowSeconds = int64(60)

	// A concurrency lease is refreshed while the request runs, so a crashed
	// process cannot pin a slot forever. The lease is short enough to recover
	// quickly and long enough that refresh jitter cannot expire it.
	userConcurrencyLease     = 2 * time.Minute
	userConcurrencyRefresh   = 30 * time.Second
	userConcurrencyRedisBase = redisRateLimitNamespace + ":user:concurrent"
	userRPMRedisBase         = redisRateLimitNamespace + ":user:rpm"
)

// userConcurrencyAcquireScript prunes expired leases, enforces the limit and
// registers this request in one atomic step. ARGV: now(ms), limit, stale(ms),
// member.
var userConcurrencyAcquireScript = `
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local stale = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - stale)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  return {0, count}
end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('EXPIRE', KEYS[1], math.ceil(stale / 1000))
return {1, count + 1}
`

var userConcurrencyReleaseScript = `
redis.call('ZREM', KEYS[1], ARGV[1])
if redis.call('ZCARD', KEYS[1]) == 0 then
  redis.call('DEL', KEYS[1])
end
return 1
`

var userConcurrencyRefreshScript = `
if redis.call('ZSCORE', KEYS[1], ARGV[1]) then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
  redis.call('EXPIRE', KEYS[1], math.ceil(tonumber(ARGV[3]) / 1000))
  return 1
end
return 0
`

// inMemoryUserConcurrency tracks in-flight requests per user when Redis is
// disabled. Redis keeps the counter shared across gateway instances.
var inMemoryUserConcurrency = struct {
	sync.Mutex
	active map[int]int
}{
	active: make(map[int]int),
}

// UserRequestLimit enforces the per-user concurrency and per-minute request
// limits configured in the user's settings. It must run after TokenAuth or
// UserAuth so the user ID and settings are in the context.
func UserRequestLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		userID := c.GetInt("id")
		if userID == 0 {
			c.Status(http.StatusUnauthorized)
			c.Abort()
			return
		}
		userSetting, ok := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting)
		if !ok {
			c.Next()
			return
		}
		if userSetting.RequestsPerMinute <= 0 && userSetting.MaxConcurrentRequests <= 0 {
			c.Next()
			return
		}

		if userSetting.MaxConcurrentRequests > 0 {
			release, allowed, err := acquireUserConcurrency(c, userID, userSetting.MaxConcurrentRequests)
			if err != nil {
				logger.LogError(c.Request.Context(), common.LogText("user concurrency limit check failed (user=%d): %v", userID, err))
				abortWithOpenAiMessage(c, http.StatusInternalServerError, common.TranslateMessage(c, i18n.MsgDatabaseError))
				return
			}
			if !allowed {
				c.Header("Retry-After", "1")
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitUserConcurrencyReached, map[string]any{
					"Max": userSetting.MaxConcurrentRequests,
				}))
				return
			}
			defer release()
		}
		if userSetting.RequestsPerMinute > 0 && !takeUserRPM(c, userID, userSetting.RequestsPerMinute) {
			return
		}
		c.Next()
	}
}

func takeUserRPM(c *gin.Context, userID int, limit int) bool {
	key := fmt.Sprintf("%s:%d", userRPMRedisBase, userID)
	if common.RedisEnabled {
		allowed, _, ttlSeconds, err := redisFixedWindowTake(c.Request.Context(), key, limit, userRPMWindowSeconds)
		if err != nil {
			logger.LogError(c.Request.Context(), common.LogText("user RPM limit check failed (user=%d): %v", userID, err))
			abortWithOpenAiMessage(c, http.StatusInternalServerError, common.TranslateMessage(c, i18n.MsgDatabaseError))
			return false
		}
		if !allowed {
			writeUserRPMRejection(c, userID, limit, ttlSeconds)
			return false
		}
		return true
	}

	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
	if !inMemoryRateLimiter.Request(key, limit, userRPMWindowSeconds) {
		writeUserRPMRejection(c, userID, limit, userRPMWindowSeconds)
		return false
	}
	return true
}

func writeUserRPMRejection(c *gin.Context, userID int, limit int, retryAfterSeconds int64) {
	if retryAfterSeconds > 0 {
		c.Header("Retry-After", strconv.FormatInt(retryAfterSeconds, 10))
	}
	abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitUserRPMReached, map[string]any{
		"Max": limit,
	}))
	logger.LogDebug(c, "user %d reached the per-minute request limit (%d)", userID, limit)
}

// acquireUserConcurrency reserves one concurrency slot. The returned release
// function is safe to call once; it frees the slot when the request finishes.
func acquireUserConcurrency(c *gin.Context, userID int, limit int) (func(), bool, error) {
	member := c.GetString(common.RequestIdKey)
	if member == "" {
		member = common.NewRequestId()
	}

	if common.RedisEnabled {
		key := fmt.Sprintf("%s:%d", userConcurrencyRedisBase, userID)
		allowed, err := redisAcquireUserConcurrency(c.Request.Context(), key, member, limit)
		if err != nil {
			return nil, false, err
		}
		if !allowed {
			return nil, false, nil
		}
		stopRefresh := startUserConcurrencyLeaseRefresh(c.Request.Context(), key, member)
		return func() {
			stopRefresh()
			if err := redisReleaseUserConcurrency(context.Background(), key, member); err != nil {
				logger.LogError(c.Request.Context(), common.LogText("failed to release user concurrency slot (user=%d): %v", userID, err))
			}
		}, true, nil
	}

	if !acquireInMemoryUserConcurrency(userID, limit) {
		return nil, false, nil
	}
	return func() { releaseInMemoryUserConcurrency(userID) }, true, nil
}

func redisAcquireUserConcurrency(ctx context.Context, key string, member string, limit int) (bool, error) {
	if common.RDB == nil {
		return false, errors.New("Redis client is not initialized")
	}
	now := time.Now().UnixMilli()
	stale := userConcurrencyLease.Milliseconds()
	values, err := common.RDB.Eval(ctx, userConcurrencyAcquireScript, []string{key}, now, limit, stale, member).Slice()
	if err != nil {
		return false, err
	}
	if len(values) != 2 {
		return false, fmt.Errorf("unexpected user concurrency reply length %d", len(values))
	}
	allowedValue, err := redisReplyInteger(values[0])
	if err != nil {
		return false, err
	}
	return allowedValue == 1, nil
}

func redisReleaseUserConcurrency(ctx context.Context, key string, member string) error {
	if common.RDB == nil {
		return nil
	}
	return common.RDB.Eval(ctx, userConcurrencyReleaseScript, []string{key}, member).Err()
}

// startUserConcurrencyLeaseRefresh keeps a running request's lease alive. It
// stops when the returned function is called or when Redis no longer holds the
// lease (for example after a Redis restart).
func startUserConcurrencyLeaseRefresh(ctx context.Context, key string, member string) func() {
	stop := make(chan struct{})
	var once sync.Once
	go func() {
		ticker := time.NewTicker(userConcurrencyRefresh)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				held, err := common.RDB.Eval(ctx, userConcurrencyRefreshScript, []string{key},
					member, time.Now().UnixMilli(), userConcurrencyLease.Milliseconds()).Int()
				if err != nil || held == 0 {
					return
				}
			}
		}
	}()
	return func() {
		once.Do(func() { close(stop) })
	}
}

func acquireInMemoryUserConcurrency(userID int, limit int) bool {
	inMemoryUserConcurrency.Lock()
	defer inMemoryUserConcurrency.Unlock()
	if inMemoryUserConcurrency.active[userID] >= limit {
		return false
	}
	inMemoryUserConcurrency.active[userID]++
	return true
}

func releaseInMemoryUserConcurrency(userID int) {
	inMemoryUserConcurrency.Lock()
	defer inMemoryUserConcurrency.Unlock()
	remaining := inMemoryUserConcurrency.active[userID] - 1
	if remaining <= 0 {
		delete(inMemoryUserConcurrency.active, userID)
		return
	}
	inMemoryUserConcurrency.active[userID] = remaining
}
