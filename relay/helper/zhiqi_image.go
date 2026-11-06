package helper

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

const (
	ZhiqiMaxReferenceImages = 16
	ZhiqiMaxReferenceBytes  = 20 << 20
	ZhiqiMaxPromptRunes     = 32000
	zhiqiImageRequestKey    = "_zhiqi_image_request"
)

var zhiqiImageDimensions = regexp.MustCompile(`^[1-9][0-9]*[x:][1-9][0-9]*$`)

// ZhiqiImageReference keeps the submitted order, including mixed URL and file
// parts. Files are published only when the selected channel needs public URLs.
type ZhiqiImageReference struct {
	Value string
	Data  []byte
}

// ZhiqiImageRequest is the public image contract, not the provider's private
// size table. Optional scalars retain omission and explicit zero/false values.
type ZhiqiImageRequest struct {
	Model             string                `json:"model"`
	Prompt            string                `json:"prompt"`
	N                 *uint                 `json:"n,omitempty"`
	Size              *string               `json:"size,omitempty"`
	Resolution        *string               `json:"resolution,omitempty"`
	AspectRatio       *string               `json:"aspect_ratio,omitempty"`
	Quality           *string               `json:"quality,omitempty"`
	ResponseFormat    *string               `json:"response_format,omitempty"`
	OutputFormat      *string               `json:"output_format,omitempty"`
	OutputCompression *int                  `json:"output_compression,omitempty"`
	FrameCount        *int                  `json:"frame_count,omitempty"`
	FrameDurationMS   *int                  `json:"frame_duration_ms,omitempty"`
	Stream            *bool                 `json:"stream,omitempty"`
	References        []ZhiqiImageReference `json:"-"`
	Mask              *ZhiqiImageReference  `json:"-"`
}

// DecodeZhiqiImageRequest is also used after channel parameter overrides. It
// deliberately rejects undeclared fields rather than merging arbitrary Extra.
func DecodeZhiqiImageRequest(parameters map[string]json.RawMessage) (*ZhiqiImageRequest, error) {
	for field := range parameters {
		switch field {
		case "model", "prompt", "n", "size", "resolution", "aspect_ratio", "quality",
			"response_format", "output_format", "output_compression", "frame_count",
			"frame_duration_ms", "stream", "image", "mask":
		default:
			return nil, fmt.Errorf("unsupported Zhiqi image parameter: %s", field)
		}
	}
	encoded, err := common.Marshal(parameters)
	if err != nil {
		return nil, err
	}
	request := &ZhiqiImageRequest{}
	if err := common.Unmarshal(encoded, request); err != nil {
		return nil, fmt.Errorf("invalid Zhiqi image parameters: %w", err)
	}
	if raw := parameters["image"]; len(raw) > 0 {
		var references []string
		var single string
		if err := common.Unmarshal(raw, &single); err == nil && single != "" {
			references = []string{single}
		} else if err := common.Unmarshal(raw, &references); err != nil {
			return nil, errors.New("image must be a string or an array of strings")
		}
		for _, reference := range references {
			request.References = append(request.References, ZhiqiImageReference{Value: reference})
		}
	}
	if raw := parameters["mask"]; len(raw) > 0 && string(raw) != "null" {
		var mask string
		if err := common.Unmarshal(raw, &mask); err != nil || strings.TrimSpace(mask) == "" {
			return nil, errors.New("mask must be a non-empty image URL or inline image")
		}
		request.Mask = &ZhiqiImageReference{Value: mask}
	}
	return request, nil
}

