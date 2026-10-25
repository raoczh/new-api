package relay

import (
	"bytes"
	"cmp"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
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
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
)

func ImageHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)
	info.BillingImageCount = nil
	info.ImageRequestCount = 0

	imageReq, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid request type, expected dto.ImageRequest, got %T", info.Request), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	request, err := common.DeepCopy(imageReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to ImageRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)
	imageCount, err := request.ImageCount(false)
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	var requestBody io.Reader
	var jsonData []byte

	passThrough := model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled
	if info.ChannelSetting.ImageReferenceAsURL && !passThrough {
		restore, apiErr := useImageReferenceURLs(c, info, request)
		if apiErr != nil {
			return apiErr
		}
		defer restore()
	}

	if passThrough {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
			requestBody = common.NewReplayableBodyReader(storage)
		} else {
			jsonData, err = storage.Bytes()
			if err != nil {
				return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
		}
	} else {
		convertedRequest, err := adaptor.ConvertImageRequest(c, info, *request)
		if err != nil {
			// An adaptor that already classified its rejection (status code
			// and retry policy) keeps that classification instead of being
			// downgraded to a retryable conversion failure.
			var apiErr *types.NewAPIError
			if errors.As(err, &apiErr) {
				return apiErr
			}
			return types.NewError(err, types.ErrorCodeConvertRequestFailed)
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

		switch convertedRequest.(type) {
		case *bytes.Buffer:
			requestBody = convertedRequest.(io.Reader)
		default:
			jsonData, err = common.Marshal(convertedRequest)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}

			// apply param override
			if len(info.ParamOverride) > 0 {
				jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
				if err != nil {
					return newAPIErrorFromParamOverride(err)
				}
			}

		}
	}
	if jsonData != nil {
		// This is a different trust boundary from ingress: channel overrides
		// and pass-through bodies can change the quantity actually submitted.
		var outbound struct {
			N *uint `json:"n"`
		}
		if err := common.Unmarshal(jsonData, &outbound); err != nil {
			return types.NewErrorWithStatusCode(fmt.Errorf("invalid image billing parameters: %w", err), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		quantityRequest := dto.ImageRequest{N: outbound.N}
		if quantityRequest.N == nil {
			quantityRequest.N = common.GetPointer(uint(imageCount))
		}
		imageCount, err = quantityRequest.ImageCount(false)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		logger.LogDebug(c, "image request body: %s", jsonData)
		body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		defer closer.Close()
		requestBody = body
	}
	if billingErr := service.PrepareImageBillingForRequest(c, info, imageCount); billingErr != nil {
		return billingErr
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			if httpResp.StatusCode == http.StatusCreated && info.ApiType == constant.APITypeReplicate {
				// replicate channel returns 201 Created when using Prefer: wait, treat it as success.
				httpResp.StatusCode = http.StatusOK
			} else {
				newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
				// reset status code 重置状态码
				service.ResetStatusCode(newAPIError, statusCodeMappingStr)
				return newAPIError
			}
		}
	}

	usage, newAPIError := adaptor.DoResponse(c, httpResp, info)
	if newAPIError != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	// The log content shows the settled count: the count the handler derived
	// from the upstream response when it did, otherwise the reserved quantity.
	imageN := info.RequestedImageCount()
	if info.BillingImageCount != nil {
		imageN = *info.BillingImageCount
	} else if count, ok := info.PriceData.OtherRatios()["n"]; ok && info.PriceData.UsePrice && count >= 1 && count <= dto.MaxImageN {
		imageN = common.QuotaRound(count)
	}

	if usage.(*dto.Usage).TotalTokens == 0 {
		usage.(*dto.Usage).TotalTokens = 1
	}
	if usage.(*dto.Usage).PromptTokens == 0 {
		usage.(*dto.Usage).PromptTokens = 1
	}

	quality := request.Quality
	if quality == "" {
		quality = "standard"
	}

	var logContent []*common.Message

	if len(request.Size) > 0 {
		logContent = append(logContent, common.NewMessage("Size {{size}}", map[string]any{"size": request.Size}))
	}
	if len(quality) > 0 {
		logContent = append(logContent, common.NewMessage("Quality {{quality}}", map[string]any{"quality": quality}))
	}
	if imageN > 0 {
		logContent = append(logContent, common.NewMessage("Image count {{count}}", map[string]any{"count": imageN}))
	}

	service.PostTextConsumeQuota(c, info, usage.(*dto.Usage), logContent)
	return nil
}

