package gemini

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"mime/multipart"
	"net/http"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// IsImagenModel reports whether the upstream model belongs to the Imagen
// family, which uses the :predict endpoint instead of generateContent.
func IsImagenModel(modelName string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(modelName)), "imagen")
}

// IsGeminiNativeImageModel reports whether the request targets a Gemini native
// image model: one configured as an image model in the model type settings.
// Both the client-facing name and the mapped upstream name are checked, because
// the administrator configures the name they see in the model list while a
// channel mapping may rewrite it before the request reaches the adaptor.
func IsGeminiNativeImageModel(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	// Imagen has its own transport and never uses generateContent.
	upstreamModel := info.GetUpstreamModelName()
	if IsImagenModel(upstreamModel) {
		return false
	}
	for _, modelName := range []string{info.GetOriginModelName(), upstreamModel} {
		if common.ResolveModelType(modelName) == common.ModelTypeImage {
			return true
		}
	}
	return false
}

// geminiImageAspectRatio maps an OpenAI image size to a Gemini aspect ratio.
// An empty result means the caller should let the upstream default apply.
func geminiImageAspectRatio(size string) string {
	size = strings.TrimSpace(size)
	if size == "" {
		return ""
	}
	if strings.Contains(size, ":") {
		return size
	}
	switch size {
	case "256x256", "512x512", "1024x1024":
		return "1:1"
	case "1536x1024":
		return "3:2"
	case "1024x1536":
		return "2:3"
	case "1024x1792":
		return "9:16"
	case "1792x1024":
		return "16:9"
	}
	return ""
}

// geminiImageSize maps an OpenAI image quality value to a Gemini image size.
func geminiImageSize(quality string) string {
	switch quality {
	case "":
		return ""
	case "hd", "high", "2K":
		return "2K"
	default:
		return "1K"
	}
}

// geminiImageSizeUnsupported reports models that return 500 when imageConfig
// carries imageSize (nano-banana and gemini-2.5-flash-image do not accept it).
func geminiImageSizeUnsupported(modelName string) bool {
	name := strings.ToLower(modelName)
	return strings.Contains(name, "nano-banana") || strings.Contains(name, "gemini-2.5-flash-image")
}

type geminiNativeImageConfig struct {
	AspectRatio string `json:"aspectRatio,omitempty"`
	ImageSize   string `json:"imageSize,omitempty"`
}

func geminiImageInvalidRequest(message string) error {
	return types.NewErrorWithStatusCode(fmt.Errorf("%s", message), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
}

// maskValue returns the mask string of a request, treating an empty or absent
// value as no mask.
func maskValue(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var value string
	if err := common.Unmarshal(raw, &value); err != nil {
		// A non-string mask is still a mask the transport cannot express.
		return string(raw)
	}
	return value
}

// decodeGeminiImageValues accepts the string or string-array shapes used by
// image and images on the image edit endpoints.
func decodeGeminiImageValues(raw json.RawMessage) ([]string, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var single string
	if err := common.Unmarshal(raw, &single); err == nil {
		return []string{single}, nil
	}
	var values []string
	if err := common.Unmarshal(raw, &values); err != nil {
		return nil, fmt.Errorf("image must be a string or an array of strings")
	}
	return values, nil
}

// geminiImageMultipartSource reads an uploaded reference image. The multipart
// header often carries application/octet-stream, so sniff the bytes when the
// declared type is missing or generic.
func geminiImageMultipartSource(header *multipart.FileHeader) (types.FileSource, error) {
	file, err := header.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open image file %s", header.Filename)
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read image file %s", header.Filename)
	}
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}
	return types.NewBase64FileSource(base64.StdEncoding.EncodeToString(data), mimeType), nil
}

// geminiImageReferenceSources collects the reference images of an image edit
// request. Inline values are appended before multipart files, matching the
// order used by the image reference URL conversion.
func geminiImageReferenceSources(c *gin.Context, request dto.ImageRequest) ([]types.FileSource, error) {
	var sources []types.FileSource
	for _, raw := range []json.RawMessage{request.Image, request.Images} {
		values, err := decodeGeminiImageValues(raw)
		if err != nil {
			return nil, err
		}
		for _, value := range values {
			value = strings.TrimSpace(value)
			if value == "" {
				continue
			}
			if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
				sources = append(sources, types.NewURLFileSource(value))
				continue
			}
			// Base64 data, optionally as a data URL; LoadFileSource handles
			// both and sniffs the image format when the type is missing.
			sources = append(sources, types.NewBase64FileSource(value, ""))
		}
	}

	if !strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		return sources, nil
	}
	form := c.Request.MultipartForm
	if form == nil {
		parsed, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, fmt.Errorf("failed to parse image edit form request: %w", err)
		}
		c.Request.MultipartForm = parsed
		form = parsed
	}
	// Same field precedence as the OpenAI form forwarder; indexed fields are
	// read in name order so image[0], image[1] keep their order.
	files := form.File["image"]
	if len(files) == 0 {
		files = form.File["image[]"]
	}
	if len(files) == 0 {
		for _, field := range slices.Sorted(maps.Keys(form.File)) {
			if strings.HasPrefix(field, "image[") {
				files = append(files, form.File[field]...)
			}
		}
	}
	for _, header := range files {
		source, err := geminiImageMultipartSource(header)
		if err != nil {
			return nil, err
		}
		sources = append(sources, source)
	}
	return sources, nil
}

