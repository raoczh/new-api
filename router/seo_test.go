package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const seoTestIndexPage = `<!doctype html><html lang="zh-CN"><head>
<!--seo:start-->
<title>placeholder</title>
<!--seo:end-->
</head><body></body></html>`

func withServerAddress(t *testing.T, address string) {
	t.Helper()
	previous := system_setting.ServerAddress
	system_setting.ServerAddress = address
	t.Cleanup(func() { system_setting.ServerAddress = previous })
}

func withBrand(t *testing.T, name, chineseName string) {
	t.Helper()
	previousName, previousChineseName := common.SystemName, common.SystemChineseName
	common.SystemName, common.SystemChineseName = name, chineseName
	t.Cleanup(func() {
		common.SystemName, common.SystemChineseName = previousName, previousChineseName
	})
}

func TestSEOPageForPath(t *testing.T) {
	withServerAddress(t, "https://tokencome.org")
	withBrand(t, "TokenCome", "杜康")

	tests := []struct {
		path      string
		exists    bool
		indexable bool
		title     string
	}{
		{"/", true, true, "TokenCome · 杜康 · AI 大模型 API 网关"},
		{"/about", true, true, "关于我们 - TokenCome · 杜康"},
		{"/privacy-policy/", true, true, "隐私政策 - TokenCome · 杜康"},
		{"/docs", true, true, "使用文档 - TokenCome · 杜康"},
		{"/docs/quickstart", true, true, "快速开始 - 使用文档 - TokenCome · 杜康"},
		{"/docs/does-not-exist", false, false, ""},
		{"/dashboard", true, false, "账户 - TokenCome · 杜康"},
		{"/keys/123", true, false, "账户 - TokenCome · 杜康"},
		{"/sign-in", true, false, "账户 - TokenCome · 杜康"},
		{"/pricing/some-model", true, false, "模型详情 - TokenCome · 杜康"},
		{"/security", false, false, ""},
		{"/random-page", false, false, ""},
	}

	for _, test := range tests {
		t.Run(test.path, func(t *testing.T) {
			page, exists := seoPageForPath(test.path)
			require.Equal(t, test.exists, exists)
			if !test.exists {
				return
			}
			assert.Equal(t, test.indexable, page.Indexable)
			assert.Equal(t, test.title, page.Title)
		})
	}
}

func TestInjectSEOHeadReplacesMarkerBlockAndEscapesValues(t *testing.T) {
	withServerAddress(t, "https://tokencome.org")
	withBrand(t, "TokenCome", "杜康")

	page := seoPage{
		Title:       `About <script>`,
		Description: `A "quoted" & <markup> description`,
		Indexable:   true,
	}
	body := string(injectSEOHead([]byte(seoTestIndexPage), page, "https://tokencome.org/about"))

	assert.NotContains(t, body, "placeholder")
	assert.Contains(t, body, "<title>About &lt;script&gt;</title>")
	assert.Contains(t, body, `content="A &#34;quoted&#34; &amp; &lt;markup&gt; description"`)
	assert.Contains(t, body, `<link rel="canonical" href="https://tokencome.org/about" />`)
	assert.Contains(t, body, `<meta name="robots" content="index, follow" />`)
	assert.Contains(t, body, `"@type":"WebPage"`)
}

func TestInjectSEOHeadMarksUnknownPagesNoIndex(t *testing.T) {
	withServerAddress(t, "https://tokencome.org")
	withBrand(t, "TokenCome", "杜康")

	body := string(injectSEOHead([]byte(seoTestIndexPage), seoNotFoundPage(), "https://tokencome.org/missing"))

	assert.Contains(t, body, `<meta name="robots" content="noindex, nofollow" />`)
	assert.Contains(t, body, "<title>页面不存在 - TokenCome · 杜康</title>")
}

