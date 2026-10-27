package model_setting

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type ChatCompletionsToResponsesPolicy struct {
	Enabled       bool     `json:"enabled"`
	AllChannels   bool     `json:"all_channels"`
	ChannelIDs    []int    `json:"channel_ids,omitempty"`
	ChannelTypes  []int    `json:"channel_types,omitempty"`
	ModelPatterns []string `json:"model_patterns,omitempty"`
}

func (p ChatCompletionsToResponsesPolicy) IsChannelEnabled(channelID int, channelType int) bool {
	if !p.Enabled {
		return false
	}
	if p.AllChannels {
		return true
	}

	if channelID > 0 && len(p.ChannelIDs) > 0 && slices.Contains(p.ChannelIDs, channelID) {
		return true
	}
	if channelType > 0 && len(p.ChannelTypes) > 0 && slices.Contains(p.ChannelTypes, channelType) {
		return true
	}
	return false
}

type GlobalSettings struct {
	PassThroughRequestEnabled bool     `json:"pass_through_request_enabled"`
	ThinkingModelBlacklist    []string `json:"thinking_model_blacklist"`
	// EffortTailModelIDs lists real model IDs that sit inside the GPT/o-series
	// family whitelist but whose names already end in an effort word.
	EffortTailModelIDs               []string                         `json:"effort_tail_model_ids"`
	ChatCompletionsToResponsesPolicy ChatCompletionsToResponsesPolicy `json:"chat_completions_to_responses_policy"`
	// ModelTypes maps a model name (or a wildcard pattern) to its capability:
	// text, image or video. Capability decisions read this before falling back
	// to name heuristics. The json tag must stay bare: configToMap uses it
	// verbatim as the persisted option key.
	ModelTypes map[string]string `json:"model_types"`
}

// 默认配置
var defaultOpenaiSettings = GlobalSettings{
	PassThroughRequestEnabled: false,
	ThinkingModelBlacklist: []string{
		"moonshotai/kimi-k2-thinking",
		"kimi-k2-thinking",
	},
	EffortTailModelIDs: []string{
		"gpt-5.1-codex-max",
		"qwen-image-edit-max",
		"qwen-max",
		"stable-diffusion-3-medium",
		"yi-medium",
	},
	ChatCompletionsToResponsesPolicy: ChatCompletionsToResponsesPolicy{
		Enabled:     false,
		AllChannels: true,
	},
	// Only native image models whose names the built-in heuristics miss are
	// listed. Naming a plain text model here (for example
	// gemini-2.0-flash-exp, which can also emit images from chat) would hide
	// it from the chat model pickers.
	ModelTypes: map[string]string{
		"*nano-banana*": common.ModelTypeImage,
		"*-image":       common.ModelTypeImage,
	},
}

// 全局实例
var globalSettings = defaultOpenaiSettings

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("global", &globalSettings)
	// common cannot import this package (model -> setting/model_setting ->
	// common), so it reads model types through this injected resolver.
	common.ModelTypeResolver = GetModelType
}

func GetGlobalSettings() *GlobalSettings {
	return &globalSettings
}

const thinkingBlacklistRegexPrefix = "re:"

type thinkingBlacklistCompiled struct {
	source  string
	exact   []string
	regexes []*regexp.Regexp
}

var (
	thinkingBlacklistMu    sync.RWMutex
	thinkingBlacklistCache thinkingBlacklistCompiled
)

func thinkingBlacklistSourceKey(entries []string) string {
	return strings.Join(entries, "\x00")
}

