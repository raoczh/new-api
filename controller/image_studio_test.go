package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type imageStudioModelsResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Groups []imageStudioGroupOption `json:"groups"`
	} `json:"data"`
}

func withImageStudioPricingConfig(t *testing.T, modelPrices, groupRatios map[string]float64) {
	t.Helper()

	originalModelPrices := ratio_setting.ModelPrice2JSONString()
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(originalModelPrices))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
		model.InvalidatePricingCache()
	})

	priceBytes, err := common.Marshal(modelPrices)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceBytes)))

	ratioBytes, err := common.Marshal(groupRatios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(string(ratioBytes)))

	model.InvalidatePricingCache()
}

func setupImageStudioControllerTest(t *testing.T, models ...string) {
	t.Helper()

	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       2001,
		Username: "image-studio-model-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)

	abilities := make([]model.Ability, 0, len(models))
	for _, name := range models {
		abilities = append(abilities, model.Ability{
			Group:     "default",
			Model:     name,
			ChannelId: 1,
			Enabled:   true,
		})
	}
	require.NoError(t, db.Create(&abilities).Error)
	model.InvalidatePricingCache()
}

func requestImageStudioModels(t *testing.T) []imageStudioGroupOption {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/image-studio/models", nil)
	ctx.Set("id", 2001)

	ListImageStudioModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload imageStudioModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	return payload.Data.Groups
}

func findImageStudioModelOption(t *testing.T, groups []imageStudioGroupOption, group, name string) imageStudioModelOption {
	t.Helper()

	for _, candidate := range groups {
		if candidate.Group != group {
			continue
		}
		for _, option := range candidate.Models {
			if option.Model == name {
				return option
			}
		}
	}
	require.FailNow(t, "image studio model option not found", "group=%s model=%s", group, name)
	return imageStudioModelOption{}
}

func TestBuildImageStudioBodySendsReferenceFilesByDefault(t *testing.T) {
	withImageStudioStorage(t)
	referenceKey := saveImageStudioTestImage(t)

	body, contentType, requestPath, err := buildImageStudioBody(service.ImageStudioRunInput{
		Model:         "gpt-image-1",
		Prompt:        "a cat",
		ReferenceKeys: []string{referenceKey},
	}, dto.ChannelSettings{})
	require.NoError(t, err)

	assert.Equal(t, imageStudioEditPath, requestPath)
	assert.True(t, strings.HasPrefix(contentType, "multipart/form-data"))
	assert.Contains(t, string(body), `name="image[]"`)
	assert.NotContains(t, string(body), "http://")
}

func TestBuildImageStudioBodySendsReferenceURLsWhenChannelRequiresThem(t *testing.T) {
	withImageStudioStorage(t)
	referenceKey := saveImageStudioTestImage(t)

	body, contentType, requestPath, err := buildImageStudioBody(service.ImageStudioRunInput{
		Model:         "gpt-image-1",
		Prompt:        "a cat",
		ReferenceKeys: []string{referenceKey},
	}, dto.ChannelSettings{ImageReferenceAsURL: true})
	require.NoError(t, err)

	assert.Equal(t, imageStudioGenerationPath, requestPath)
	assert.Equal(t, "application/json", contentType)
	var payload struct {
		Model string   `json:"model"`
		Image []string `json:"image"`
	}
	require.NoError(t, common.Unmarshal(body, &payload))
	require.Len(t, payload.Image, 1)
	assert.Equal(t, "https://img.example.com/"+referenceKey, payload.Image[0])
}

func TestBuildImageStudioBodySendsMaskAsURLWhenChannelRequiresThem(t *testing.T) {
	withImageStudioStorage(t)
	referenceKey := saveImageStudioTestImage(t)
	maskKey := saveImageStudioTestImage(t)

	body, _, _, err := buildImageStudioBody(service.ImageStudioRunInput{
		Model:         "gpt-image-1",
		Prompt:        "a cat",
		ReferenceKeys: []string{referenceKey},
		MaskKey:       maskKey,
	}, dto.ChannelSettings{ImageReferenceAsURL: true})
	require.NoError(t, err)

	var payload struct {
		Mask string `json:"mask"`
	}
	require.NoError(t, common.Unmarshal(body, &payload))
	assert.Equal(t, "https://img.example.com/"+maskKey, payload.Mask)
}

