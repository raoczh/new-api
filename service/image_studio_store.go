package service

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// Image studio artifacts live under a single local directory that nginx (or
// the API itself) serves statically. Keys are opaque: they carry no user id,
// no original filename and no sequence, so a leaked key cannot be used to
// enumerate another user's images.

const (
	imageStudioKeyPrefix   = "img/"
	imageStudioKeyShardLen = 3
	imageStudioMaxExtLen   = 5
)

var (
	ErrImageStudioFileNotFound = errors.New("image studio file not found")
	ErrImageStudioFileInvalid  = errors.New("image studio file is not a supported image")
)

// imageExtByMIME is the allow list. SVG is deliberately absent: it executes
// script when rendered inline, and results are served from the gateway origin.
var imageExtByMIME = map[string]string{
	"image/png":  "png",
	"image/jpeg": "jpg",
	"image/gif":  "gif",
	"image/webp": "webp",
}

func imageStudioRoot() string {
	settings := system_setting.GetImageStudioSettings()
	root := strings.TrimSpace(settings.StorageDir)
	if root == "" {
		root = "data/image-studio"
	}
	return filepath.Clean(root)
}

// detectImageMIME sniffs the first bytes of a payload and returns the matched
// extension, refusing anything that is not a raster image.
func detectImageMIME(header []byte) (string, bool) {
	mimeType := http.DetectContentType(header)
	ext, ok := imageExtByMIME[mimeType]
	return ext, ok
}

// SaveImageStudioBytes stores a payload under a fresh opaque key and returns
// that key.
func SaveImageStudioBytes(data []byte) (string, error) {
	if len(data) == 0 {
		return "", ErrImageStudioFileInvalid
	}
	header := data
	if len(header) > 512 {
		header = header[:512]
	}
	ext, ok := detectImageMIME(header)
	if !ok {
		return "", ErrImageStudioFileInvalid
	}

	key, err := newImageStudioKey(ext)
	if err != nil {
		return "", err
	}
	fullPath := imageStudioPath(key)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		return "", fmt.Errorf("create image studio directory: %w", err)
	}
	tempPath := fullPath + ".tmp"
	if err := os.WriteFile(tempPath, data, 0o644); err != nil {
		return "", fmt.Errorf("write image studio file: %w", err)
	}
	// Rename keeps readers from ever seeing a half-written image.
	if err := os.Rename(tempPath, fullPath); err != nil {
		_ = os.Remove(tempPath)
		return "", fmt.Errorf("commit image studio file: %w", err)
	}
	return key, nil
}

// SaveImageStudioReader streams an upload to disk with a hard byte ceiling.
func SaveImageStudioReader(reader io.Reader, maxBytes int64) (string, error) {
	if maxBytes <= 0 {
		maxBytes = 10 << 20
	}
	// Read one byte past the limit so an oversized body is distinguishable
	// from a body that exactly fills it.
	data, err := io.ReadAll(io.LimitReader(reader, maxBytes+1))
	if err != nil {
		return "", fmt.Errorf("read upload: %w", err)
	}
	if int64(len(data)) > maxBytes {
		return "", common.ErrRequestBodyTooLarge
	}
	return SaveImageStudioBytes(data)
}

// newImageStudioKey builds "img/abc/<32 random chars>.<ext>".
func newImageStudioKey(ext string) (string, error) {
	random, err := common.GenerateRandomCharsKey(32)
	if err != nil {
		return "", err
	}
	shard := random[:imageStudioKeyShardLen]
	return imageStudioKeyPrefix + shard + "/" + random + "." + ext, nil
}

// imageStudioPath resolves a key to an absolute path, rejecting traversal.
func imageStudioPath(key string) string {
	cleanKey := path.Clean("/" + strings.TrimSpace(key))
	cleanKey = strings.TrimPrefix(cleanKey, "/")
	return filepath.Join(imageStudioRoot(), filepath.FromSlash(cleanKey))
}

// ValidateImageStudioKey rejects keys that are empty, absolute, escape the
// storage root, or do not look like an artifact key.
func ValidateImageStudioKey(key string) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return ErrImageStudioFileNotFound
	}
	if strings.Contains(key, "..") || strings.HasPrefix(key, "/") || strings.ContainsRune(key, '\\') {
		return ErrImageStudioFileNotFound
	}
	if !strings.HasPrefix(key, imageStudioKeyPrefix) {
		return ErrImageStudioFileNotFound
	}
	ext := strings.TrimPrefix(filepath.Ext(key), ".")
	if len(ext) == 0 || len(ext) > imageStudioMaxExtLen {
		return ErrImageStudioFileNotFound
	}
	if _, ok := imageExtByMIME["image/"+ext]; !ok {
		// "jpg" is the only extension that differs from its MIME subtype.
		if ext != "jpg" {
			return ErrImageStudioFileNotFound
		}
	}
	return nil
}

