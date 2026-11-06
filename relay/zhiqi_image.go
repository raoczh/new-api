package relay

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// The explicit engine flag selects the public Zhiqi protocol independently of
// the channel's legacy type. Shared transport settings and overrides still apply.
type zhiqiImageAdaptor struct {
	openai.Adaptor
}

func (adaptor *zhiqiImageAdaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseURL := strings.TrimRight(info.ChannelBaseUrl, "/")
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.User != nil {
		return "", errors.New("Zhiqi channel base URL must be an absolute HTTP(S) API base URL")
	}
	requestPath := info.RequestURLPath
	if strings.HasSuffix(baseURL, "/v1") {
		requestPath = strings.TrimPrefix(requestPath, "/v1")
	}
	return baseURL + requestPath, nil
}

func (adaptor *zhiqiImageAdaptor) SetupRequestHeader(context *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, context, header)
	header.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (adaptor *zhiqiImageAdaptor) DoRequest(context *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(adaptor, context, info, requestBody)
}

// buildZhiqiImageRequest never changes the cached client body, so a fallback
// channel receives its own protocol rather than the previous channel's form.
func buildZhiqiImageRequest(context *gin.Context, info *relaycommon.RelayInfo, mappedModel string) (*helper.ZhiqiImageRequest, []byte, string, string, error) {
	incoming, err := helper.ReadZhiqiImageRequest(context)
	if err != nil {
		return nil, nil, "", "", err
	}
	request := *incoming
	request.Model = mappedModel
	encoded, err := common.Marshal(request)
	if err != nil {
		return nil, nil, "", "", err
	}
	var parameters map[string]json.RawMessage
	if err := common.Unmarshal(encoded, &parameters); err != nil {
		return nil, nil, "", "", err
	}
	if len(incoming.References) > 0 {
		references := make([]string, 0, len(incoming.References))
		for _, reference := range incoming.References {
			publicURL, err := publishZhiqiImageReference(context, reference)
			if err != nil {
				return nil, nil, "", "", err
			}
			references = append(references, publicURL)
		}
		parameters["image"], err = common.Marshal(references)
		if err != nil {
			return nil, nil, "", "", err
		}
	}
	if incoming.Mask != nil {
		publicURL, err := publishZhiqiImageReference(context, *incoming.Mask)
		if err != nil {
			return nil, nil, "", "", err
		}
		parameters["mask"], err = common.Marshal(publicURL)
		if err != nil {
			return nil, nil, "", "", err
		}
	}
	if len(info.ParamOverride) > 0 {
		encoded, err = common.Marshal(parameters)
		if err != nil {
			return nil, nil, "", "", err
		}
		encoded, err = relaycommon.ApplyParamOverrideWithRelayInfo(encoded, info)
		if err != nil {
			return nil, nil, "", "", newAPIErrorFromParamOverride(err)
		}
		if err := common.Unmarshal(encoded, &parameters); err != nil {
			return nil, nil, "", "", err
		}
	}
	finalRequest, err := helper.DecodeZhiqiImageRequest(parameters)
	if err != nil {
		return nil, nil, "", "", err
	}
	if err := finalRequest.Validate(strings.HasSuffix(context.Request.URL.Path, "/edits")); err != nil {
		return nil, nil, "", "", err
	}
	// Zhiqi owns the model-specific pixel mapping. A complete pair supersedes
	// size, including for the scalar pricing snapshot used on this attempt.
	if finalRequest.Resolution != nil && finalRequest.AspectRatio != nil {
		finalRequest.Size = nil
		delete(parameters, "size")
	}
	if len(finalRequest.References) == 0 {
		delete(parameters, "image")
		delete(parameters, "mask")
		encoded, err = common.Marshal(parameters)
		return finalRequest, encoded, "application/json", "/v1/images/generations", err
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for field, value := range parameters {
		if field == "image" || field == "mask" || string(value) == "null" {
			continue
		}
		fieldValue := string(value)
		if len(value) > 0 && value[0] == '"' {
			if err := common.Unmarshal(value, &fieldValue); err != nil {
				return nil, nil, "", "", err
			}
		}
		if err := writer.WriteField(field, fieldValue); err != nil {
			return nil, nil, "", "", err
		}
	}
	for _, reference := range finalRequest.References {
		publicURL, err := publishZhiqiImageReference(context, reference)
		if err != nil {
			return nil, nil, "", "", err
		}
		if err := writer.WriteField("image", publicURL); err != nil {
			return nil, nil, "", "", err
		}
	}
	if finalRequest.Mask != nil {
		publicURL, err := publishZhiqiImageReference(context, *finalRequest.Mask)
		if err != nil {
			return nil, nil, "", "", err
		}
		if err := writer.WriteField("mask", publicURL); err != nil {
			return nil, nil, "", "", err
		}
	}
	if err := writer.Close(); err != nil {
		return nil, nil, "", "", err
	}
	return finalRequest, body.Bytes(), writer.FormDataContentType(), "/v1/images/edits", nil
}

func publishZhiqiImageReference(context *gin.Context, reference helper.ZhiqiImageReference) (string, error) {
	if err := reference.Validate(); err != nil {
		return "", err
	}
	data := reference.Data
	if data == nil {
		value := strings.TrimSpace(reference.Value)
		if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
			return value, nil
		}
		if strings.HasPrefix(value, "data:") {
			var found bool
			_, value, found = strings.Cut(value, ";base64,")
			if !found {
				return "", errors.New("reference image data URLs must use Base64 encoding")
			}
		}
		var err error
		data, err = base64.StdEncoding.DecodeString(value)
		if err != nil {
			return "", errors.New("reference image must be an HTTP(S) URL, data URL or Base64 image")
		}
	}
	if len(data) == 0 || len(data) > helper.ZhiqiMaxReferenceBytes {
		return "", errors.New("reference images must contain between 1 byte and 20 MB")
	}
	cache, _ := common.GetContextKeyType[map[[32]byte]string](context, "_zhiqi_published_references")
	if cache == nil {
		cache = make(map[[32]byte]string)
		context.Set("_zhiqi_published_references", cache)
	}
	digest := sha256.Sum256(data)
	if publicURL := cache[digest]; publicURL != "" {
		return publicURL, nil
	}
	key, err := service.SaveImageStudioBytes(data)
	if err != nil {
		return "", fmt.Errorf("failed to publish reference image: %w", err)
	}
	publicURL, err := service.ImageStudioFileAbsoluteURL(key)
	if err != nil {
		_ = service.DeleteImageStudioFile(key)
		return "", fmt.Errorf("configure a publicly reachable Image Studio URL before using Zhiqi reference images: %w", err)
	}
	cache[digest] = publicURL
	return publicURL, nil
}
