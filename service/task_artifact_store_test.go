package service

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDisabledTaskArtifactStoreHasNoStorageBehavior(t *testing.T) {
	store := GetTaskArtifactStore()
	require.NotNil(t, store)
	assert.False(t, store.Enabled())

	task := &model.Task{TaskID: "task-disabled-store"}
	ref, err := store.Resolve(task, "video")
	require.NoError(t, err)
	assert.Nil(t, ref)

	ref, err = store.Persist(t.Context(), task, types.TaskArtifact{Key: "video", Type: "video"}, strings.NewReader("content"))
	assert.Nil(t, ref)
	assert.ErrorIs(t, err, ErrTaskArtifactStoreDisabled)
	assert.ErrorIs(t, store.Serve(&gin.Context{}, task, &StoredArtifactRef{Backend: "s3"}), ErrTaskArtifactStoreDisabled)
	assert.Same(t, store, GetTaskArtifactStore())
}

var _ TaskArtifactStore = disabledArtifactStore{}

func configureImageStudioTestStorage(t *testing.T) {
	t.Helper()
	settings := system_setting.GetImageStudioSettings()
	previous := *settings
	settings.StorageDir = t.TempDir()
	settings.PublicBaseURL = "https://images.example.test"
	t.Cleanup(func() { *settings = previous })
}

