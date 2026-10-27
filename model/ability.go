package model

import (
	"errors"
	"slices"
	"sort"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/samber/lo"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Ability struct {
	Group     string  `json:"group" gorm:"type:varchar(64);primaryKey;autoIncrement:false"`
	Model     string  `json:"model" gorm:"type:varchar(255);primaryKey;autoIncrement:false"`
	ChannelId int     `json:"channel_id" gorm:"primaryKey;autoIncrement:false;index"`
	Enabled   bool    `json:"enabled"`
	Priority  *int64  `json:"priority" gorm:"bigint;default:0;index"`
	Weight    uint    `json:"weight" gorm:"default:0;index"`
	Tag       *string `json:"tag" gorm:"index"`
}

type AbilityWithChannel struct {
	Ability
	ChannelType int `json:"channel_type"`
}

// AbilityWithChannelSettings extends Ability with the channel fields that
// decide whether the ability can serve chat completions.
type AbilityWithChannelSettings struct {
	Ability
	ChannelType int    `json:"channel_type"`
	Settings    string `json:"settings"`
}

// nonChatChannelTypes lists channel types that only serve media or embedding
// tasks. They must be excluded explicitly: GetEndpointTypesByChannelType still
// falls back to the generic OpenAI endpoint for most of them.
var nonChatChannelTypes = []int{
	constant.ChannelTypeMidjourney,
	constant.ChannelTypeMidjourneyPlus,
	constant.ChannelTypeSunoAPI,
	constant.ChannelTypeKling,
	constant.ChannelTypeJimeng,
	constant.ChannelTypeVidu,
	constant.ChannelTypeDoubaoVideo,
	constant.ChannelTypeSora,
	constant.ChannelTypeReplicate,
	constant.ChannelTypeTaskPlugin,
	// MokaAI only implements embeddings.
	constant.ChannelTypeMokaAI,
}

// nonChatModelKeywords lists name fragments of image, video and music models.
// Task plugin declarations cover the built-in models; these keywords also catch
// custom names and the aliases channels map onto them.
var nonChatModelKeywords = []string{
	"cogview", "embedding", "flux", "grok-imagine", "hailuo", "i2i", "i2v",
	"ideogram", "image-edit", "imageedit", "jimeng", "kf2v", "kling",
	"kolors", "midjourney", "nano-banana", "recraft", "rerank", "s2v",
	"sdxl", "seedance", "seedream", "sora", "stable-diffusion", "suno_",
	"t2i", "t2v", "tts", "veo-", "video", "vidu", "wan2", "wanx", "whisper",
}

// chatEndpointTypes are the endpoints a playground chat request can be served
// through. Image, video, rerank and embedding endpoints are intentionally
// absent.
var chatEndpointTypes = []constant.EndpointType{
	constant.EndpointTypeOpenAI,
	constant.EndpointTypeOpenAIResponse,
	constant.EndpointTypeOpenAIResponseCompact,
	constant.EndpointTypeOpenAIAlphaSearch,
	constant.EndpointTypeAnthropic,
	constant.EndpointTypeGemini,
}

func GetAllEnableAbilityWithChannels() ([]AbilityWithChannel, error) {
	var abilities []AbilityWithChannel
	err := DB.Table("abilities").
		Select("abilities.*, channels.type as channel_type").
		Joins("left join channels on abilities.channel_id = channels.id").
		Where("abilities.enabled = ?", true).
		Scan(&abilities).Error
	return abilities, err
}

func GetGroupEnabledModels(group string) []string {
	var models []string
	// Find distinct models
	DB.Table("abilities").Where(commonGroupCol+" = ? and enabled = ?", group, true).Distinct("model").Pluck("model", &models)
	return models
}

// GetGroupEnabledChatModels returns the enabled models in group that a chat
// completion request can actually reach. Unlike GetGroupEnabledModels it also
// looks at the serving channel, so media-only channels and models are dropped.
func GetGroupEnabledChatModels(group string) ([]string, error) {
	var abilities []AbilityWithChannelSettings
	err := DB.Table("abilities").
		Select("abilities.*, channels.type as channel_type, channels.settings as settings").
		Joins("left join channels on abilities.channel_id = channels.id").
		Where("abilities."+commonGroupCol+" = ? and abilities.enabled = ?", group, true).
		Scan(&abilities).Error
	if err != nil {
		return nil, err
	}

	models := make([]string, 0, len(abilities))
	seen := make(map[string]struct{}, len(abilities))
	for _, ability := range abilities {
		if _, ok := seen[ability.Model]; ok {
			continue
		}
		if !abilityServesChat(ability) {
			continue
		}
		seen[ability.Model] = struct{}{}
		models = append(models, ability.Model)
	}
	return models, nil
}