// OpenImageStudioFile opens an artifact for serving.
func OpenImageStudioFile(key string) (*os.File, os.FileInfo, error) {
	if err := ValidateImageStudioKey(key); err != nil {
		return nil, nil, err
	}
	file, err := os.Open(imageStudioPath(key))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil, ErrImageStudioFileNotFound
		}
		return nil, nil, err
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, nil, err
	}
	if info.IsDir() {
		_ = file.Close()
		return nil, nil, ErrImageStudioFileNotFound
	}
	return file, info, nil
}

// DeleteImageStudioFile removes one artifact; a missing file is not an error
// because the retention cleaner may race with an explicit delete.
func DeleteImageStudioFile(key string) error {
	if err := ValidateImageStudioKey(key); err != nil {
		return nil
	}
	err := os.Remove(imageStudioPath(key))
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// DeleteImageStudioFiles removes several artifacts, logging but not failing on
// individual errors.
func DeleteImageStudioFiles(keys []string) {
	for _, key := range keys {
		if err := DeleteImageStudioFile(key); err != nil {
			common.SysError(common.LogText("failed to delete image studio file %s: %s", key, err.Error()))
		}
	}
}

// ImageStudioFileURL returns the browser-facing URL for a key.
//
// When PublicBaseURL is configured (for example https://img.example.com),
// nginx serves the file directly and the gateway stays out of the hot path.
// Otherwise the file route under /api/image-studio/files falls back to being
// served by the application.
func ImageStudioFileURL(key string) string {
	if key == "" {
		return ""
	}
	settings := system_setting.GetImageStudioSettings()
	if settings.PublicBaseURL != "" {
		return settings.PublicBaseURL + "/" + strings.TrimPrefix(key, "/")
	}
	return "/api/image-studio/files/" + strings.TrimPrefix(key, "/")
}

// ImageStudioFileAbsoluteURL returns an absolute URL for a key, for upstream
// providers that only accept reference image URLs.
//
// PublicBaseURL wins when configured; otherwise the gateway's own
// ServerAddress is used. The result must be reachable by the upstream
// provider, so a relative browser path is never returned.
func ImageStudioFileAbsoluteURL(key string) (string, error) {
	if err := ValidateImageStudioKey(key); err != nil {
		return "", err
	}
	settings := system_setting.GetImageStudioSettings()
	// PublicBaseURL maps the storage root directly; the gateway address needs
	// the API file route in front of the key.
	baseAddress := strings.TrimSpace(settings.PublicBaseURL)
	suffix := ""
	if baseAddress == "" {
		baseAddress = strings.TrimSpace(system_setting.ServerAddress)
		suffix = "/api/image-studio/files"
	}
	if err := ValidateTaskArtifactBaseURL(baseAddress); err != nil {
		return "", fmt.Errorf("image studio public base URL is not usable: %w", err)
	}
	return strings.TrimRight(baseAddress, "/") + suffix + "/" + strings.TrimPrefix(key, "/"), nil
}

// CleanupImageStudioStorage removes artifact files whose modification time is
// older than the retention cutoff. It is a safety net for files whose task row
// is already gone (for example after a manual database cleanup).
func CleanupImageStudioStorage(now time.Time, retentionDays int) (removed int, err error) {
	if retentionDays <= 0 {
		retentionDays = 7
	}
	cutoff := now.Add(-time.Duration(retentionDays) * 24 * time.Hour)
	root := imageStudioRoot()
	info, statErr := os.Stat(root)
	if statErr != nil {
		if os.IsNotExist(statErr) {
			return 0, nil
		}
		return 0, statErr
	}
	if !info.IsDir() {
		return 0, nil
	}

	walkErr := filepath.WalkDir(root, func(filePath string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		fileInfo, entryErr := entry.Info()
		if entryErr != nil {
			return nil
		}
		if fileInfo.ModTime().Before(cutoff) {
			if removeErr := os.Remove(filePath); removeErr == nil {
				removed++
			}
		}
		return nil
	})
	if walkErr != nil {
		return removed, walkErr
	}
	removeEmptyImageStudioDirs(root)
	return removed, nil
}

// removeEmptyImageStudioDirs prunes shard directories left empty by cleanup.
func removeEmptyImageStudioDirs(root string) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		dirPath := filepath.Join(root, entry.Name())
		children, readErr := os.ReadDir(dirPath)
		if readErr != nil || len(children) > 0 {
			continue
		}
		_ = os.Remove(dirPath)
	}
}
