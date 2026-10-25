package router

import (
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

// WebAssets holds the embedded dashboard frontend assets.
type WebAssets struct {
	BuildFS   embed.FS
	IndexPage []byte
}

func SetWebRouter(router *gin.Engine, assets WebAssets, pluginDispatcher gin.HandlerFunc) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")
	compress := gzip.Gzip(gzip.DefaultCompression)

	// Crawler-facing resources are generated from the live configuration
	// instead of shipping static files, so canonical URLs and the sitemap always
	// match ServerAddress and the navigation modules the operator enabled.
	router.GET("/robots.txt", seoRobotsHandler)
	router.GET("/sitemap.xml", seoSitemapHandler)
	router.GET("/llms.txt", seoLLMsHandler)

	router.NoRoute(
		pluginDispatcher,
		middleware.RouteTag("web"),
		func(c *gin.Context) {
			// ServeFrontendFiles sends build files already compressed.
			if !frontendFS.Exists("/", c.Request.URL.Path) {
				compress(c)
			}
		},
		middleware.AccessTokenAudit(),
		middleware.GlobalWebRateLimit(frontendFS),
		middleware.Cache(),
		middleware.ServeFrontendFiles(frontendFS),
		func(c *gin.Context) {
			if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
				controller.RelayNotFound(c)
				return
			}
			if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
				c.Header("Allow", "GET, HEAD")
				c.Status(http.StatusMethodNotAllowed)
				return
			}

			path := seoNormalizePath(c.Request.URL.Path)
			page, exists := seoPageForPath(path)
			canonical := seoSiteURL() + path
			if !exists {
				// A real 404 keeps crawlers from indexing every unknown URL the
				// SPA would otherwise answer with 200 and an empty shell.
				c.Header("Cache-Control", "no-store")
				c.Data(http.StatusNotFound, "text/html; charset=utf-8", injectSEOHead(assets.IndexPage, seoNotFoundPage(), canonical))
				return
			}

			if page.Indexable {
				c.Header("Cache-Control", "no-cache")
			} else {
				c.Header("Cache-Control", "no-store")
			}
			c.Data(http.StatusOK, "text/html; charset=utf-8", injectSEOHead(assets.IndexPage, page, canonical))
		},
	)
}