func TestImageStudioStaticSVGResultValidation(t *testing.T) {
	configureImageStudioTestStorage(t)
	const root = `<svg xmlns="http://www.w3.org/2000/svg">`
	for _, testCase := range []struct {
		name    string
		payload string
	}{
		{"plain geometry", root + `<path d="M0 0L10 10Z" fill="#0af"/><text x="1" y="2">A &amp; B</text></svg>`},
		{"local paints", `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="20" height="20" viewBox="0 0 20 20"><defs><linearGradient id="paint"><stop offset="0%" stop-color="blue"/><stop offset="100%" stop-color="white"/></linearGradient><linearGradient id="copy" xlink:href="#paint"/><clipPath id="clip"><circle cx="10" cy="10" r="8"/></clipPath></defs><g transform="translate(1, 1)"><rect width="18" height="18" fill="url(#copy)" clip-path="url(#clip)"/></g></svg>`},
		{"namespace prefix and bom", "\xef\xbb\xbf" + `<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:rect width="1" height="1"/></s:svg>`},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			payload := []byte(testCase.payload)
			key, err := SaveImageStudioResultBytes(payload)
			require.NoError(t, err)
			assert.Equal(t, ".svg", filepath.Ext(key))
			require.NoError(t, ValidateImageStudioKey(key))
			assert.Equal(t, "https://images.example.test/"+key, ImageStudioFileURL(key))
			file, info, err := OpenImageStudioFile(key)
			require.NoError(t, err)
			stored, err := io.ReadAll(file)
			require.NoError(t, file.Close())
			require.NoError(t, err)
			assert.Equal(t, int64(len(payload)), info.Size())
			assert.Equal(t, payload, stored)
			_, err = SaveImageStudioBytes(payload)
			assert.ErrorIs(t, err, ErrImageStudioFileInvalid)
			_, err = SaveImageStudioReader(bytes.NewReader(payload), 1<<20)
			assert.ErrorIs(t, err, ErrImageStudioFileInvalid)
			_, err = ImageStudioFileAbsoluteURL(key)
			assert.ErrorIs(t, err, ErrImageStudioFileInvalid)
		})
	}

	for _, testCase := range []struct {
		name    string
		payload string
	}{
		{"script", root + `<script>alert(1)</script></svg>`},
		{"foreign object", root + `<foreignObject><div>html</div></foreignObject></svg>`},
		{"event attribute", root + `<rect onload="alert(1)"/></svg>`},
		{"namespace event", `<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg" s:onload="alert(1)"/>`},
		{"stylesheet", root + `<style>@import "//evil.test/a.css";</style></svg>`},
		{"inline style", root + `<rect style="fill:url(//evil.test/a.svg)"/></svg>`},
		{"benign style still unsupported", root + `<rect style="fill:blue"/></svg>`},
		{"external paint", root + `<rect fill="url(https://evil.test/a.svg#p)"/></svg>`},
		{"relative paint", root + `<rect fill="url(a.svg#p)"/></svg>`},
		{"escaped CSS url", root + `<rect fill="u\72l(//evil.test/a.svg)"/></svg>`},
		{"encoded external paint", root + `<rect fill="url(&#x2f;&#x2f;evil.test/a.svg)"/></svg>`},
		{"data paint", root + `<rect fill="url(data:image/svg+xml;base64,PHN2Zz4=)"/></svg>`},
		{"external href", root + `<linearGradient href="//evil.test/a.svg#p"/></svg>`},
		{"external xlink", `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><linearGradient xlink:href="a.svg#p"/></svg>`},
		{"dynamic href", root + `<linearGradient id="paint"><animate attributeName="href" values="#p;https://evil.test/a.svg"/></linearGradient></svg>`},
		{"dynamic set", root + `<set attributeName="onload" to="alert(1)"/></svg>`},
		{"image reference", root + `<image href="data:image/svg+xml;base64,PHN2Zz4="/></svg>`},
		{"use expansion", root + `<use href="#recursive" id="recursive"/></svg>`},
		{"hyperlink", root + `<a href="javascript:alert(1)"><text>click</text></a></svg>`},
		{"xml base", root + `<g xml:base="https://evil.test/"><rect fill="url(#paint)"/></g></svg>`},
		{"doctype", `<!DOCTYPE svg SYSTEM "https://evil.test/a.dtd">` + root + `</svg>`},
		{"entity declaration", `<!DOCTYPE svg [<!ENTITY a "boom">]>` + root + `<text>&a;</text></svg>`},
		{"stylesheet PI", `<?xml-stylesheet href="https://evil.test/a.css"?>` + root + `</svg>`},
		{"nested xml PI", root + `<?xml version="1.0"?></svg>`},
		{"malformed declaration", `<?xml version="1.0" arbitrary="x"?>` + root + `</svg>`},
		{"missing namespace", `<svg><rect/></svg>`},
		{"wrong namespace", `<svg xmlns="http://www.w3.org/1999/xhtml"/>`},
		{"nested namespace reset", root + `<g xmlns=""><rect/></g></svg>`},
		{"undeclared namespace", root + `<s:rect/></svg>`},
		{"unknown namespace declaration", `<svg xmlns="http://www.w3.org/2000/svg" xmlns:html="http://www.w3.org/1999/xhtml"/>`},
		{"wrong root", `<rect xmlns="http://www.w3.org/2000/svg"/>`},
		{"multiple roots", root + `</svg>` + root + `</svg>`},
		{"unclosed root", root},
		{"duplicate attributes", root + `<rect fill="red" fill="blue"/></svg>`},
		{"text outside root", "outside" + root + `</svg>`},
		{"excessive depth", root + strings.Repeat("<g>", 64) + strings.Repeat("</g>", 64) + `</svg>`},
		{"excessive elements", root + strings.Repeat("<path/>", 10000) + `</svg>`},
		{"excessive bytes", root + strings.Repeat(" ", 4<<20) + `</svg>`},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			key, err := SaveImageStudioResultBytes([]byte(testCase.payload))
			assert.ErrorIs(t, err, ErrImageStudioFileInvalid)
			assert.Empty(t, key)
		})
	}

	for _, key := range []string{"img/raw.svg", "img/abc/raw.svg", "img/xyz/abcdefghijklmnopqrstuvwxyzABCDEF.svg", "img/abc/abcdefghijklmnopqrstuvwxyzABCDE_.svg"} {
		assert.ErrorIs(t, ValidateImageStudioKey(key), ErrImageStudioFileNotFound)
	}
	key, err := SaveImageStudioResultBytes([]byte(root + `</svg>`))
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(imageStudioPath(key), []byte(root+`<script/></svg>`), 0o644))
	file, _, err := OpenImageStudioFile(" " + key + " ")
	assert.ErrorIs(t, err, ErrImageStudioFileInvalid)
	assert.Nil(t, file)
}

