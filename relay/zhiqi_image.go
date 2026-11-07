package relay

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"maps"
	"mime/multipart"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	_ "golang.org/x/image/webp"
)

// zhiqiImageFields is the request contract of Zhiqi's synchronous Images API.
// Other OpenAI fields are dropped instead of forwarded, because Zhiqi rejects
// parameters outside its contract; channel parameter overrides still apply.
var zhiqiImageFields = []string{
	"model", "prompt", "n", "size", "resolution", "aspect_ratio", "quality", "response_format",
	"output_format", "output_compression", "frame_count", "frame_duration_ms", "stream",
}

// zhiqiImageAdaptor forwards the converted body to the channel base URL. The
// response is the ordinary OpenAI Images shape, so the OpenAI handlers apply.
type zhiqiImageAdaptor struct {
	openai.Adaptor
}

func (adaptor *zhiqiImageAdaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseURL := strings.TrimRight(info.ChannelBaseUrl, "/")
	requestPath := info.RequestURLPath
	if strings.HasSuffix(baseURL, "/v1") {
		requestPath = strings.TrimPrefix(requestPath, "/v1")
	}
	return baseURL + requestPath, nil
}

func (adaptor *zhiqiImageAdaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, header)
	header.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (adaptor *zhiqiImageAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(adaptor, c, info, requestBody)
}

type zhiqiImageReference struct {
	value string
	data  []byte
}

type zhiqiImageRequest struct {
	body        []byte
	contentType string
	requestPath string
	imageCount  int
	stream      bool
}

