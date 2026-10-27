package common

import "strings"

// Model capability values accepted by the model type configuration.
const (
	ModelTypeText  = "text"
	ModelTypeImage = "image"
	ModelTypeVideo = "video"
)

// ModelTypeResolver returns the configured capability for a model name, or ""
// when none is configured. setting/model_setting injects it in init() because
// this package cannot import model_setting (model -> setting/model_setting ->
// common).
var ModelTypeResolver func(modelName string) string

// IsModelType reports whether value is a supported model capability.
func IsModelType(value string) bool {
	switch value {
	case ModelTypeText, ModelTypeImage, ModelTypeVideo:
		return true
	}
	return false
}

// ConfiguredModelType returns only the configured capability. It returns ""
// when nothing is configured, which lets callers keep their own name
// heuristics. An explicit configuration is authoritative, including "text".
func ConfiguredModelType(modelName string) string {
	if ModelTypeResolver == nil {
		return ""
	}
	return ModelTypeResolver(modelName)
}

// ResolveModelType prefers the configured capability and falls back to the
// legacy name heuristic when nothing is configured.
func ResolveModelType(modelName string) string {
	if modelType := ConfiguredModelType(modelName); modelType != "" {
		return modelType
	}
	if IsImageGenerationModel(modelName) {
		return ModelTypeImage
	}
	return ""
}

var (
	// OpenAIResponseOnlyModels is a list of models that are only available for OpenAI responses.
	OpenAIResponseOnlyModels = []string{
		"o3-pro",
		"o3-deep-research",
		"o4-mini-deep-research",
	}
	ImageGenerationModels = []string{
		"dall-e-3",
		"dall-e-2",
		"prefix:dall-e", // Deprecated upstream models; retained for compatible routes.
		"gpt-image-",
		"qwen-image",
		"z-image",
		"wan2.7-image-pro",
		"wan2.7-image",
		"wan2.6-image",
		"wan2.6-t2i",
		"wan2.5-t2i-preview",
		"wan2.2-t2i-flash",
		"wan2.2-t2i-plus",
		"wanx2.1-t2i-turbo",
		"wanx2.1-t2i-plus",
		"wanx2.0-t2i-turbo",
		"prefix:imagen-",
		"flux-",
		"flux.1-",
	}
)

func IsOpenAIResponseOnlyModel(modelName string) bool {
	for _, m := range OpenAIResponseOnlyModels {
		if strings.Contains(modelName, m) {
			return true
		}
	}
	return false
}

func IsImageGenerationModel(modelName string) bool {
	modelName = strings.ToLower(modelName)
	for _, m := range ImageGenerationModels {
		if prefix, ok := strings.CutPrefix(m, "prefix:"); ok {
			if strings.HasPrefix(modelName, prefix) {
				return true
			}
			continue
		}
		if strings.Contains(modelName, m) {
			return true
		}
	}
	return false
}
