package router

import (
	"bytes"
	"fmt"
	"html"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// The Go server owns the document head for every HTML response. The frontend
// build ships a placeholder block between these markers; the same index.html
// still works untouched in dev and in tests without markers.
const (
	seoStartMarker = "<!--seo:start-->"
	seoEndMarker   = "<!--seo:end-->"

	// Used when ServerAddress is empty or points at a local address.
	seoFallbackSiteURL = "https://tokencome.org"

	seoHomeDescription = "TokenCome（杜康）是面向开发者的 AI 大模型 API 网关：一个 Base URL 同时兼容 OpenAI、Anthropic Claude 与 Google Gemini 协议，统一管理密钥、额度与用量。"
)

type seoPage struct {
	Title       string
	Description string
	Indexable   bool
	Article     bool
}

// seoDocsPage is one documentation page. Slugs match the frontend routes.
type seoDocsPage struct {
	Slug        string
	Title       string
	Description string
}

var seoDocsPages = []seoDocsPage{
	{"", "介绍", "本站是什么、该填哪个地址，以及一把密钥可以调用的三种接口协议。"},
	{"apikey", "API 密钥", "创建密钥、设置限制并妥善保管。"},
	{"quickstart", "快速开始", "先验证密钥，再用 curl、PowerShell、Python 或 Node.js 发出第一条消息。"},
	{"models", "模型广场", "查找准确的模型 ID、模型支持的接口类型以及各分组价格。"},
	{"config/ccswitch", "CC Switch（推荐）", "一键把本站导入 Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw 和 Hermes。"},
	{"config/claude-code", "手动配置 Claude Code", "用环境变量或 settings.json 让 Claude Code 命令行与 VS Code 插件连接本站。"},
	{"config/codex", "手动配置 Codex", "Codex 命令行、IDE 插件和桌面 App 共用同一份 config.toml。"},
	{"config/agents", "其他 AI 智能体", "OpenClaw、Hermes Agent、DeepSeek Harness、OpenCode 和 Gemini CLI。"},
	{"config/ide", "IDE 与编程工具", "Cursor、Cline、Roo Code、Kilo Code、Continue、Trae 等编辑器。"},
	{"config/office", "聊天、办公与翻译软件", "WorkBuddy、Cherry Studio、Chatbox、沉浸式翻译等日常软件。"},
	{"api/index", "API 兼容协议", "网关提供的全部接口，以及它们分别属于哪种协议。"},
	{"api/authentication", "鉴权", "各协议用哪个请求头携带密钥。"},
	{"api/chat", "Chat Completions 与 Responses", "OpenAI 兼容的文本对话接口。"},
	{"api/messages", "Messages API", "Claude Code 和 Anthropic SDK 使用的 Anthropic 兼容接口。"},
	{"api/gemini", "Gemini API", "供 Google GenAI SDK 和 Gemini CLI 使用的 Gemini 原生接口。"},
	{"api/media", "图像、音频与视频", "图像生成、语音以及异步视频任务。"},
	{"api/models", "模型列表", "列出密钥可以调用的模型。"},
	{"api/errors", "错误码", "各状态码与错误码的含义及处理方法。"},
	{"guides/streaming", "流式响应", "通过 SSE 逐字接收模型输出。"},
	{"guides/error-handling", "错误处理与重试", "网关会自动重试哪些错误、你的程序该重试哪些，以及排查步骤。"},
	{"guides/rate-limits", "速率限制与额度", "可能拦住请求的各类限制，以及如何区分它们。"},
	{"guides/billing", "计费与余额", "请求如何计价，以及在哪里查看消费。"},
}

// seoStaticPages are public pages that are not documentation.
var seoStaticPages = []struct {
	Path        string
	Title       string
	Description string
	Priority    string
	Module      string
}{
	{"/about", "关于我们", "了解 TokenCome（杜康）的定位、能力与联系方式。", "0.6", "about"},
	{"/pricing", "模型广场", "查看模型广场中的可用模型、接口类型与分组价格。", "0.8", "pricing"},
	{"/status-monitor", "状态监控", "查看各模型分组与上游渠道的实时可用性。", "0.5", "statusMonitor"},
	{"/iq-monitor", "智商监控", "查看模型定期生成的 SVG 结果，识别输出退化或异常。", "0.4", "iqMonitor"},
	{"/terms-of-service", "服务条款", "TokenCome（杜康）服务条款，说明使用本站服务时的权利与义务。", "0.3", ""},
	{"/privacy-policy", "隐私政策", "TokenCome（杜康）隐私政策，说明数据的收集、使用与保护方式。", "0.3", ""},
	{"/acceptable-use", "使用政策", "TokenCome（杜康）使用政策，说明允许与禁止的使用方式。", "0.3", ""},
	{"/disclaimer", "免责声明", "TokenCome（杜康）免责声明。", "0.3", ""},
	{"/refund-policy", "退款政策", "TokenCome（杜康）退款政策。", "0.3", ""},
	{"/data-processing-agreement", "数据处理协议", "TokenCome（杜康）数据处理协议。", "0.3", ""},
	{"/compliance", "合规与业务说明", "TokenCome（杜康）合规与业务说明。", "0.3", ""},
	{"/supported-regions", "支持的国家和地区", "TokenCome（杜康）支持的国家和地区。", "0.3", ""},
}

// seoPrivatePrefixes are real SPA routes that must answer 200 but must never be
// indexed: authenticated console areas, account flows and error pages.
var seoPrivatePrefixes = []string{
	"/dashboard",
	"/keys",
	"/wallet",
	"/usage-logs",
	"/models",
	"/channels",
	"/users",
	"/profile",
	"/playground",
	"/system-settings",
	"/system-info",
	"/tickets",
	"/ticket-management",
	"/redemption-codes",
	"/subscriptions",
	"/task-plugins",
	"/workbench",
	"/chat",
	"/chat2link",
	"/errors",
	"/console",
	"/oauth",
	"/user",
	"/setup",
	"/sign-in",
	"/sign-up",
	"/register",
	"/forgot-password",
	"/reset",
	"/otp",
	"/login",
	"/forbidden",
	"/401",
	"/403",
	"/404",
	"/500",
	"/503",
}

// seoSiteURL resolves the public origin used in canonical URLs, Open Graph and
// the sitemap. Operators configure it once as ServerAddress.
func seoSiteURL() string {
	raw := strings.TrimSpace(system_setting.ServerAddress)
	if raw == "" {
		return seoFallbackSiteURL
	}
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil {
		return seoFallbackSiteURL
	}
	switch strings.ToLower(parsed.Hostname()) {
	case "localhost", "127.0.0.1", "::1":
		return seoFallbackSiteURL
	}
	path := strings.TrimSuffix(strings.TrimSuffix(parsed.Path, "/"), "/v1")
	return parsed.Scheme + "://" + parsed.Host + path
}

// seoBrandName is the configured system name plus its optional Chinese name.
// The operator sets both in the site settings; the Chinese name is optional.
func seoBrandName() string {
	name := strings.TrimSpace(common.SystemName)
	chineseName := strings.TrimSpace(common.SystemChineseName)
	if name == "" {
		return chineseName
	}
	if chineseName == "" || strings.Contains(name, chineseName) {
		return name
	}
	return name + " · " + chineseName
}

func seoTitle(pageTitle string) string {
	brand := seoBrandName()
	if pageTitle == "" || strings.Contains(pageTitle, brand) {
		return pageTitle
	}
	return pageTitle + " - " + brand
}

func seoModulePublic(module string) bool {
	if module == "" {
		return true
	}
	return middleware.HeaderNavModulePublic(module)
}

// seoPageForPath maps a request path to its head metadata. The bool is false
// for paths the SPA does not define, which must answer 404 instead of a soft
// 200 so crawlers drop dead URLs.
func seoPageForPath(path string) (seoPage, bool) {
	normalized := seoNormalizePath(path)

	if normalized == "/" {
		return seoPage{
			Title:       seoBrandName() + " · AI 大模型 API 网关",
			Description: seoHomeDescription,
			Indexable:   true,
		}, true
	}

	if normalized == "/docs" {
		return seoPage{
			Title:       seoTitle("使用文档"),
			Description: "TokenCome（杜康）使用文档：快速开始、客户端配置、API 参考与计费说明。",
			Indexable:   true,
		}, true
	}
	if slug, ok := strings.CutPrefix(normalized, "/docs/"); ok {
		for _, doc := range seoDocsPages {
			if doc.Slug == slug {
				return seoPage{
					Title:       seoTitle(doc.Title + " - 使用文档"),
					Description: doc.Description,
					Indexable:   true,
					Article:     true,
				}, true
			}
		}
		return seoNotFoundPage(), false
	}

	for _, page := range seoStaticPages {
		if normalized != page.Path {
			continue
		}
		return seoPage{
			Title:       seoTitle(page.Title),
			Description: page.Description,
			Indexable:   seoModulePublic(page.Module),
		}, true
	}

	// Model detail pages are real routes but carry no server-rendered content.
	if strings.HasPrefix(normalized, "/pricing/") {
		return seoPage{
			Title:       seoTitle("模型详情"),
			Description: "查看模型支持的接口类型、分组与价格。",
			Indexable:   false,
		}, true
	}

	if normalized == "/user-agreement" {
		return seoPage{
			Title:       seoTitle("服务条款"),
			Description: "TokenCome（杜康）服务条款。",
			Indexable:   false,
		}, true
	}

	for _, prefix := range seoPrivatePrefixes {
		if normalized == prefix || strings.HasPrefix(normalized, prefix+"/") {
			return seoPage{
				Title:       seoTitle("账户"),
				Description: "TokenCome（杜康）账户与控制台页面。",
				Indexable:   false,
			}, true
		}
	}

	return seoPage{}, false
}

func seoNotFoundPage() seoPage {
	return seoPage{
		Title:       seoTitle("页面不存在"),
		Description: "你访问的页面不存在或已被移除。",
		Indexable:   false,
	}
}

func seoNormalizePath(path string) string {
	if path == "" {
		return "/"
	}
	if path != "/" {
		path = strings.TrimRight(path, "/")
		if path == "" {
			return "/"
		}
	}
	return path
}

func seoRobotsMeta(page seoPage) string {
	if page.Indexable {
		return "index, follow"
	}
	return "noindex, nofollow"
}

// injectSEOHead replaces the marker block in index.html with per-route tags.
// An index page without markers is returned untouched.
func injectSEOHead(indexPage []byte, page seoPage, canonical string) []byte {
	start := bytes.Index(indexPage, []byte(seoStartMarker))
	if start < 0 {
		return indexPage
	}
	end := bytes.Index(indexPage[start:], []byte(seoEndMarker))
	if end < 0 {
		return indexPage
	}
	end += start

	var body strings.Builder
	body.Grow(len(indexPage) + 1024)
	body.Write(indexPage[:start+len(seoStartMarker)])
	body.WriteString("\n")
	body.WriteString(seoHeadHTML(page, canonical))
	body.Write(indexPage[end:])
	return []byte(body.String())
}

func seoHeadHTML(page seoPage, canonical string) string {
	site := seoSiteURL()
	title := seoEscape(page.Title)
	description := seoEscape(page.Description)
	pageURL := seoEscape(canonical)
	image := seoEscape(site + "/og-image.png")
	ogType := "website"
	if page.Article {
		ogType = "article"
	}

	var b strings.Builder
	fmt.Fprintf(&b, "<title>%s</title>\n", title)
	fmt.Fprintf(&b, `<meta name="description" content="%s" />`+"\n", description)
	fmt.Fprintf(&b, `<meta name="robots" content="%s" />`+"\n", seoRobotsMeta(page))
	fmt.Fprintf(&b, `<link rel="canonical" href="%s" />`+"\n", pageURL)
	fmt.Fprintf(&b, `<meta property="og:type" content="%s" />`+"\n", ogType)
	fmt.Fprintf(&b, `<meta property="og:site_name" content="%s" />`+"\n", seoEscape(seoBrandName()))
	b.WriteString(`<meta property="og:locale" content="zh_CN" />` + "\n")
	fmt.Fprintf(&b, `<meta property="og:title" content="%s" />`+"\n", title)
	fmt.Fprintf(&b, `<meta property="og:description" content="%s" />`+"\n", description)
	fmt.Fprintf(&b, `<meta property="og:url" content="%s" />`+"\n", pageURL)
	fmt.Fprintf(&b, `<meta property="og:image" content="%s" />`+"\n", image)
	b.WriteString(`<meta name="twitter:card" content="summary" />` + "\n")
	fmt.Fprintf(&b, `<meta name="twitter:title" content="%s" />`+"\n", title)
	fmt.Fprintf(&b, `<meta name="twitter:description" content="%s" />`+"\n", description)
	fmt.Fprintf(&b, `<meta name="twitter:image" content="%s" />`+"\n", image)
	b.WriteString(seoJSONLD(page, canonical))
	return b.String()
}

// seoJSONLD emits schema.org data. Home carries Organization, WebSite,
// SoftwareApplication and (when configured) FAQPage; documentation pages carry
// TechArticle; everything else is a WebPage.
func seoJSONLD(page seoPage, canonical string) string {
	site := seoSiteURL()
	organizationID := site + "/#organization"
	graph := []any{
		map[string]any{
			"@type":       "Organization",
			"@id":         organizationID,
			"name":        seoBrandName(),
			"url":         site + "/",
			"logo":        site + "/logo.png",
			"description": seoHomeDescription,
		},
	}

	if canonical == site+"/" {
		graph = append(graph,
			map[string]any{
				"@type":      "WebSite",
				"@id":        site + "/#website",
				"url":        site + "/",
				"name":       seoBrandName(),
				"inLanguage": "zh-CN",
				"publisher":  map[string]any{"@id": organizationID},
			},
			map[string]any{
				"@type":               "SoftwareApplication",
				"@id":                 site + "/#application",
				"name":                seoBrandName(),
				"applicationCategory": "DeveloperApplication",
				"operatingSystem":     "Web",
				"url":                 site + "/",
				"description":         seoHomeDescription,
				"offers": map[string]any{
					"@type":         "Offer",
					"price":         "0",
					"priceCurrency": "CNY",
				},
			},
		)
		if faq := seoFAQJSONLD(); faq != nil {
			graph = append(graph, faq)
		}
	} else {
		pageType := "WebPage"
		if page.Article {
			pageType = "TechArticle"
		}
		graph = append(graph, map[string]any{
			"@type":       pageType,
			"@id":         canonical + "#webpage",
			"url":         canonical,
			"name":        page.Title,
			"description": page.Description,
			"inLanguage":  "zh-CN",
			"isPartOf":    map[string]any{"@id": site + "/#website"},
		})
	}

	payload := map[string]any{"@context": "https://schema.org", "@graph": graph}
	encoded, err := common.Marshal(payload)
	if err != nil {
		return ""
	}
	return `<script type="application/ld+json">` + string(encoded) + "</script>\n"
}

// seoFAQJSONLD turns the admin-configured FAQ into a FAQPage entry. Built-in
// marketing answers are not duplicated here; only what the operator publishes.
func seoFAQJSONLD() any {
	if !console_setting.GetConsoleSetting().FAQEnabled {
		return nil
	}
	items := console_setting.GetFAQ()
	if len(items) == 0 {
		return nil
	}
	if len(items) > 20 {
		items = items[:20]
	}
	questions := make([]any, 0, len(items))
	for _, item := range items {
		question, _ := item["question"].(string)
		answer, _ := item["answer"].(string)
		if strings.TrimSpace(question) == "" || strings.TrimSpace(answer) == "" {
			continue
		}
		questions = append(questions, map[string]any{
			"@type": "Question",
			"name":  question,
			"acceptedAnswer": map[string]any{
				"@type": "Answer",
				"text":  answer,
			},
		})
	}
	if len(questions) == 0 {
		return nil
	}
	return map[string]any{
		"@type":      "FAQPage",
		"mainEntity": questions,
	}
}

func seoEscape(value string) string {
	return html.EscapeString(value)
}

// seoSitemapURLs returns indexable public URLs in priority order.
func seoSitemapURLs() []struct {
	Location string
	Priority string
} {
	site := seoSiteURL()
	urls := []struct {
		Location string
		Priority string
	}{
		{site + "/", "1.0"},
	}
	if middleware.HeaderNavModulePublic("docs") {
		urls = append(urls, struct {
			Location string
			Priority string
		}{site + "/docs", "0.9"})
		for _, doc := range seoDocsPages {
			if doc.Slug == "" {
				continue
			}
			urls = append(urls, struct {
				Location string
				Priority string
			}{site + "/docs/" + doc.Slug, "0.7"})
		}
	}
	for _, page := range seoStaticPages {
		if page.Path == "/user-agreement" || !seoModulePublic(page.Module) {
			continue
		}
		urls = append(urls, struct {
			Location string
			Priority string
		}{site + page.Path, page.Priority})
	}
	return urls
}

func seoRenderSitemap() string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")
	for _, entry := range seoSitemapURLs() {
		b.WriteString("  <url>\n")
		fmt.Fprintf(&b, "    <loc>%s</loc>\n", seoEscape(entry.Location))
		fmt.Fprintf(&b, "    <priority>%s</priority>\n", entry.Priority)
		b.WriteString("  </url>\n")
	}
	b.WriteString("</urlset>\n")
	return b.String()
}