// buildZhiqiImageRequest converts a unified /v1/images request: generations
// stay JSON, while a request with reference images becomes the multipart edit
// form whose image and mask parts are public URLs. Uploaded files and Base64
// images are published through the Image Studio file store first. The client
// body is only read, so a retry on another channel still sees the original.
func buildZhiqiImageRequest(c *gin.Context, info *relaycommon.RelayInfo, upstreamModel string) (*zhiqiImageRequest, *types.NewAPIError) {
	invalid := func(err error) *types.NewAPIError {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	parameters := make(map[string]json.RawMessage)
	var references []zhiqiImageReference
	var mask *zhiqiImageReference

	if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		form, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, invalid(fmt.Errorf("failed to parse image edit form request: %w", err))
		}
		for _, field := range zhiqiImageFields {
			values := form.Value[field]
			if len(values) == 0 || strings.TrimSpace(values[0]) == "" {
				continue
			}
			value := strings.TrimSpace(values[0])
			switch field {
			case "n", "output_compression", "frame_count", "frame_duration_ms":
				if _, err := strconv.Atoi(value); err != nil {
					return nil, invalid(fmt.Errorf("%s must be an integer", field))
				}
				parameters[field] = json.RawMessage(value)
			case "stream":
				stream, err := strconv.ParseBool(value)
				if err != nil {
					return nil, invalid(fmt.Errorf("invalid stream value: %w", err))
				}
				parameters[field] = json.RawMessage(strconv.FormatBool(stream))
			default:
				parameters[field], _ = common.Marshal(value)
			}
		}
		// Same field precedence as the OpenAI form forwarder; indexed fields are
		// read in name order so image[0], image[1] keep their order. URL string
		// parts follow the file parts.
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
			data, err := readZhiqiFormFile(header)
			if err != nil {
				return nil, invalid(err)
			}
			references = append(references, zhiqiImageReference{data: data})
		}
		for _, value := range append(form.Value["image"], form.Value["image[]"]...) {
			references = append(references, zhiqiImageReference{value: value})
		}
		if maskFiles := form.File["mask"]; len(maskFiles) > 0 {
			data, err := readZhiqiFormFile(maskFiles[0])
			if err != nil {
				return nil, invalid(err)
			}
			mask = &zhiqiImageReference{data: data}
		} else if values := form.Value["mask"]; len(values) > 0 && values[0] != "" {
			mask = &zhiqiImageReference{value: values[0]}
		}
	} else {
		var body map[string]json.RawMessage
		if err := common.UnmarshalBodyReusable(c, &body); err != nil {
			return nil, invalid(err)
		}
		for _, field := range zhiqiImageFields {
			if raw := bytes.TrimSpace(body[field]); len(raw) > 0 && string(raw) != "null" {
				parameters[field] = raw
			}
		}
		if raw := bytes.TrimSpace(body["image"]); len(raw) > 0 && string(raw) != "null" {
			var values []string
			var single string
			if err := common.Unmarshal(raw, &single); err == nil {
				values = []string{single}
			} else if err := common.Unmarshal(raw, &values); err != nil {
				return nil, invalid(errors.New("image must be a string or an array of strings"))
			}
			for _, value := range values {
				references = append(references, zhiqiImageReference{value: value})
			}
		}
		if raw := bytes.TrimSpace(body["mask"]); len(raw) > 0 && string(raw) != "null" {
			var value string
			if err := common.Unmarshal(raw, &value); err != nil {
				return nil, invalid(errors.New("mask must be a string"))
			}
			mask = &zhiqiImageReference{value: value}
		}
	}
	if mask != nil && len(references) == 0 {
		return nil, invalid(errors.New("mask requires a reference image"))
	}

	paintedMask, _ := common.GetContextKeyType[bool](c, constant.ContextKeyImageStudioPaintedMask)
	if paintedMask && mask != nil && mask.data != nil && references[0].data != nil {
		referenceData, maskData, err := convertZhiqiStudioMask(references[0].data, mask.data)
		if err != nil {
			return nil, invalid(err)
		}
		references = slices.Clone(references)
		references[0] = zhiqiImageReference{data: referenceData}
		mask = &zhiqiImageReference{data: maskData}
	}

	parameters["model"], _ = common.Marshal(upstreamModel)
	if len(info.ParamOverride) > 0 {
		encoded, err := common.Marshal(parameters)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		encoded, err = relaycommon.ApplyParamOverrideWithRelayInfo(encoded, info)
		if err != nil {
			return nil, newAPIErrorFromParamOverride(err)
		}
		parameters = nil
		if err := common.Unmarshal(encoded, &parameters); err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
	}

	// The submitted body is a separate trust boundary from ingress: overrides
	// can change the billed quantity, so n is bounded again here.
	encoded, err := common.Marshal(parameters)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	var outbound struct {
		N      *uint `json:"n"`
		Stream *bool `json:"stream"`
	}
	if err := common.Unmarshal(encoded, &outbound); err != nil {
		return nil, invalid(fmt.Errorf("invalid image billing parameters: %w", err))
	}
	imageCount, err := (&dto.ImageRequest{N: outbound.N}).ImageCount(false)
	if err != nil {
		return nil, invalid(err)
	}
	request := &zhiqiImageRequest{imageCount: imageCount, stream: outbound.Stream != nil && *outbound.Stream}
	if len(references) == 0 {
		request.body, request.contentType, request.requestPath = encoded, "application/json", "/v1/images/generations"
		return request, nil
	}

	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)
	for _, field := range slices.Sorted(maps.Keys(parameters)) {
		if field == "image" || field == "mask" {
			continue
		}
		value := string(parameters[field])
		var text string
		if common.Unmarshal(parameters[field], &text) == nil {
			value = text
		}
		if err := writer.WriteField(field, value); err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
	}
	fields := slices.Repeat([]string{"image"}, len(references))
	if mask != nil {
		references = append(slices.Clone(references), *mask)
		fields = append(fields, "mask")
	}
	for index, reference := range references {
		publicURL, apiErr := publishZhiqiImageReference(reference)
		if apiErr != nil {
			return nil, apiErr
		}
		if err := writer.WriteField(fields[index], publicURL); err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
	}
	if err := writer.Close(); err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	request.body, request.contentType, request.requestPath = buffer.Bytes(), writer.FormDataContentType(), "/v1/images/edits"
	return request, nil
}

func readZhiqiFormFile(header *multipart.FileHeader) ([]byte, error) {
	file, err := header.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open image file %s", header.Filename)
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read image file %s", header.Filename)
	}
	return data, nil
}