// ReadZhiqiImageRequest reads the original body, never a previous attempt's
// converted form. The cached input stays immutable across channel retries.
func ReadZhiqiImageRequest(context *gin.Context) (*ZhiqiImageRequest, error) {
	if cached, exists := context.Get(zhiqiImageRequestKey); exists {
		return cached.(*ZhiqiImageRequest), nil
	}
	storage, err := common.GetBodyStorage(context)
	if err != nil {
		return nil, err
	}
	reader, err := storage.NewReader()
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	mediaType, mediaParameters, err := mime.ParseMediaType(context.Request.Header.Get("Content-Type"))
	if err != nil {
		return nil, errors.New("Zhiqi image requests require JSON or multipart/form-data")
	}
	parameters := map[string]json.RawMessage{}
	var references []ZhiqiImageReference
	var mask *ZhiqiImageReference
	switch mediaType {
	case "application/json":
		if err := common.DecodeJson(reader, &parameters); err != nil {
			return nil, err
		}
	case "multipart/form-data":
		boundary := mediaParameters["boundary"]
		if boundary == "" {
			return nil, errors.New("multipart boundary is required")
		}
		multipartReader := multipart.NewReader(reader, boundary)
		for partCount := 0; ; partCount++ {
			part, partErr := multipartReader.NextPart()
			if errors.Is(partErr, io.EOF) {
				break
			}
			if partErr != nil {
				return nil, partErr
			}
			if partCount >= 64 {
				return nil, errors.New("too many image form fields")
			}
			field := part.FormName()
			isReference := field == "image" || field == "image[]" || strings.HasPrefix(field, "image[") && strings.HasSuffix(field, "]")
			isMask := field == "mask"
			limit := int64(128 << 10)
			if isReference || isMask {
				limit = ZhiqiMaxReferenceBytes*4/3 + 1024
				if part.FileName() != "" {
					limit = ZhiqiMaxReferenceBytes
				}
			} else if part.FileName() != "" {
				return nil, fmt.Errorf("unsupported Zhiqi image file field: %s", field)
			}
			data, readErr := io.ReadAll(io.LimitReader(part, limit+1))
			if readErr != nil {
				return nil, readErr
			}
			if int64(len(data)) > limit {
				return nil, fmt.Errorf("image form field %s exceeds its size limit", field)
			}
			if isReference || isMask {
				reference := ZhiqiImageReference{Value: string(data)}
				if part.FileName() != "" {
					reference = ZhiqiImageReference{Data: data}
				}
				if isReference {
					references = append(references, reference)
					if len(references) > ZhiqiMaxReferenceImages {
						return nil, fmt.Errorf("at most %d reference images are allowed", ZhiqiMaxReferenceImages)
					}
				} else {
					if mask != nil {
						return nil, errors.New("only one mask is allowed")
					}
					mask = &reference
				}
				continue
			}
			if _, duplicate := parameters[field]; duplicate {
				return nil, fmt.Errorf("duplicate image parameter: %s", field)
			}
			switch field {
			case "n", "output_compression", "frame_count", "frame_duration_ms", "stream":
				parameters[field] = bytes.TrimSpace(data)
			default:
				parameters[field], err = common.Marshal(string(data))
				if err != nil {
					return nil, err
				}
			}
		}
	default:
		return nil, errors.New("Zhiqi image requests require JSON or multipart/form-data")
	}
	request, err := DecodeZhiqiImageRequest(parameters)
	if err != nil {
		return nil, err
	}
	if mediaType == "multipart/form-data" {
		request.References, request.Mask = references, mask
	}
	if err := request.Validate(strings.HasSuffix(context.Request.URL.Path, "/edits")); err != nil {
		return nil, err
	}
	context.Set(zhiqiImageRequestKey, request)
	return request, nil
}

func (request *ZhiqiImageRequest) Validate(requireImage bool) error {
	if strings.TrimSpace(request.Model) == "" || strings.TrimSpace(request.Prompt) == "" {
		return errors.New("model and prompt are required")
	}
	if utf8.RuneCountInString(request.Prompt) > ZhiqiMaxPromptRunes {
		return fmt.Errorf("prompt must not exceed %d characters", ZhiqiMaxPromptRunes)
	}
	if request.N != nil && (*request.N < 1 || *request.N > dto.MaxImageN) {
		return fmt.Errorf("n must be an integer between 1 and %d", dto.MaxImageN)
	}
	modelName := strings.ToLower(request.Model)
	if separator := strings.LastIndexByte(modelName, '/'); separator >= 0 {
		modelName = modelName[separator+1:]
	}
	if strings.HasPrefix(modelName, "gpt-image-2") {
		if request.N != nil && *request.N != 1 {
			return errors.New("this Zhiqi GPT image route requires n=1")
		}
		if request.ResponseFormat != nil && *request.ResponseFormat != "url" {
			return errors.New("this Zhiqi GPT image route requires response_format=url")
		}
	}
	for field, value := range map[string]*string{
		"size": request.Size, "resolution": request.Resolution, "aspect_ratio": request.AspectRatio,
		"quality": request.Quality, "response_format": request.ResponseFormat, "output_format": request.OutputFormat,
	} {
		if value != nil && (strings.TrimSpace(*value) == "" || len(*value) > 128) {
			return fmt.Errorf("%s must be a non-empty supported value", field)
		}
	}
	if request.Resolution != nil && !slices.Contains([]string{"1k", "1080p", "2k", "4k"}, *request.Resolution) {
		return errors.New("resolution must be 1k, 1080p, 2k or 4k")
	}
	if request.AspectRatio != nil {
		if err := validateZhiqiImageDimensions(*request.AspectRatio, ':'); err != nil {
			return fmt.Errorf("invalid aspect_ratio: %w", err)
		}
	}
	if request.Size != nil && !(request.Resolution != nil && request.AspectRatio != nil) && *request.Size != "auto" {
		separator := byte('x')
		if strings.Contains(*request.Size, ":") {
			separator = ':'
		}
		if err := validateZhiqiImageDimensions(*request.Size, separator); err != nil {
			return fmt.Errorf("invalid size: %w", err)
		}
	}
	if request.Quality != nil && !slices.Contains([]string{"auto", "low", "medium", "high", "xhigh", "max"}, *request.Quality) {
		return errors.New("quality must be auto, low, medium, high, xhigh or max")
	}
	if request.ResponseFormat != nil && !slices.Contains([]string{"url", "b64_json"}, *request.ResponseFormat) {
		return errors.New("response_format must be url or b64_json")
	}
	outputFormat := ""
	if request.OutputFormat != nil {
		outputFormat = *request.OutputFormat
		if !slices.Contains([]string{"png", "jpeg", "webp", "svg", "gif"}, outputFormat) {
			return errors.New("output_format must be png, jpeg, webp, svg or gif")
		}
	}
	if request.OutputCompression != nil {
		if *request.OutputCompression < 0 || *request.OutputCompression > 100 {
			return errors.New("output_compression must be an integer between 0 and 100")
		}
		if outputFormat != "jpeg" && outputFormat != "webp" {
			return errors.New("output_compression requires output_format=jpeg or webp")
		}
	}
	if request.FrameCount != nil && (*request.FrameCount < 2 || *request.FrameCount > 16) {
		return errors.New("frame_count must be an integer between 2 and 16")
	}
	if request.FrameDurationMS != nil && (*request.FrameDurationMS < 20 || *request.FrameDurationMS > 655350) {
		return errors.New("frame_duration_ms must be an integer between 20 and 655350")
	}
	if outputFormat != "gif" && (request.FrameCount != nil || request.FrameDurationMS != nil) {
		return errors.New("GIF frame parameters require output_format=gif")
	}
	if outputFormat == "gif" && request.Stream != nil && *request.Stream {
		return errors.New("GIF output cannot be combined with stream=true")
	}
	if requireImage && len(request.References) == 0 {
		return errors.New("image is required for image edits")
	}
	if len(request.References) > ZhiqiMaxReferenceImages {
		return fmt.Errorf("at most %d reference images are allowed", ZhiqiMaxReferenceImages)
	}
	if request.Mask != nil && len(request.References) == 0 {
		return errors.New("mask requires a reference image")
	}
	for _, reference := range request.References {
		if err := reference.Validate(); err != nil {
			return err
		}
	}
	if request.Mask != nil {
		return request.Mask.Validate()
	}
	return nil
}

