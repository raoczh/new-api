package service

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

var channelCooldownMap sync.Map // key: "channelId:model" → value: time.Time

// MarkChannelCooldown marks a channel as in cooldown for a specific model.
func MarkChannelCooldown(channelId int, model string) {
	if common.ChannelCooldownDuration <= 0 {
		return
	}
	key := fmt.Sprintf("%d:%s", channelId, model)
	channelCooldownMap.Store(key, time.Now())
}

// ClearChannelCooldown removes a channel from cooldown for a specific model.
func ClearChannelCooldown(channelId int, model string) {
	key := fmt.Sprintf("%d:%s", channelId, model)
	channelCooldownMap.Delete(key)
}

// IsChannelInCooldown checks if a channel is currently in cooldown for a specific model.
func IsChannelInCooldown(channelId int, model string) bool {
	if common.ChannelCooldownDuration <= 0 {
		return false
	}
	key := fmt.Sprintf("%d:%s", channelId, model)
	val, ok := channelCooldownMap.Load(key)
	if !ok {
		return false
	}
	errTime := val.(time.Time)
	duration := time.Duration(common.ChannelCooldownDuration) * time.Second
	if time.Since(errTime) < duration {
		return true
	}
	// Expired, clean up
	channelCooldownMap.Delete(key)
	return false
}

// GetCooldownChannelIds returns all channel IDs that are in cooldown for a specific model.
func GetCooldownChannelIds(model string, candidateIds []int) []int {
	if common.ChannelCooldownDuration <= 0 {
		return nil
	}
	var cooldownIds []int
	for _, id := range candidateIds {
		if IsChannelInCooldown(id, model) {
			cooldownIds = append(cooldownIds, id)
		}
	}
	return cooldownIds
}

// ShouldCooldownChannel determines if an error should trigger channel cooldown.
// Only errors where switching channels might help will trigger cooldown.
func ShouldCooldownChannel(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	// Channel errors (invalid key, account disabled, etc.) - should cooldown
	if types.IsChannelError(err) {
		return true
	}
	// Skip-retry errors (bad request, auth errors) - switching channels won't help
	if types.IsSkipRetryError(err) {
		return false
	}
	code := err.StatusCode
	// Success codes - no cooldown
	if code >= 200 && code < 400 {
		return false
	}
	// Client errors that switching channels won't fix
	if code == 400 || code == 401 || code == 403 || code == 408 {
		return false
	}
	// Rate limit (429), server errors (5xx), and other errors - cooldown
	return true
}

// StartCooldownCleanup starts a background goroutine to periodically clean up expired cooldown entries.
func StartCooldownCleanup() {
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			if common.ChannelCooldownDuration <= 0 {
				continue
			}
			duration := time.Duration(common.ChannelCooldownDuration) * time.Second
			now := time.Now()
			channelCooldownMap.Range(func(key, value interface{}) bool {
				errTime := value.(time.Time)
				if now.Sub(errTime) >= duration {
					channelCooldownMap.Delete(key)
				}
				return true
			})
		}
	}()
}

// CollectCooldownChannelIds iterates the cooldown map and returns all channel IDs
// that are currently in cooldown for the given model.
func CollectCooldownChannelIds(model string) []int {
	if common.ChannelCooldownDuration <= 0 {
		return nil
	}
	duration := time.Duration(common.ChannelCooldownDuration) * time.Second
	now := time.Now()
	suffix := ":" + model
	var ids []int
	channelCooldownMap.Range(func(key, value interface{}) bool {
		k := key.(string)
		if !strings.HasSuffix(k, suffix) {
			return true
		}
		errTime := value.(time.Time)
		if now.Sub(errTime) >= duration {
			channelCooldownMap.Delete(key)
			return true
		}
		// Extract channelId from key "channelId:model"
		parts := strings.SplitN(k, ":", 2)
		if len(parts) == 2 {
			if id, err := strconv.Atoi(parts[0]); err == nil {
				ids = append(ids, id)
			}
		}
		return true
	})
	return ids
}