func compiledThinkingBlacklist() ([]string, []*regexp.Regexp) {
	entries := globalSettings.ThinkingModelBlacklist
	key := thinkingBlacklistSourceKey(entries)

	thinkingBlacklistMu.RLock()
	if thinkingBlacklistCache.source == key {
		exact, regexes := thinkingBlacklistCache.exact, thinkingBlacklistCache.regexes
		thinkingBlacklistMu.RUnlock()
		return exact, regexes
	}
	thinkingBlacklistMu.RUnlock()

	thinkingBlacklistMu.Lock()
	defer thinkingBlacklistMu.Unlock()
	if thinkingBlacklistCache.source == key {
		return thinkingBlacklistCache.exact, thinkingBlacklistCache.regexes
	}

	exact := make([]string, 0, len(entries))
	var regexes []*regexp.Regexp
	for _, entry := range entries {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if after, ok := strings.CutPrefix(entry, thinkingBlacklistRegexPrefix); ok {
			pattern := after
			if pattern == "" {
				common.SysError(common.LogText("invalid thinking_model_blacklist regex %q: pattern is empty", entry))
				continue
			}
			re, err := regexp.Compile(pattern)
			if err != nil {
				common.SysError(common.LogText("invalid thinking_model_blacklist regex %q: %v", entry, err))
				continue
			}
			regexes = append(regexes, re)
			continue
		}
		exact = append(exact, entry)
	}
	thinkingBlacklistCache = thinkingBlacklistCompiled{source: key, exact: exact, regexes: regexes}
	return exact, regexes
}

// ShouldPreserveThinkingSuffix reports whether the full model name is exempt
// from host thinking-suffix and @-modifier parsing. Exact blacklist entries
// match the complete name; entries prefixed with re: are Go regular expressions
// matched with MatchString against the same full name.
func ShouldPreserveThinkingSuffix(modelName string) bool {
	target := strings.TrimSpace(modelName)
	if target == "" {
		return false
	}

	exact, regexes := compiledThinkingBlacklist()
	if slices.Contains(exact, target) {
		return true
	}
	for _, re := range regexes {
		if re.MatchString(target) {
			return true
		}
	}
	return false
}

// ShouldPreserveEffortTail reports whether modelName is a real model ID whose
// name already ends in an effort word. Entries match the complete name and the
// de-namespaced bare name.
func ShouldPreserveEffortTail(modelName string) bool {
	target := strings.TrimSpace(modelName)
	if target == "" {
		return false
	}
	bare := target
	if slash := strings.LastIndex(target, "/"); slash >= 0 {
		bare = target[slash+1:]
	}

	for _, entry := range globalSettings.EffortTailModelIDs {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if entry == target || entry == bare {
			return true
		}
	}
	return false
}

// modelTypePatternMaxEntries bounds the configured table so one save cannot
// make every capability lookup scan an unbounded list.
const modelTypePatternMaxEntries = 2000

type modelTypeEntry struct {
	pattern *regexp.Regexp
	// literals counts the non-wildcard characters; longer patterns win so a
	// specific rule beats a broad one ("gemini-3-pro-image" over "*-image").
	literals  int
	modelType string
}

type compiledModelTypes struct {
	source  string
	exact   map[string]string
	regexes []modelTypeEntry
}

var (
	modelTypesMu    sync.RWMutex
	modelTypesCache compiledModelTypes
)