// useImageReferenceURLs gives a channel with ImageReferenceAsURL the payload
// Image Studio sends it: a JSON body for the generation endpoint whose image
// is a URL array and whose mask is a URL. Uploaded files and inline base64
// images are published through the Image Studio file store first, so they
// stay reachable until its retention sweep removes them. The returned
// function restores the client's request shape, so a retry on a channel
// without the setting still sees the original request.
func useImageReferenceURLs(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ImageRequest) (func(), *types.NewAPIError) {
	invalid := func(message string) *types.NewAPIError {
		return types.NewErrorWithStatusCode(errors.New(message), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	publish := func(data []byte) (string, *types.NewAPIError) {
		key, err := service.SaveImageStudioBytes(data)
		if errors.Is(err, service.ErrImageStudioFileInvalid) {
			return "", invalid("reference image must be a png, jpeg, gif or webp image")
		}
		if err != nil {
			return "", types.NewError(fmt.Errorf("failed to store reference image: %w", err), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		referenceURL, err := service.ImageStudioFileAbsoluteURL(key)
		if err != nil {
			return "", types.NewError(fmt.Errorf("failed to build reference image URL, check the image studio public base URL: %w", err), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		return referenceURL, nil
	}
	// Inline references are http(s) URLs, kept as they are, or base64 data
	// with or without a data URL prefix, which is published first.
	reference := func(value string) (string, *types.NewAPIError) {
		value = strings.TrimSpace(value)
		if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
			return value, nil
		}
		if strings.HasPrefix(value, "data:") {
			_, value, _ = strings.Cut(value, ";base64,")
		}
		data, err := base64.StdEncoding.DecodeString(value)
		if err != nil {
			return "", invalid("reference image must be an http(s) URL, a data URL or base64 data")
		}
		return publish(data)
	}

	var images []string
	if len(request.Image) > 0 {
		var values []string
		var single string
		if err := common.Unmarshal(request.Image, &single); err == nil {
			values = []string{single}
		} else if err := common.Unmarshal(request.Image, &values); err != nil {
			return nil, invalid("image must be a string or an array of strings")
		}
		for _, value := range values {
			referenceURL, apiErr := reference(value)
			if apiErr != nil {
				return nil, apiErr
			}
			images = append(images, referenceURL)
		}
	}
	var mask string
	if len(request.Mask) > 0 {
		var value string
		if err := common.Unmarshal(request.Mask, &value); err != nil {
			return nil, invalid("mask must be a string")
		}
		var apiErr *types.NewAPIError
		if mask, apiErr = reference(value); apiErr != nil {
			return nil, apiErr
		}
	}

	if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		form := c.Request.MultipartForm
		if form == nil {
			var err error
			if form, err = common.ParseMultipartFormReusable(c); err != nil {
				return nil, invalid(fmt.Sprintf("failed to parse image edit form request: %s", err.Error()))
			}
		}
		readFile := func(header *multipart.FileHeader) (string, *types.NewAPIError) {
			file, err := header.Open()
			if err != nil {
				return "", invalid(fmt.Sprintf("failed to open image file %s", header.Filename))
			}
			defer file.Close()
			data, err := io.ReadAll(file)
			if err != nil {
				return "", invalid(fmt.Sprintf("failed to read image file %s", header.Filename))
			}
			return publish(data)
		}
		// Same field precedence as the OpenAI form forwarder; indexed fields
		// are read in name order so image[0], image[1] keep their order.
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
			referenceURL, apiErr := readFile(header)
			if apiErr != nil {
				return nil, apiErr
			}
			images = append(images, referenceURL)
		}
		if masks := form.File["mask"]; len(masks) > 0 {
			var apiErr *types.NewAPIError
			if mask, apiErr = readFile(masks[0]); apiErr != nil {
				return nil, apiErr
			}
		}
		// Form validation only parsed the fields billing reads; carry the
		// remaining documented edit fields into the JSON body.
		values := url.Values(form.Value)
		request.ResponseFormat = cmp.Or(values.Get("response_format"), request.ResponseFormat)
		for field, target := range map[string]*json.RawMessage{
			"background":         &request.Background,
			"input_fidelity":     &request.InputFidelity,
			"moderation":         &request.Moderation,
			"output_compression": &request.OutputCompression,
			"output_format":      &request.OutputFormat,
			"partial_images":     &request.PartialImages,
			"user":               &request.User,
		} {
			value := values.Get(field)
			if value == "" {
				continue
			}
			if field == "output_compression" || field == "partial_images" {
				if _, err := strconv.Atoi(value); err != nil {
					return nil, invalid(field + " must be an integer")
				}
				*target = json.RawMessage(value)
				continue
			}
			*target, _ = common.Marshal(value)
		}
	}

	if len(images) == 0 {
		// Nothing to publish: a plain generation keeps its original shape.
		return func() {}, nil
	}
	request.Image, _ = common.Marshal(images)
	if mask != "" {
		request.Mask, _ = common.Marshal(mask)
	}

	contentType := c.Request.Header.Get("Content-Type")
	relayMode, requestURLPath := info.RelayMode, info.RequestURLPath
	c.Request.Header.Set("Content-Type", "application/json")
	if info.RelayMode == relayconstant.RelayModeImagesEdits {
		// Providers expose the image URL array on the generation endpoint;
		// adaptors that rewrite edit traffic map both paths to one route.
		info.RelayMode = relayconstant.RelayModeImagesGenerations
		info.RequestURLPath = strings.Replace(info.RequestURLPath, "/images/edits", "/images/generations", 1)
	}
	return func() {
		c.Request.Header.Set("Content-Type", contentType)
		info.RelayMode, info.RequestURLPath = relayMode, requestURLPath
	}, nil
}