func TestSEOResourcesUseConfiguredServerAddress(t *testing.T) {
	withServerAddress(t, "https://tokencome.org")

	robots := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(robots)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/robots.txt", nil)
	seoRobotsHandler(ctx)

	assert.Equal(t, http.StatusOK, robots.Code)
	assert.Contains(t, robots.Body.String(), "Sitemap: https://tokencome.org/sitemap.xml")
	assert.Contains(t, robots.Body.String(), "User-agent: GPTBot")

	sitemap := httptest.NewRecorder()
	ctx, _ = gin.CreateTestContext(sitemap)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/sitemap.xml", nil)
	seoSitemapHandler(ctx)

	body := sitemap.Body.String()
	assert.Equal(t, http.StatusOK, sitemap.Code)
	assert.Contains(t, body, "<loc>https://tokencome.org/</loc>")
	assert.Contains(t, body, "<loc>https://tokencome.org/docs/quickstart</loc>")
	assert.Contains(t, body, "<loc>https://tokencome.org/privacy-policy</loc>")
	assert.NotContains(t, body, "/dashboard")
	assert.NotContains(t, body, "your-model")
}

func TestSEOSiteURLFallsBackForLocalAddress(t *testing.T) {
	tests := map[string]string{
		"":                         seoFallbackSiteURL,
		"http://localhost:3000":    seoFallbackSiteURL,
		"https://tokencome.org/":   "https://tokencome.org",
		"https://tokencome.org/v1": "https://tokencome.org",
	}

	for address, expected := range tests {
		t.Run(address, func(t *testing.T) {
			withServerAddress(t, address)
			assert.Equal(t, expected, seoSiteURL())
		})
	}
}

func TestWebRouterServesInjectedHeadAndReal404(t *testing.T) {
	withServerAddress(t, "https://tokencome.org")
	withBrand(t, "TokenCome", "杜康")
	gin.SetMode(gin.TestMode)
	outer := gin.New()
	SetWebRouter(outer, WebAssets{IndexPage: []byte(seoTestIndexPage)}, func(c *gin.Context) { c.Next() })

	home := performPluginRequest(outer, http.MethodGet, "/")
	assert.Equal(t, http.StatusOK, home.Code)
	assert.Contains(t, home.Body.String(), "<title>TokenCome · 杜康 · AI 大模型 API 网关</title>")
	assert.Equal(t, "no-cache", home.Header().Get("Cache-Control"))

	docs := performPluginRequest(outer, http.MethodGet, "/docs/quickstart")
	assert.Equal(t, http.StatusOK, docs.Code)
	assert.Contains(t, docs.Body.String(), "快速开始")

	missing := performPluginRequest(outer, http.MethodGet, "/no-such-page")
	assert.Equal(t, http.StatusNotFound, missing.Code)
	assert.True(t, strings.Contains(missing.Body.String(), "noindex"))
	assert.Equal(t, "no-store", missing.Header().Get("Cache-Control"))
}

func TestWebRouterServesRobotsSitemapAndLLMs(t *testing.T) {
	withServerAddress(t, "https://tokencome.org")
	withBrand(t, "TokenCome", "杜康")
	gin.SetMode(gin.TestMode)
	outer := gin.New()
	SetWebRouter(outer, WebAssets{IndexPage: []byte(seoTestIndexPage)}, func(c *gin.Context) { c.Next() })

	for _, test := range []struct {
		path        string
		contentType string
		contains    string
	}{
		{"/robots.txt", "text/plain", "Sitemap: https://tokencome.org/sitemap.xml"},
		{"/sitemap.xml", "application/xml", "<loc>https://tokencome.org/docs</loc>"},
		{"/llms.txt", "text/plain", "# TokenCome · 杜康"},
	} {
		t.Run(test.path, func(t *testing.T) {
			response := performPluginRequest(outer, http.MethodGet, test.path)
			assert.Equal(t, http.StatusOK, response.Code)
			assert.Contains(t, response.Header().Get("Content-Type"), test.contentType)
			assert.Contains(t, response.Body.String(), test.contains)
		})
	}
}