// abilityServesChat reports whether the ability can serve a chat completion.
// Unknown channels (for example an ability whose channel was deleted) fail
// closed because they cannot route anything.
func abilityServesChat(ability AbilityWithChannelSettings) bool {
	if ability.ChannelType == constant.ChannelTypeUnknown {
		return false
	}
	if slices.Contains(nonChatChannelTypes, ability.ChannelType) {
		return false
	}
	if isNonChatModelName(ability.Model) {
		return false
	}
	return slices.ContainsFunc(abilityChatEndpointTypes(ability), func(endpoint constant.EndpointType) bool {
		return slices.Contains(chatEndpointTypes, endpoint)
	})
}

// abilityChatEndpointTypes mirrors GetEndpointTypesByChannelType for advanced
// custom channels, whose routes live in the channel settings. It reads the raw
// settings column on purpose: Channel.GetOtherSettings writes back to the
// database when the settings are malformed, which a list query must not do.
func abilityChatEndpointTypes(ability AbilityWithChannelSettings) []constant.EndpointType {
	if !constant.IsAdvancedCustomChannel(ability.ChannelType) {
		return common.GetEndpointTypesByChannelType(ability.ChannelType, ability.Model)
	}

	settings := kitdto.ChannelOtherSettings{}
	if ability.Settings != "" {
		if err := common.UnmarshalJsonStr(ability.Settings, &settings); err != nil {
			common.SysLog(common.LogText("failed to parse settings for channel %d: %s", ability.ChannelId, err.Error()))
			settings = kitdto.ChannelOtherSettings{}
		}
	}
	if preset := common.GetAdvancedCustomPreset(ability.ChannelType); preset != nil {
		settings.AdvancedCustom = preset
	}
	if settings.AdvancedCustom == nil {
		// No routes means no known way in; do not fall back to the generic
		// OpenAI endpoint, which would mark every model as chat-capable.
		return nil
	}
	return settings.AdvancedCustom.SupportedEndpointTypesForModel(ability.Model)
}

// isNonChatModelName reports whether the model name belongs to image, video,
// audio or embedding families, or is declared by a task plugin. A configured
// model type is authoritative: "text" overrides the name heuristics, while
// "image" and "video" are non-chat regardless of what the name looks like.
func isNonChatModelName(modelName string) bool {
	if modelType := common.ConfiguredModelType(modelName); modelType != "" {
		return modelType != common.ModelTypeText
	}
	if common.IsImageGenerationModel(modelName) {
		return true
	}
	lower := strings.ToLower(modelName)
	if slices.ContainsFunc(nonChatModelKeywords, func(keyword string) bool {
		return strings.Contains(lower, keyword)
	}) {
		return true
	}
	_, taskModel := jsplugin.DefaultRegistry.Generation().GetByModel(modelName)
	return taskModel
}

func GetEnabledModels() []string {
	var models []string
	// Find distinct models
	DB.Table("abilities").Where("enabled = ?", true).Distinct("model").Pluck("model", &models)
	return models
}

func GetAllEnableAbilities() []Ability {
	var abilities []Ability
	DB.Find(&abilities, "enabled = ?", true)
	return abilities
}

func getPriority(group string, model string, retry int) (int, error) {

	var priorities []int
	err := DB.Model(&Ability{}).
		Select("DISTINCT(priority)").
		Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, model, true).
		Order("priority DESC").              // 按优先级降序排序
		Pluck("priority", &priorities).Error // Pluck用于将查询的结果直接扫描到一个切片中

	if err != nil {
		// 处理错误
		return 0, err
	}

	if len(priorities) == 0 {
		// 如果没有查询到优先级，则返回错误
		return 0, errors.New("database consistency is broken")
	}

	// 确定要使用的优先级
	var priorityToUse int
	if retry >= len(priorities) {
		// 如果重试次数大于优先级数，则使用最小的优先级
		priorityToUse = priorities[len(priorities)-1]
	} else {
		priorityToUse = priorities[retry]
	}
	return priorityToUse, nil
}

func getChannelQuery(group string, model string, retry int) (*gorm.DB, error) {
	maxPrioritySubQuery := DB.Model(&Ability{}).Select("MAX(priority)").Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, model, true)
	channelQuery := DB.Where(commonGroupCol+" = ? and model = ? and enabled = ? and priority = (?)", group, model, true, maxPrioritySubQuery)
	if retry != 0 {
		priority, err := getPriority(group, model, retry)
		if err != nil {
			return nil, err
		} else {
			channelQuery = DB.Where(commonGroupCol+" = ? and model = ? and enabled = ? and priority = ?", group, model, true, priority)
		}
	}

	return channelQuery, nil
}