func TestBuildImageStudioBodyFallsBackToServerAddressForReferenceURLs(t *testing.T) {
	withImageStudioStorage(t)
	referenceKey := saveImageStudioTestImage(t)
	settings := system_setting.GetImageStudioSettings()
	settings.PublicBaseURL = ""
	originalServerAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://gateway.example.com"
	t.Cleanup(func() { system_setting.ServerAddress = originalServerAddress })

	body, _, _, err := buildImageStudioBody(service.ImageStudioRunInput{
		Model:         "gpt-image-1",
		Prompt:        "a cat",
		ReferenceKeys: []string{referenceKey},
	}, dto.ChannelSettings{ImageReferenceAsURL: true})
	require.NoError(t, err)

	var payload struct {
		Image []string `json:"image"`
	}
	require.NoError(t, common.Unmarshal(body, &payload))
	require.Len(t, payload.Image, 1)
	assert.Equal(
		t,
		"https://gateway.example.com/api/image-studio/files/"+referenceKey,
		payload.Image[0],
	)
}

func TestBuildImageStudioBodyRejectsURLModeWithoutAbsoluteAddress(t *testing.T) {
	withImageStudioStorage(t)
	referenceKey := saveImageStudioTestImage(t)
	settings := system_setting.GetImageStudioSettings()
	settings.PublicBaseURL = ""
	originalServerAddress := system_setting.ServerAddress
	system_setting.ServerAddress = ""
	t.Cleanup(func() { system_setting.ServerAddress = originalServerAddress })

	_, _, _, err := buildImageStudioBody(service.ImageStudioRunInput{
		Model:         "gpt-image-1",
		Prompt:        "a cat",
		ReferenceKeys: []string{referenceKey},
	}, dto.ChannelSettings{ImageReferenceAsURL: true})

	require.Error(t, err)
}

// withImageStudioStorage points artifact storage at a temporary directory and
// configures PublicBaseURL, restoring both afterwards.
func withImageStudioStorage(t *testing.T) {
	t.Helper()

	settings := system_setting.GetImageStudioSettings()
	originalStorageDir := settings.StorageDir
	originalPublicBaseURL := settings.PublicBaseURL
	t.Cleanup(func() {
		settings.StorageDir = originalStorageDir
		settings.PublicBaseURL = originalPublicBaseURL
	})
	settings.StorageDir = t.TempDir()
	settings.PublicBaseURL = "https://img.example.com"
}

func saveImageStudioTestImage(t *testing.T) string {
	t.Helper()

	// Minimal PNG signature plus IHDR chunk is enough for content sniffing.
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 13, 'I', 'H', 'D', 'R', 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0}
	key, err := service.SaveImageStudioBytes(png)
	require.NoError(t, err)
	return key
}

