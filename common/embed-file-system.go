package common

import (
	"embed"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// Credit: https://github.com/gin-contrib/static/issues/19

type embedFileSystem struct {
	http.FileSystem
}

func (e *embedFileSystem) Exists(prefix string, path string) bool {
	_, err := e.Open(path)
	if err != nil {
		return false
	}
	return true
}

func (e *embedFileSystem) Open(name string) (http.File, error) {
	if name == "/" {
		// This will make sure the index page goes to NoRouter handler,
		// which will use the replaced index bytes with analytic codes.
		return nil, os.ErrNotExist
	}
	return e.FileSystem.Open(name)
}

func EmbedFolder(fsEmbed embed.FS, targetPath string) static.ServeFileSystem {
	efs, err := fs.Sub(fsEmbed, targetPath)
	if err != nil {
		panic(err)
	}
	return &embedFileSystem{
		FileSystem: http.FS(efs),
	}
}

// ServePrecompressedStatic serves static files from embed.FS,
// preferring pre-compressed .br or .gz files when the client supports them.
// This avoids runtime compression overhead.
func ServePrecompressedStatic(fsEmbed embed.FS, targetPath string) gin.HandlerFunc {
	subFS, err := fs.Sub(fsEmbed, targetPath)
	if err != nil {
		panic(err)
	}

	return func(c *gin.Context) {
		urlPath := strings.TrimPrefix(c.Request.URL.Path, "/")
		if urlPath == "" {
			c.Next()
			return
		}

		// Check if the original file exists
		origFile, err := subFS.Open(urlPath)
		if err != nil {
			c.Next()
			return
		}
		origStat, err := origFile.Stat()
		if err != nil {
			origFile.Close()
			c.Next()
			return
		}

		acceptEncoding := c.GetHeader("Accept-Encoding")

		// Try Brotli first (better compression than gzip)
		if strings.Contains(acceptEncoding, "br") {
			brPath := urlPath + ".br"
			brFile, err := subFS.Open(brPath)
			if err == nil {
				defer brFile.Close()
				brStat, err := brFile.Stat()
				if err == nil {
					contentType := mime.TypeByExtension(filepath.Ext(urlPath))
					if contentType == "" {
						contentType = "application/octet-stream"
					}
					c.Header("Content-Encoding", "br")
					c.Header("Vary", "Accept-Encoding")
					c.Header("Content-Type", contentType)
					http.ServeContent(c.Writer, c.Request, brPath, brStat.ModTime(), brFile.(io.ReadSeeker))
					origFile.Close()
					c.Abort()
					return
				}
			}
		}

		// Fallback to gzip if client supports it
		if strings.Contains(acceptEncoding, "gzip") {
			gzPath := urlPath + ".gz"
			gzFile, err := subFS.Open(gzPath)
			if err == nil {
				defer gzFile.Close()
				gzStat, err := gzFile.Stat()
				if err == nil {
					// Serve pre-compressed file with proper HTTP semantics
					contentType := mime.TypeByExtension(filepath.Ext(urlPath))
					if contentType == "" {
						contentType = "application/octet-stream"
					}
					c.Header("Content-Encoding", "gzip")
					c.Header("Vary", "Accept-Encoding")
					c.Header("Content-Type", contentType)

					// Use http.ServeContent for ETag, Last-Modified, Range support
					http.ServeContent(c.Writer, c.Request, gzPath, gzStat.ModTime(), gzFile.(io.ReadSeeker))
					origFile.Close()
					c.Abort()
					return
				}
			}
		}

		// Fallback: serve the original uncompressed file with proper HTTP semantics
		contentType := mime.TypeByExtension(filepath.Ext(urlPath))
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		c.Header("Content-Type", contentType)
		http.ServeContent(c.Writer, c.Request, urlPath, origStat.ModTime(), origFile.(io.ReadSeeker))
		c.Abort()
	}
}