func GetChannel(
	group string,
	model string,
	retry int,
	filters []dto.ChannelFilter,
) (*Channel, error) {
	var abilities []Ability
	err := DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, model, true).Order("priority DESC, weight DESC").Find(&abilities).Error
	if err != nil {
		return nil, err
	}
	abilities = filterAbilitiesByConstraints(abilities, model, filters)
	// Like the memory cache, retry with the routing name (for example without
	// @ modifiers) when no channel serves the exact name.
	if normalized := ratio_setting.RoutingMatchModelName(model); len(abilities) == 0 && normalized != "" && normalized != model {
		err = DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, normalized, true).Order("priority DESC, weight DESC").Find(&abilities).Error
		if err != nil {
			return nil, err
		}
		abilities = filterAbilitiesByConstraints(abilities, model, filters)
	}
	if len(abilities) > 0 {
		priorities := make([]int64, 0)
		seen := make(map[int64]bool)
		for _, ability := range abilities {
			priority := int64(0)
			if ability.Priority != nil {
				priority = *ability.Priority
			}
			if !seen[priority] {
				seen[priority] = true
				priorities = append(priorities, priority)
			}
		}
		sort.Slice(priorities, func(i, j int) bool { return priorities[i] > priorities[j] })
		if retry >= len(priorities) {
			retry = len(priorities) - 1
		}
		targetPriority := priorities[retry]
		abilities = lo.Filter(abilities, func(ability Ability, _ int) bool {
			return ability.Priority == nil && targetPriority == 0 || ability.Priority != nil && *ability.Priority == targetPriority
		})
	}
	channel := Channel{}
	if len(abilities) > 0 {
		// Randomly choose one
		weightSum := uint(0)
		for _, ability_ := range abilities {
			weightSum += ability_.Weight + 10
		}
		// Randomly choose one
		weight := common.GetRandomInt(int(weightSum))
		for _, ability_ := range abilities {
			weight -= int(ability_.Weight) + 10
			//log.Printf("weight: %d, ability weight: %d", weight, *ability_.Weight)
			if weight <= 0 {
				channel.Id = ability_.ChannelId
				break
			}
		}
	} else {
		return nil, nil
	}
	err = DB.First(&channel, "id = ?", channel.Id).Error
	return &channel, err
}

// filterAbilitiesByConstraints applies the same ChannelSatisfiesFilters
// predicate used by the memory-cache path. A failed channel lookup fails
// closed when a task-plugin identity is required and fails open otherwise.
func filterAbilitiesByConstraints(abilities []Ability, modelName string, filters []dto.ChannelFilter) []Ability {
	if len(abilities) == 0 {
		return nil
	}

	channelIds := make([]int, 0, len(abilities))
	seen := make(map[int]struct{}, len(abilities))
	for _, ability := range abilities {
		if _, ok := seen[ability.ChannelId]; ok {
			continue
		}
		seen[ability.ChannelId] = struct{}{}
		channelIds = append(channelIds, ability.ChannelId)
	}

	var channels []*Channel
	if err := DB.Where("id IN ?", channelIds).Find(&channels).Error; err != nil {
		if identityFilterRequiresKey(filters) {
			return nil
		}
		return abilities
	}

	channelsByID := make(map[int]*Channel, len(channels))
	for _, channel := range channels {
		channelsByID[channel.Id] = channel
	}

	filtered := make([]Ability, 0, len(abilities))
	for _, ability := range abilities {
		channel := channelsByID[ability.ChannelId]
		if ok, _ := ChannelSatisfiesFilters(channel, modelName, filters); ok {
			filtered = append(filtered, ability)
		}
	}
	return filtered
}

func identityFilterRequiresKey(filters []dto.ChannelFilter) bool {
	for _, filter := range filters {
		if filter.Kind == dto.FilterTaskPluginIdentity && filter.TaskPluginKey != "" {
			return true
		}
	}
	return false
}

func (channel *Channel) AddAbilities(tx *gorm.DB) error {
	models_ := strings.Split(channel.Models, ",")
	groups_ := strings.Split(channel.Group, ",")
	abilitySet := make(map[string]struct{})
	abilities := make([]Ability, 0, len(models_))
	for _, model := range models_ {
		for _, group := range groups_ {
			key := group + "|" + model
			if _, exists := abilitySet[key]; exists {
				continue
			}
			abilitySet[key] = struct{}{}
			ability := Ability{
				Group:     group,
				Model:     model,
				ChannelId: channel.Id,
				Enabled:   channel.Status == common.ChannelStatusEnabled,
				Priority:  channel.Priority,
				Weight:    uint(channel.GetWeight()),
				Tag:       channel.Tag,
			}
			abilities = append(abilities, ability)
		}
	}
	if len(abilities) == 0 {
		return nil
	}
	// choose DB or provided tx
	useDB := DB
	if tx != nil {
		useDB = tx
	}
	for _, chunk := range lo.Chunk(abilities, 50) {
		err := useDB.Clauses(clause.OnConflict{DoNothing: true}).Create(&chunk).Error
		if err != nil {
			return err
		}
	}
	return nil
}

