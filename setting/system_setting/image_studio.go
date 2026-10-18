package system_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// ImageStudioSettings controls the interactive AI drawing workbench.
//
// The workbench deliberately does not share the /v1 relay path: submissions
// are persisted as tasks, queued against a global per-kind concurrency limit,
// and executed in the background. That makes generation survive a closed
// browser tab, gives users a truthful queue position, and lets the server
// enforce retention and notify on completion.
type ImageStudioSettings struct {
	Enabled bool `json:"enabled"`

	// ImageConcurrency / VideoConcurrency are global caps for interactive
	// submissions only. API traffic through /v1 is never queued.
	ImageConcurrency int `json:"image_concurrency"`
	VideoConcurrency int `json:"video_concurrency"`

	// RetentionDays bounds how long records and files stay on disk. Favorites
	// do not extend retention.
	RetentionDays int `json:"retention_days"`

	// QueueMaxWaitMinutes fails a task that never got a slot in time instead
	// of leaving it queued forever.
	QueueMaxWaitMinutes int `json:"queue_max_wait_minutes"`

	// StorageDir is the local disk root for uploaded references and results.
	StorageDir string `json:"storage_dir"`

	// PublicBaseURL is the static site mapped to StorageDir (for example
	// https://img.example.com). When empty, files are served by the API.
	PublicBaseURL string `json:"public_base_url"`

	// MaxImagesPerRequest caps the quantity selector.
	MaxImagesPerRequest int `json:"max_images_per_request"`

	// MaxReferenceImages caps the reference image uploader.
	MaxReferenceImages int `json:"max_reference_images"`

	// UploadMaxMB caps a single uploaded reference image.
	UploadMaxMB int `json:"upload_max_mb"`

	// ImageModels explicitly marks image-capable models. Entries are matched
	// against the model name after the last '/' (vendor prefix stripped), so
	// "openai/gpt-image-1" and "gpt-image-1" both match. When empty the
	// built-in keyword heuristic is used.
	ImageModels []string `json:"image_models"`
}

var defaultImageStudioSettings = ImageStudioSettings{
	Enabled:             true,
	ImageConcurrency:    2,
	VideoConcurrency:    1,
	RetentionDays:       7,
	QueueMaxWaitMinutes: 30,
	StorageDir:          "data/image-studio",
	PublicBaseURL:       "",
	MaxImagesPerRequest: 4,
	MaxReferenceImages:  4,
	UploadMaxMB:         10,
	ImageModels:         []string{},
}

func init() {
	config.GlobalConfig.Register("image_studio", &defaultImageStudioSettings)
}

func GetImageStudioSettings() *ImageStudioSettings {
	normalizeImageStudioSettings(&defaultImageStudioSettings)
	return &defaultImageStudioSettings
}

// normalizeImageStudioSettings keeps zero or negative values from disabling
// the workbench by accident. Values are fixed in memory rather than written
// back, so an operator can still clear a field in the UI to reset the default.
func normalizeImageStudioSettings(settings *ImageStudioSettings) {
	if settings.ImageConcurrency <= 0 {
		settings.ImageConcurrency = 2
	}
	if settings.VideoConcurrency <= 0 {
		settings.VideoConcurrency = 1
	}
	if settings.RetentionDays <= 0 {
		settings.RetentionDays = 7
	}
	if settings.QueueMaxWaitMinutes <= 0 {
		settings.QueueMaxWaitMinutes = 30
	}
	if settings.MaxImagesPerRequest <= 0 {
		settings.MaxImagesPerRequest = 4
	}
	if settings.MaxReferenceImages <= 0 {
		settings.MaxReferenceImages = 4
	}
	if settings.UploadMaxMB <= 0 {
		settings.UploadMaxMB = 10
	}
	settings.StorageDir = strings.TrimSpace(settings.StorageDir)
	if settings.StorageDir == "" {
		settings.StorageDir = "data/image-studio"
	}
	settings.PublicBaseURL = strings.TrimRight(strings.TrimSpace(settings.PublicBaseURL), "/")
}
