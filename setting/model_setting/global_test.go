package model_setting

import (
	"bytes"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func withModelTypes(t *testing.T, modelTypes map[string]string) {
	t.Helper()
	settings := GetGlobalSettings()
	original := settings.ModelTypes
	t.Cleanup(func() { settings.ModelTypes = original })
	settings.ModelTypes = modelTypes
}

func TestGetModelTypeMatchesExactBeforeWildcard(t *testing.T) {
	withModelTypes(t, map[string]string{
		"*-image":                    "image",
		"gemini-3-pro-image-preview": "image",
		"gemini-2.0-flash-exp":       "text",
		"*nano-banana*":              "image",
		"veo-3":                      "video",
	})

	assert.Equal(t, "image", GetModelType("gemini-3-pro-image-preview"))
	// The exact text entry must win over the broader wildcard match.
	assert.Equal(t, "text", GetModelType("gemini-2.0-flash-exp"))
	// Implicit containment: a leading wildcard matches an infix.
	assert.Equal(t, "image", GetModelType("vendor-gemini-2.5-flash-image"))
	assert.Equal(t, "image", GetModelType("gemini-nano-banana-preview"))
	assert.Equal(t, "video", GetModelType("veo-3"))
	assert.Equal(t, "", GetModelType("gpt-4o"))
	assert.Equal(t, "", GetModelType("   "))
}

func TestGetModelTypeIsCaseInsensitive(t *testing.T) {
	withModelTypes(t, map[string]string{
		"Gemini-3-Pro-Image": "image",
		"*-VIDEO-*":          "video",
	})

	assert.Equal(t, "image", GetModelType("gemini-3-pro-image"))
	assert.Equal(t, "video", GetModelType("sora-video-gen"))
}

func TestGetModelTypePrefersLongerWildcard(t *testing.T) {
	withModelTypes(t, map[string]string{
		"*image*":     "image",
		"*pro-image*": "text",
	})

	assert.Equal(t, "text", GetModelType("gemini-3-pro-image-preview"))
	assert.Equal(t, "image", GetModelType("flux-image-gen"))
}

func TestIsImageModelAndIsVideoModel(t *testing.T) {
	withModelTypes(t, map[string]string{
		"*-image": "image",
		"veo-3":   "video",
		"gpt-4o":  "text",
	})

	assert.True(t, IsImageModel("gemini-3-pro-image"))
	assert.False(t, IsImageModel("gpt-4o"))
	assert.True(t, IsVideoModel("veo-3"))
	assert.False(t, IsVideoModel("gemini-3-pro-image"))
}

func TestValidateModelTypes(t *testing.T) {
	require.NoError(t, ValidateModelTypes(`{}`))
	require.NoError(t, ValidateModelTypes(`{"*-image":"image","veo-3":"video","gpt-4o":"text"}`))
	require.NoError(t, ValidateModelTypes(`{"*-image":"image","*nano-banana*":"image"}`))

	require.Error(t, ValidateModelTypes(`[]`))
	require.Error(t, ValidateModelTypes(`null`))
	require.Error(t, ValidateModelTypes(`{"gpt-4o":"audio"}`))
	require.Error(t, ValidateModelTypes(`{"":"image"}`))
	require.Error(t, ValidateModelTypes(`{"**":"image"}`))
	require.Error(t, ValidateModelTypes(`{"*":"image"}`))
	require.Error(t, ValidateModelTypes(`not json`))
}

func TestDefaultModelTypesCoverNativeImageModels(t *testing.T) {
	defaults := defaultOpenaiSettings.ModelTypes
	assert.Equal(t, "image", defaults["*-image"])
	assert.Equal(t, "image", defaults["*nano-banana*"])
}

func TestShouldPreserveThinkingSuffixExactAndRegex(t *testing.T) {
	settings := GetGlobalSettings()
	original := append([]string(nil), settings.ThinkingModelBlacklist...)
	t.Cleanup(func() { settings.ThinkingModelBlacklist = original })

	assert.True(t, ShouldPreserveThinkingSuffix("kimi-k2-thinking"))
	assert.True(t, ShouldPreserveThinkingSuffix("moonshotai/kimi-k2-thinking"))
	assert.False(t, ShouldPreserveThinkingSuffix("m@sha256:abc"))

	settings.ThinkingModelBlacklist = []string{
		"kimi-k2-thinking",
		"re:[",
		"re:",
		"re:.*@sha256:.*",
	}

	var logged bytes.Buffer
	previous := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logged
	t.Cleanup(func() { gin.DefaultErrorWriter = previous })

	assert.True(t, ShouldPreserveThinkingSuffix("kimi-k2-thinking"))
	assert.True(t, ShouldPreserveThinkingSuffix("m@sha256:abc"))
	assert.False(t, ShouldPreserveThinkingSuffix("m@sha256"))
	assert.False(t, ShouldPreserveThinkingSuffix("qwen3-max@thinking:on"))
	require.Contains(t, logged.String(), `invalid thinking_model_blacklist regex "re:["`)
	require.Contains(t, logged.String(), `invalid thinking_model_blacklist regex "re:"`)

	settings.ThinkingModelBlacklist = []string{"re:^beta@"}
	assert.False(t, ShouldPreserveThinkingSuffix("m@sha256:abc"))
	assert.True(t, ShouldPreserveThinkingSuffix("beta@sha256:abc"))
	assert.False(t, ShouldPreserveThinkingSuffix("alpha@sha256:abc"))
}