func TestListImageStudioModelsResolvesTieredFixedPrices(t *testing.T) {
	withTieredBillingConfig(t, map[string]string{
		"zz-image-fixed-per-image":   "tiered_expr",
		"zz-image-fixed-per-request": "tiered_expr",
		"zz-image-fixed-mixed":       "tiered_expr",
		"zz-image-fixed-token":       "tiered_expr",
	}, map[string]string{
		"zz-image-fixed-per-image":   `tier("image", fixed(0.04)) * image_count`,
		"zz-image-fixed-per-request": `tier("request", fixed(0.02))`,
		// Only one branch multiplies by image_count; with no request headers the
		// per-request branch runs, so the label must not say "per image".
		"zz-image-fixed-mixed": `header("x-batch") == "1" ? tier("multi", fixed(0.06)) * image_count : tier("single", fixed(0.03))`,
		"zz-image-fixed-token": `tier("base", p * 1 + c * 2)`,
	})
	setupImageStudioControllerTest(t,
		"zz-image-fixed-per-image",
		"zz-image-fixed-per-request",
		"zz-image-fixed-mixed",
		"zz-image-fixed-token",
		"zz-image-legacy",
	)
	// Legacy per-call prices stay configured on purpose: a tiered model may
	// still carry them, and they must not leak into the selector.
	withImageStudioPricingConfig(t,
		map[string]float64{
			"zz-image-fixed-per-image":   0.25,
			"zz-image-fixed-per-request": 0.25,
			"zz-image-fixed-mixed":       0.25,
			"zz-image-fixed-token":       0.25,
			"zz-image-legacy":            0.25,
		},
		map[string]float64{"default": 2, "vip": 1},
	)

	groups := requestImageStudioModels(t)

	perImage := findImageStudioModelOption(t, groups, "default", "zz-image-fixed-per-image")
	assert.InDelta(t, 0.08, perImage.Price, 1e-9)
	assert.Equal(t, "image", perImage.PriceUnit)
	assert.Equal(t, 1, perImage.QuotaType)

	perRequest := findImageStudioModelOption(t, groups, "default", "zz-image-fixed-per-request")
	assert.InDelta(t, 0.04, perRequest.Price, 1e-9)
	assert.Equal(t, "request", perRequest.PriceUnit)

	mixed := findImageStudioModelOption(t, groups, "default", "zz-image-fixed-mixed")
	assert.InDelta(t, 0.06, mixed.Price, 1e-9)
	assert.Equal(t, "request", mixed.PriceUnit)

	tokenPriced := findImageStudioModelOption(t, groups, "default", "zz-image-fixed-token")
	assert.Zero(t, tokenPriced.Price)
	assert.Empty(t, tokenPriced.PriceUnit)

	legacy := findImageStudioModelOption(t, groups, "default", "zz-image-legacy")
	assert.InDelta(t, 0.5, legacy.Price, 1e-9)
	assert.Equal(t, "image", legacy.PriceUnit)
}

// withConfiguredModelTypes installs the model type table used by the
// capability checks, restoring the previous mapping afterwards.
func withConfiguredModelTypes(t *testing.T, modelTypes map[string]string) {
	t.Helper()

	settings := model_setting.GetGlobalSettings()
	original := settings.ModelTypes
	t.Cleanup(func() {
		settings.ModelTypes = original
		model.InvalidatePricingCache()
	})
	settings.ModelTypes = modelTypes
	model.InvalidatePricingCache()
}

func TestListImageStudioModelsFollowsConfiguredModelTypes(t *testing.T) {
	// "zz-studio-image-blocked" would match the name keyword heuristic, but the
	// explicit text entry must win; "zz-studio-plain" has no image keyword and
	// only qualifies because of its configured type.
	withConfiguredModelTypes(t, map[string]string{
		"zz-studio-image-blocked": common.ModelTypeText,
		"zz-studio-plain":         common.ModelTypeImage,
	})
	setupImageStudioControllerTest(t, "zz-studio-image-blocked", "zz-studio-plain")
	withImageStudioPricingConfig(t,
		map[string]float64{
			"zz-studio-image-blocked": 0.25,
			"zz-studio-plain":         0.25,
		},
		map[string]float64{"default": 1, "vip": 1},
	)

	groups := requestImageStudioModels(t)

	findImageStudioModelOption(t, groups, "default", "zz-studio-plain")
	for _, group := range groups {
		for _, option := range group.Models {
			assert.NotEqual(t, "zz-studio-image-blocked", option.Model)
		}
	}
}

func TestListImageStudioModelsIgnoresLegacyPriceForTieredModelWithoutFixedLeaf(t *testing.T) {
	withTieredBillingConfig(t, map[string]string{
		"zz-image-tiered-invalid": "tiered_expr",
	}, map[string]string{
		// A request multiplier without a fixed leaf is token-priced, so the
		// legacy per-call price must stay hidden.
		"zz-image-tiered-invalid": `tier("base", p * 1 + c * 2) * (header("x-fast") == "true" ? 2 : 1)`,
	})
	setupImageStudioControllerTest(t, "zz-image-tiered-invalid")
	withImageStudioPricingConfig(t,
		map[string]float64{"zz-image-tiered-invalid": 0.25},
		map[string]float64{"default": 1, "vip": 1},
	)

	groups := requestImageStudioModels(t)
	option := findImageStudioModelOption(t, groups, "default", "zz-image-tiered-invalid")
	assert.Zero(t, option.Price)
	assert.Empty(t, option.PriceUnit)
}