func TestImageStudioRasterPathsPreservePayload(t *testing.T) {
	configureImageStudioTestStorage(t)
	pixels := image.NewRGBA(image.Rect(0, 0, 2, 2))
	pixels.Set(0, 0, color.RGBA{R: 255, A: 255})
	var pngPayload, jpegPayload, gifPayload bytes.Buffer
	require.NoError(t, png.Encode(&pngPayload, pixels))
	require.NoError(t, jpeg.Encode(&jpegPayload, pixels, nil))
	palette := color.Palette{color.Black, color.White}
	firstFrame := image.NewPaletted(image.Rect(0, 0, 2, 2), palette)
	secondFrame := image.NewPaletted(image.Rect(0, 0, 2, 2), palette)
	secondFrame.SetColorIndex(0, 0, 1)
	require.NoError(t, gif.EncodeAll(&gifPayload, &gif.GIF{Image: []*image.Paletted{firstFrame, secondFrame}, Delay: []int{8, 20}, LoopCount: 3}))
	webpPayload, err := base64.StdEncoding.DecodeString("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA")
	require.NoError(t, err)
	for _, testCase := range []struct {
		extension string
		payload   []byte
	}{
		{".png", pngPayload.Bytes()}, {".jpg", jpegPayload.Bytes()}, {".gif", gifPayload.Bytes()}, {".webp", webpPayload},
	} {
		t.Run(testCase.extension, func(t *testing.T) {
			for _, save := range []func([]byte) (string, error){SaveImageStudioBytes, SaveImageStudioResultBytes} {
				key, err := save(testCase.payload)
				require.NoError(t, err)
				assert.Equal(t, testCase.extension, filepath.Ext(key))
				file, _, err := OpenImageStudioFile(key)
				require.NoError(t, err)
				stored, err := io.ReadAll(file)
				require.NoError(t, file.Close())
				require.NoError(t, err)
				assert.Equal(t, testCase.payload, stored)
				referenceURL, err := ImageStudioFileAbsoluteURL(key)
				require.NoError(t, err)
				assert.Equal(t, "https://images.example.test/"+key, referenceURL)
				if testCase.extension == ".gif" {
					animation, err := gif.DecodeAll(bytes.NewReader(stored))
					require.NoError(t, err)
					assert.Len(t, animation.Image, 2)
					assert.Equal(t, []int{8, 20}, animation.Delay)
					assert.Equal(t, 3, animation.LoopCount)
				}
			}
			_, err := SaveImageStudioReader(bytes.NewReader(testCase.payload), int64(len(testCase.payload)-1))
			assert.ErrorIs(t, err, common.ErrRequestBodyTooLarge)
		})
	}
}