func seoRenderRobots() string {
	site := seoSiteURL()
	var b strings.Builder
	b.WriteString("# TokenCome 杜康\n")
	b.WriteString("User-agent: *\n")
	b.WriteString("Allow: /\n")
	for _, prefix := range []string{"/api/", "/v1/", "/mj/", "/pg/", "/assets/", "/setup", "/user/", "/oauth", "/console"} {
		fmt.Fprintf(&b, "Disallow: %s\n", prefix)
	}
	b.WriteString("\n")
	b.WriteString("# AI crawlers are welcome: this site documents a public developer API.\n")
	for _, agent := range []string{"GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "CCBot", "Bingbot"} {
		fmt.Fprintf(&b, "User-agent: %s\nAllow: /\n\n", agent)
	}
	fmt.Fprintf(&b, "Sitemap: %s/sitemap.xml\n", site)
	return b.String()
}

// seoRenderLLMsTxt is the llms.txt entry point for AI assistants: brand, what
// the service is, canonical links and the API surface.
func seoRenderLLMsTxt() string {
	site := seoSiteURL()
	brand := seoBrandName()
	var b strings.Builder
	b.WriteString("# " + brand + "\n\n")
	b.WriteString("> " + seoHomeDescription + "\n\n")
	b.WriteString(brand + " 是部署在 " + site + " 的 AI 大模型 API 网关。开发者用一个 Base URL 和一把密钥，即可通过 OpenAI、Anthropic Claude 与 Google Gemini 三种兼容协议调用多家上游模型，并在控制台中管理密钥、额度与用量。\n\n")
	b.WriteString("## 主要页面\n\n")
	fmt.Fprintf(&b, "- [首页](%s/): 产品介绍、协议矩阵与常见问题\n", site)
	fmt.Fprintf(&b, "- [使用文档](%s/docs): 快速开始、客户端配置、API 参考与计费说明\n", site)
	fmt.Fprintf(&b, "- [模型广场](%s/pricing): 可用模型、接口类型与分组价格\n", site)
	fmt.Fprintf(&b, "- [状态监控](%s/status-monitor): 各模型分组的实时可用性\n", site)
	fmt.Fprintf(&b, "- [关于我们](%s/about): 项目定位与联系方式\n\n", site)
	b.WriteString("## 接入地址\n\n")
	fmt.Fprintf(&b, "- OpenAI 兼容 Base URL: %s/v1\n", site)
	fmt.Fprintf(&b, "- Anthropic (Claude) 与 Gemini 原生: %s\n\n", site)
	b.WriteString("## 文档目录\n\n")
	for _, doc := range seoDocsPages {
		if doc.Slug == "" {
			fmt.Fprintf(&b, "- [%s](%s/docs): %s\n", doc.Title, site, doc.Description)
			continue
		}
		fmt.Fprintf(&b, "- [%s](%s/docs/%s): %s\n", doc.Title, site, doc.Slug, doc.Description)
	}
	return b.String()
}

func writeSEOResource(c *gin.Context, contentType string, body string) {
	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(http.StatusOK, contentType, []byte(body))
}

func seoRobotsHandler(c *gin.Context) {
	writeSEOResource(c, "text/plain; charset=utf-8", seoRenderRobots())
}

func seoSitemapHandler(c *gin.Context) {
	writeSEOResource(c, "application/xml; charset=utf-8", seoRenderSitemap())
}

func seoLLMsHandler(c *gin.Context) {
	writeSEOResource(c, "text/plain; charset=utf-8", seoRenderLLMsTxt())
}