// buildGeminiNativeImageRequest converts an OpenAI image request into a Gemini
// generateContent request. Reference images become inlineData parts before the
// prompt so the model edits them instead of generating from text alone.
func buildGeminiNativeImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if request.Stream != nil && *request.Stream {
		return nil, geminiImageInvalidRequest("Gemini native image models do not support streamed image generation; remove stream or set it to false")
	}
	count, err := request.ImageCount(false)
	if err != nil {
		return nil, geminiImageInvalidRequest(err.Error())
	}
	if count > 1 {
		return nil, geminiImageInvalidRequest("Gemini native image models generate one image per request; set n to 1")
	}
	if mask := strings.TrimSpace(maskValue(request.Mask)); mask != "" {
		return nil, geminiImageInvalidRequest("Gemini native image models do not support masks")
	}
	if strings.TrimSpace(request.Prompt) == "" {
		return nil, geminiImageInvalidRequest("prompt is required")
	}

	sources, err := geminiImageReferenceSources(c, request)
	if err != nil {
		return nil, geminiImageInvalidRequest(err.Error())
	}
	parts := make([]dto.GeminiPart, 0, len(sources)+1)
	for _, source := range sources {
		data, mimeType, loadErr := service.GetBase64Data(c, source, "gemini_image")
		if loadErr != nil {
			return nil, geminiImageInvalidRequest(fmt.Sprintf("failed to load reference image: %s", loadErr.Error()))
		}
		if !strings.HasPrefix(mimeType, "image/") {
			return nil, geminiImageInvalidRequest(fmt.Sprintf("reference image must be an image, got %q", mimeType))
		}
		parts = append(parts, dto.GeminiPart{
			InlineData: &dto.GeminiInlineData{MimeType: mimeType, Data: data},
		})
	}
	parts = append(parts, dto.GeminiPart{Text: request.Prompt})

	var imageConfig json.RawMessage
	aspectRatio := geminiImageAspectRatio(request.Size)
	imageSize := geminiImageSize(request.Quality)
	if geminiImageSizeUnsupported(info.GetUpstreamModelName()) {
		imageSize = ""
	}
	if aspectRatio != "" || imageSize != "" {
		imageConfig, err = common.Marshal(geminiNativeImageConfig{AspectRatio: aspectRatio, ImageSize: imageSize})
		if err != nil {
			return nil, geminiImageInvalidRequest(fmt.Sprintf("failed to build image config: %s", err.Error()))
		}
	}

	// The upstream call is always non-streaming; RelayInfo drives request
	// headers and response framing, so it must agree.
	info.IsStream = false

	return &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{
				Role:  "user",
				Parts: parts,
			},
		},
		GenerationConfig: dto.GeminiChatGenerationConfig{
			ResponseModalities: []string{"TEXT", "IMAGE"},
			ImageConfig:        imageConfig,
		},
	}, nil
}

// isGeminiInlineImage matches the parts that carry a generated image: non-empty
// base64 payload with an image MIME type.
func isGeminiInlineImage(part dto.GeminiPart) bool {
	return part.InlineData != nil &&
		part.InlineData.Data != "" &&
		strings.HasPrefix(part.InlineData.MimeType, "image/")
}

// geminiImageBlockedReason returns the upstream safety verdict for a response
// that produced no images, or "" when the response is simply empty.
func geminiImageBlockedReason(response *dto.GeminiChatResponse) string {
	if response == nil {
		return ""
	}
	if response.PromptFeedback != nil && response.PromptFeedback.BlockReason != nil {
		return *response.PromptFeedback.BlockReason
	}
	for _, candidate := range response.Candidates {
		if candidate.FinishReason == nil {
			continue
		}
		switch *candidate.FinishReason {
		case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII",
			"IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT", "IMAGE_RECITATION":
			return *candidate.FinishReason
		}
	}
	return ""
}

// GeminiNativeImageHandler converts a Gemini generateContent response carrying
// inline images into the OpenAI image response shape the image endpoints and
// Image Studio consume.
func GeminiNativeImageHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewOpenAIError(readErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)

	var geminiResponse dto.GeminiChatResponse
	if jsonErr := common.Unmarshal(responseBody, &geminiResponse); jsonErr != nil {
		return nil, types.NewOpenAIError(jsonErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	info.ObserveResponseModel(gjson.GetBytes(responseBody, "modelVersion").Str)

	images := make([]dto.ImageData, 0, len(geminiResponse.Candidates))
	for _, candidate := range geminiResponse.Candidates {
		for _, part := range candidate.Content.Parts {
			if !isGeminiInlineImage(part) {
				continue
			}
			images = append(images, dto.ImageData{B64Json: part.InlineData.Data})
		}
	}
	if len(images) == 0 {
		if reason := geminiImageBlockedReason(&geminiResponse); reason != "" {
			info.PerformanceBusinessRejection = true
			common.SetContextKey(c, constant.ContextKeyAdminRejectReason, fmt.Sprintf("gemini_block_reason=%s", reason))
			return nil, types.NewOpenAIError(
				fmt.Errorf("request blocked by Gemini API: %s", reason),
				types.ErrorCodePromptBlocked,
				http.StatusBadRequest,
			)
		}
		common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "gemini_empty_image_candidates")
		return nil, types.NewOpenAIError(
			fmt.Errorf("empty response from Gemini API: no images returned"),
			types.ErrorCodeEmptyResponse,
			http.StatusInternalServerError,
		)
	}

	// Settlement derives the image quantity from the upstream payload, never
	// from the requested n.
	info.UpdateImageCount(int64(len(images)))

	// Real usageMetadata (image output tokens included) beats the flat
	// per-image estimate Imagen uses.
	usage := buildUsageFromGeminiResponse(c, info, &geminiResponse)

	openAIResponse := dto.ImageResponse{
		Created: common.GetTimestamp(),
		Data:    images,
	}
	jsonResponse, jsonErr := common.Marshal(openAIResponse)
	if jsonErr != nil {
		return nil, types.NewError(jsonErr, types.ErrorCodeBadResponseBody)
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)

	return &usage, nil
}