func validateZhiqiImageDimensions(value string, separator byte) error {
	widthText, heightText, found := strings.Cut(value, string(separator))
	if !found || !zhiqiImageDimensions.MatchString(value) {
		return errors.New("use positive width:height ratios or widthxheight pixels with a lowercase x")
	}
	width, widthErr := strconv.Atoi(widthText)
	height, heightErr := strconv.Atoi(heightText)
	if widthErr != nil || heightErr != nil || width > 4096 || height > 4096 {
		return errors.New("image dimensions must not exceed 4096 per side")
	}
	return nil
}

func (reference ZhiqiImageReference) Validate() error {
	if reference.Data != nil {
		if len(reference.Data) == 0 || len(reference.Data) > ZhiqiMaxReferenceBytes {
			return errors.New("reference image files must contain between 1 byte and 20 MB")
		}
		return nil
	}
	value := strings.TrimSpace(reference.Value)
	if value == "" || len(value) > ZhiqiMaxReferenceBytes*4/3+1024 {
		return errors.New("reference image is empty or exceeds 20 MB")
	}
	if strings.HasPrefix(value, "http:") || strings.HasPrefix(value, "https:") {
		parsed, err := url.Parse(value)
		if err != nil || parsed.Hostname() == "" || parsed.User != nil || parsed.Fragment != "" || strings.ContainsAny(value, "\\\r\n\t ") {
			return errors.New("reference image URLs must be absolute HTTP(S) URLs without credentials or fragments")
		}
	}
	return nil
}

func (request *ZhiqiImageRequest) ToImageRequest() (*dto.ImageRequest, error) {
	encoded, err := common.Marshal(request)
	if err != nil {
		return nil, err
	}
	imageRequest := &dto.ImageRequest{}
	if err := common.Unmarshal(encoded, imageRequest); err != nil {
		return nil, err
	}
	if imageRequest.N == nil {
		imageRequest.N = common.GetPointer(uint(1))
	}
	var references []string
	for _, reference := range request.References {
		if reference.Data == nil {
			references = append(references, reference.Value)
		}
	}
	if len(references) > 0 {
		imageRequest.Image, err = common.Marshal(references)
		if err != nil {
			return nil, err
		}
	}
	if request.Mask != nil && request.Mask.Data == nil {
		imageRequest.Mask, err = common.Marshal(request.Mask.Value)
		if err != nil {
			return nil, err
		}
	}
	return imageRequest, nil
}

// BillingBody excludes prompts, references and masks from the pricing
// snapshot, while retaining all validated scalar options and their presence.
func (request *ZhiqiImageRequest) BillingBody() ([]byte, error) {
	encoded, err := common.Marshal(request)
	if err != nil {
		return nil, err
	}
	var parameters map[string]json.RawMessage
	if err := common.Unmarshal(encoded, &parameters); err != nil {
		return nil, err
	}
	delete(parameters, "prompt")
	if request.Resolution != nil && request.AspectRatio != nil {
		delete(parameters, "size")
	}
	if request.N == nil {
		parameters["n"] = json.RawMessage("1")
	}
	return common.Marshal(parameters)
}