// publishZhiqiImageReference keeps HTTP(S) URLs and publishes file or Base64
// data to the Image Studio store, which serves it at a public URL until its
// retention sweep removes it.
func publishZhiqiImageReference(reference zhiqiImageReference) (string, *types.NewAPIError) {
	invalid := func(message string) *types.NewAPIError {
		return types.NewErrorWithStatusCode(errors.New(message), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	data := reference.data
	if data == nil {
		value := strings.TrimSpace(reference.value)
		if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
			parsed, err := url.Parse(value)
			if err != nil || parsed.Hostname() == "" || parsed.User != nil {
				return "", invalid("reference image URLs must be absolute HTTP(S) URLs without credentials")
			}
			return value, nil
		}
		if strings.HasPrefix(value, "data:") {
			_, value, _ = strings.Cut(value, ";base64,")
		}
		var err error
		if data, err = base64.StdEncoding.DecodeString(value); err != nil {
			return "", invalid("reference image must be an http(s) URL, a data URL or base64 data")
		}
	}
	key, err := service.SaveImageStudioBytes(data)
	if errors.Is(err, service.ErrImageStudioFileInvalid) {
		return "", invalid("reference image must be a png, jpeg, gif or webp image")
	}
	if err != nil {
		return "", types.NewError(fmt.Errorf("failed to store reference image: %w", err), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	publicURL, err := service.ImageStudioFileAbsoluteURL(key)
	if err != nil {
		_ = service.DeleteImageStudioFile(key)
		return "", types.NewError(fmt.Errorf("failed to build reference image URL, check the image studio public base URL: %w", err), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	return publicURL, nil
}

// The workbench paints white to edit; Zhiqi edits transparent pixels and
// expects the first reference in the mask's format. Public API masks never call
// this conversion, and already-transparent masks keep their alpha channel.
func convertZhiqiStudioMask(referenceData, maskData []byte) ([]byte, []byte, error) {
	referenceConfig, referenceFormat, err := image.DecodeConfig(bytes.NewReader(referenceData))
	if err != nil {
		return nil, nil, fmt.Errorf("could not read the mask reference image: %w", err)
	}
	maskConfig, _, err := image.DecodeConfig(bytes.NewReader(maskData))
	if err != nil {
		return nil, nil, fmt.Errorf("could not read the painted mask: %w", err)
	}
	if referenceConfig.Width != maskConfig.Width || referenceConfig.Height != maskConfig.Height {
		return nil, nil, errors.New("the painted mask must match the first reference image dimensions")
	}
	// Bound decoded allocations before decompressing either image.
	maxPixels := int64(constant.MaxFileDownloadMB) << 18
	if maxPixels <= 0 {
		maxPixels = 64 << 18
	}
	if referenceConfig.Width <= 0 || referenceConfig.Height <= 0 || int64(referenceConfig.Width) > maxPixels/int64(referenceConfig.Height) {
		return nil, nil, errors.New("the painted mask exceeds the configured image processing size limit")
	}
	maskImage, _, err := image.Decode(bytes.NewReader(maskData))
	if err != nil {
		return nil, nil, fmt.Errorf("could not decode the painted mask: %w", err)
	}
	bounds := maskImage.Bounds()
	hasTransparency := false
	for row := bounds.Min.Y; row < bounds.Max.Y && !hasTransparency; row++ {
		for column := bounds.Min.X; column < bounds.Max.X; column++ {
			if _, _, _, alpha := maskImage.At(column, row).RGBA(); alpha < 0xffff {
				hasTransparency = true
				break
			}
		}
	}
	if !hasTransparency {
		transparentMask := image.NewNRGBA(bounds)
		for row := bounds.Min.Y; row < bounds.Max.Y; row++ {
			for column := bounds.Min.X; column < bounds.Max.X; column++ {
				gray := color.GrayModel.Convert(maskImage.At(column, row)).(color.Gray)
				transparentMask.SetNRGBA(column, row, color.NRGBA{A: 255 - gray.Y})
			}
		}
		maskImage = transparentMask
	}
	var encodedMask bytes.Buffer
	if err := png.Encode(&encodedMask, maskImage); err != nil {
		return nil, nil, err
	}
	if referenceFormat != "png" {
		referenceImage, _, err := image.Decode(bytes.NewReader(referenceData))
		if err != nil {
			return nil, nil, fmt.Errorf("could not decode the mask reference image: %w", err)
		}
		var encodedReference bytes.Buffer
		if err := png.Encode(&encodedReference, referenceImage); err != nil {
			return nil, nil, err
		}
		referenceData = encodedReference.Bytes()
	}
	return referenceData, encodedMask.Bytes(), nil
}