func TestPersistImageStudioResultsPayloadSemantics(t *testing.T) {
	configureImageStudioTestStorage(t)
	const firstSVG = `<svg xmlns="http://www.w3.org/2000/svg"><circle r="1" fill="red"/></svg>`
	const secondSVG = `<svg xmlns="http://www.w3.org/2000/svg"><circle r="2" fill="blue"/></svg>`
	firstBase64 := base64.StdEncoding.EncodeToString([]byte(firstSVG))
	secondBase64 := base64.StdEncoding.EncodeToString([]byte(secondSVG))
	var downloads atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		downloads.Add(1)
		writer.Header().Set("Content-Type", "image/svg+xml")
		switch request.URL.Path {
		case "/first.svg":
			_, _ = io.WriteString(writer, firstSVG)
		case "/second.svg":
			_, _ = io.WriteString(writer, secondSVG)
		case "/script.svg":
			_, _ = io.WriteString(writer, `<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>`)
		case "/oversize.svg":
			writer.Header().Set("Content-Length", "2097152")
		default:
			writer.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)
	fetchSettings := system_setting.GetFetchSetting()
	previousFetch := *fetchSettings
	previousClient, previousWorker, previousLimit := ssrfProtectedHTTPClient, system_setting.WorkerUrl, constant.MaxFileDownloadMB
	t.Cleanup(func() {
		*fetchSettings = previousFetch
		ssrfProtectedHTTPClient, system_setting.WorkerUrl, constant.MaxFileDownloadMB = previousClient, previousWorker, previousLimit
	})
	serverURL, err := url.Parse(server.URL)
	require.NoError(t, err)
	*fetchSettings = system_setting.FetchSetting{EnableSSRFProtection: true, AllowPrivateIp: true, AllowedPorts: []string{serverURL.Port()}}
	ssrfProtectedHTTPClient, system_setting.WorkerUrl, constant.MaxFileDownloadMB = server.Client(), "", 1
	firstURL, secondURL := server.URL+"/first.svg", server.URL+"/second.svg"
	for _, testCase := range []struct {
		name      string
		data      any
		expected  []string
		downloads int64
		wantError bool
	}{
		{"object url", map[string]string{"url": firstURL}, []string{firstSVG}, 1, false},
		{"object base64", map[string]string{"b64_json": firstBase64}, []string{firstSVG}, 0, false},
		{"split image", []any{map[string]string{"url": firstURL}, map[string]string{"b64_json": firstBase64}, map[string]string{"revised_prompt": "not an image"}}, []string{firstSVG}, 0, false},
		{"both payloads", []any{map[string]string{"url": firstURL, "b64_json": firstBase64}}, []string{firstSVG}, 0, false},
		{"url majority", []any{map[string]string{"url": firstURL}, map[string]string{"url": secondURL}, map[string]string{"b64_json": firstBase64}}, []string{firstSVG, secondSVG}, 2, false},
		{"base64 majority", []any{map[string]string{"url": firstURL}, map[string]string{"b64_json": firstBase64}, map[string]string{"b64_json": secondBase64}}, []string{firstSVG, secondSVG}, 0, false},
		{"data uri", map[string]string{"b64_json": "data:image/svg+xml;base64," + firstBase64}, []string{firstSVG}, 0, false},
		{"payloadless object", map[string]string{"revised_prompt": "not an image"}, nil, 0, true},
		{"payloadless array", []any{nil, map[string]string{"url": "  ", "b64_json": "\n", "revised_prompt": "not an image"}}, nil, 0, true},
		{"unsafe remote SVG", map[string]string{"url": server.URL + "/script.svg"}, nil, 1, true},
		{"oversize remote SVG", map[string]string{"url": server.URL + "/oversize.svg"}, nil, 1, true},
		{"invalid base64", map[string]string{"b64_json": "not base64!"}, nil, 0, true},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			downloads.Store(0)
			body, err := common.Marshal(map[string]any{"data": testCase.data})
			require.NoError(t, err)
			keys, total, err := persistImageStudioResults(body)
			if testCase.wantError {
				require.Error(t, err)
				assert.Empty(t, keys)
				assert.Zero(t, total)
			} else {
				require.NoError(t, err)
				require.Len(t, keys, len(testCase.expected))
				assert.Equal(t, len(testCase.expected), total)
				for index, key := range keys {
					stored, err := os.ReadFile(imageStudioPath(key))
					require.NoError(t, err)
					assert.Equal(t, testCase.expected[index], string(stored))
				}
			}
			assert.Equal(t, testCase.downloads, downloads.Load())
		})
	}
	downloads.Store(0)
	fetchSettings.AllowPrivateIp = false
	body, err := common.Marshal(map[string]any{"data": map[string]string{"url": firstURL}})
	require.NoError(t, err)
	keys, total, err := persistImageStudioResults(body)
	require.Error(t, err)
	assert.Empty(t, keys)
	assert.Zero(t, total)
	assert.Zero(t, downloads.Load())
}