func modelTypesSourceKey(entries map[string]string) string {
	keys := make([]string, 0, len(entries))
	for key := range entries {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	var builder strings.Builder
	for _, key := range keys {
		builder.WriteString(key)
		builder.WriteByte('\x00')
		builder.WriteString(entries[key])
		builder.WriteByte('\x01')
	}
	return builder.String()
}

// compileModelTypePattern turns a configured wildcard into an anchored
// regexp. "*" matches any run of characters and matching is by containment
// (implicit leading and trailing "*"), so "*-image" hits
// "gemini-3-pro-image-preview" and "gemini-*" hits "gemini-3-pro-image". An
// entry without "*" never reaches this function; it is matched exactly.
func compileModelTypePattern(pattern string) (*regexp.Regexp, int, error) {
	var builder strings.Builder
	builder.WriteString("(?i).*")
	literals := 0
	for index, segment := range strings.Split(pattern, "*") {
		if index > 0 {
			builder.WriteString(".*")
		}
		literals += len(segment)
		builder.WriteString(regexp.QuoteMeta(segment))
	}
	builder.WriteString(".*")
	if literals == 0 {
		return nil, 0, fmt.Errorf("pattern %q has no literal characters", pattern)
	}
	compiled, err := regexp.Compile(builder.String())
	return compiled, literals, err
}

func compiledModelTypeTable() (map[string]string, []modelTypeEntry) {
	entries := globalSettings.ModelTypes
	key := modelTypesSourceKey(entries)

	modelTypesMu.RLock()
	if modelTypesCache.source == key {
		exact, regexes := modelTypesCache.exact, modelTypesCache.regexes
		modelTypesMu.RUnlock()
		return exact, regexes
	}
	modelTypesMu.RUnlock()

	modelTypesMu.Lock()
	defer modelTypesMu.Unlock()
	if modelTypesCache.source == key {
		return modelTypesCache.exact, modelTypesCache.regexes
	}

	exact := make(map[string]string, len(entries))
	regexes := make([]modelTypeEntry, 0, len(entries))
	for rawPattern, rawType := range entries {
		pattern := strings.TrimSpace(rawPattern)
		modelType := strings.TrimSpace(rawType)
		if pattern == "" || !common.IsModelType(modelType) {
			continue
		}
		if !strings.Contains(pattern, "*") {
			exact[strings.ToLower(pattern)] = modelType
			continue
		}
		compiled, literals, err := compileModelTypePattern(pattern)
		if err != nil {
			common.SysError(common.LogText("invalid model_types pattern %q: %v", pattern, err))
			continue
		}
		regexes = append(regexes, modelTypeEntry{pattern: compiled, literals: literals, modelType: modelType})
	}
	slices.SortStableFunc(regexes, func(a, b modelTypeEntry) int {
		return b.literals - a.literals
	})
	modelTypesCache = compiledModelTypes{source: key, exact: exact, regexes: regexes}
	return exact, regexes
}

// GetModelType returns the configured capability for modelName: text, image or
// video. It returns "" when no configured entry matches, which lets callers
// fall back to their own name heuristics. Exact entries win over wildcards, and
// longer wildcards win over shorter ones.
func GetModelType(modelName string) string {
	target := strings.ToLower(strings.TrimSpace(modelName))
	if target == "" {
		return ""
	}
	exact, regexes := compiledModelTypeTable()
	if modelType, ok := exact[target]; ok {
		return modelType
	}
	for _, entry := range regexes {
		if entry.pattern.MatchString(target) {
			return entry.modelType
		}
	}
	return ""
}

// IsImageModel reports whether modelName is configured as an image model.
func IsImageModel(modelName string) bool {
	return GetModelType(modelName) == common.ModelTypeImage
}

// IsVideoModel reports whether modelName is configured as a video model.
func IsVideoModel(modelName string) bool {
	return GetModelType(modelName) == common.ModelTypeVideo
}

// ValidateModelTypes checks the JSON object persisted under global.model_types.
func ValidateModelTypes(value string) error {
	var modelTypes map[string]string
	if err := common.UnmarshalJsonStr(value, &modelTypes); err != nil {
		return fmt.Errorf("model types must be a JSON object mapping model names to types: %w", err)
	}
	if modelTypes == nil {
		return fmt.Errorf("model types must be a JSON object mapping model names to types")
	}
	if len(modelTypes) > modelTypePatternMaxEntries {
		return fmt.Errorf("model types cannot exceed %d entries", modelTypePatternMaxEntries)
	}
	for pattern, modelType := range modelTypes {
		if strings.TrimSpace(pattern) == "" {
			return fmt.Errorf("model types cannot contain an empty model name")
		}
		if !common.IsModelType(strings.TrimSpace(modelType)) {
			return fmt.Errorf("invalid model type %q for %q: expected %s, %s or %s",
				modelType, pattern, common.ModelTypeText, common.ModelTypeImage, common.ModelTypeVideo)
		}
		if strings.Contains(pattern, "*") {
			if _, _, err := compileModelTypePattern(pattern); err != nil {
				return fmt.Errorf("invalid model type pattern %q: %w", pattern, err)
			}
		}
	}
	return nil
}
