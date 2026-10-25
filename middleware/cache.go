package middleware

import (
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

// Cache sets the default cache policy for the web fallback chain.
//
// Hashed build assets can be cached forever, because their names change on
// every build. Everything else — HTML documents in particular — must
// revalidate: a week-long HTML cache would pin old pages, old titles and old
// bundles in browsers and in Cloudflare.
func Cache() func(c *gin.Context) {
	return func(c *gin.Context) {
		if isImmutableAsset(c.Request.URL.Path) {
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			c.Header("Cache-Control", "no-cache")
		}
		c.Header("Cache-Version", "b688f2fb5be447c25e5aa3bd063087a83db32a288bf6a4f35f2d8db310e40b14")
		c.Next()
	}
}

// isImmutableAsset reports whether the path is a content-addressed build file.
// Rsbuild writes them under /static with a content hash in the file name.
func isImmutableAsset(urlPath string) bool {
	if !strings.HasPrefix(urlPath, "/static/") {
		return false
	}
	ext := path.Ext(urlPath)
	switch ext {
	case ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".map":
		return true
	default:
		return false
	}
}
