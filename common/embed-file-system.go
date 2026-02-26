package common

import (
	"embed"
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
// preferring pre-compressed .gz files when the client supports gzip.
// This avoids runtime gzip compression overhead.
func ServePrecompressedStatic(fsEmbed embed.FS, targetPath string) gin.HandlerFunc {
	subFS, err := fs.Sub(fsEmbed, targetPath)
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(subFS))

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
		origFile.Close()

		// If client accepts gzip, try to serve pre-compressed .gz file
		if strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") {
			gzPath := urlPath + ".gz"
			data, err := fs.ReadFile(subFS, gzPath)
			if err == nil {
				contentType := mime.TypeByExtension(filepath.Ext(urlPath))
				if contentType == "" {
					contentType = "application/octet-stream"
				}
				c.Header("Content-Encoding", "gzip")
				c.Header("Vary", "Accept-Encoding")
				c.Data(http.StatusOK, contentType, data)
				c.Abort()
				return
			}
		}

		// Fallback: serve the original uncompressed file
		fileServer.ServeHTTP(c.Writer, c.Request)
		c.Abort()
	}
}