func (channel *Channel) DeleteAbilities() error {
	return DB.Where("channel_id = ?", channel.Id).Delete(&Ability{}).Error
}

// UpdateAbilities updates abilities of this channel.
// Make sure the channel is completed before calling this function.
func (channel *Channel) UpdateAbilities(tx *gorm.DB) error {
	isNewTx := false
	// 如果没有传入事务，创建新的事务
	if tx == nil {
		tx = DB.Begin()
		if tx.Error != nil {
			return tx.Error
		}
		isNewTx = true
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()
	}

	// First delete all abilities of this channel
	err := tx.Where("channel_id = ?", channel.Id).Delete(&Ability{}).Error
	if err != nil {
		if isNewTx {
			tx.Rollback()
		}
		return err
	}

	// Then add new abilities
	models_ := channel.GetModels()
	groups_ := strings.Split(channel.Group, ",")
	abilitySet := make(map[string]struct{})
	abilities := make([]Ability, 0, len(models_))
	for _, model := range models_ {
		for _, group := range groups_ {
			key := group + "|" + model
			if _, exists := abilitySet[key]; exists {
				continue
			}
			abilitySet[key] = struct{}{}
			ability := Ability{
				Group:     group,
				Model:     model,
				ChannelId: channel.Id,
				Enabled:   channel.Status == common.ChannelStatusEnabled,
				Priority:  channel.Priority,
				Weight:    uint(channel.GetWeight()),
				Tag:       channel.Tag,
			}
			abilities = append(abilities, ability)
		}
	}

	if len(abilities) > 0 {
		for _, chunk := range lo.Chunk(abilities, 50) {
			err = tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&chunk).Error
			if err != nil {
				if isNewTx {
					tx.Rollback()
				}
				return err
			}
		}
	}

	// 如果是新创建的事务，需要提交
	if isNewTx {
		return tx.Commit().Error
	}

	return nil
}

func UpdateAbilityStatus(channelId int, status bool) error {
	return DB.Model(&Ability{}).Where("channel_id = ?", channelId).Select("enabled").Update("enabled", status).Error
}

func UpdateAbilityStatusByTag(tag string, status bool) error {
	return DB.Model(&Ability{}).Where("tag = ?", tag).Select("enabled").Update("enabled", status).Error
}

func UpdateAbilityByTag(tag string, newTag *string, priority *int64, weight *uint) error {
	ability := Ability{}
	if newTag != nil {
		ability.Tag = newTag
	}
	if priority != nil {
		ability.Priority = priority
	}
	if weight != nil {
		ability.Weight = *weight
	}
	return DB.Model(&Ability{}).Where("tag = ?", tag).Updates(ability).Error
}

var fixLock = sync.Mutex{}

func FixAbility() (int, int, error) {
	lock := fixLock.TryLock()
	if !lock {
		return 0, 0, common.NewMessage("A repair task is already running. Please try again later")
	}
	defer fixLock.Unlock()

	// truncate abilities table
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		err := DB.Exec("DELETE FROM abilities").Error
		if err != nil {
			common.SysLog(common.LogText("Delete abilities failed: %s", err.Error()))
			return 0, 0, err
		}
	} else {
		err := DB.Exec("TRUNCATE TABLE abilities").Error
		if err != nil {
			common.SysLog(common.LogText("Truncate abilities failed: %s", err.Error()))
			return 0, 0, err
		}
	}
	var channels []*Channel
	// Find all channels
	err := DB.Model(&Channel{}).Find(&channels).Error
	if err != nil {
		return 0, 0, err
	}
	if len(channels) == 0 {
		return 0, 0, nil
	}
	successCount := 0
	failCount := 0
	for _, chunk := range lo.Chunk(channels, 50) {
		ids := lo.Map(chunk, func(c *Channel, _ int) int { return c.Id })
		// Delete all abilities of this channel
		err = DB.Where("channel_id IN ?", ids).Delete(&Ability{}).Error
		if err != nil {
			common.SysLog(common.LogText("Delete abilities failed: %s", err.Error()))
			failCount += len(chunk)
			continue
		}
		// Then add new abilities
		for _, channel := range chunk {
			err = channel.AddAbilities(nil)
			if err != nil {
				common.SysLog(common.LogText("Add abilities for channel %d failed: %s", channel.Id, err.Error()))
				failCount++
			} else {
				successCount++
			}
		}
	}
	InitChannelCache()
	return successCount, failCount, nil
}
