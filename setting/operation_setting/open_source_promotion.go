package operation_setting

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting/config"
)

// OpenSourcePromotionSettings drives the open-source author outreach loop:
// discover GitHub authors, email them an invitation, and grant a signup bonus
// when the invited address registers or signs in with GitHub.
type OpenSourcePromotionSettings struct {
	Enabled bool `json:"enabled"`

	// GitHubToken raises the API rate limit. It is a secret: the options API
	// never returns it, only the "configured" flag.
	GitHubToken string `json:"github_token"`

	// Keywords narrow the GitHub repository search. Empty means "only the
	// star/activity/chinese filters", which still works but is noisier.
	Keywords []string `json:"keywords"`

	// TopicChinese adds `topic:chinese` as a chinese-project signal. When the
	// keyword list is empty and this is off, a description-based chinese
	// probe is used instead.
	TopicChinese bool `json:"topic_chinese"`

	MinStars   int `json:"min_stars"`
	MaxStars   int `json:"max_stars"`
	ActiveDays int `json:"active_days"`

	MaxReposPerRun    int `json:"max_repos_per_run"`
	MaxAuthorsPerRepo int `json:"max_authors_per_repo"`

	IncludePRAuthors      bool `json:"include_pr_authors"`
	RequireChineseProject bool `json:"require_chinese_project"`
	RequireChineseAuthor  bool `json:"require_chinese_author"`

	// EmailWhitelist limits harvesting to these addresses or domains. Empty
	// means "accept every syntactically valid non-noreply address".
	EmailWhitelist []string `json:"email_whitelist"`

	// GitHubRequestsPerMinute throttles GitHub API calls. 0 means automatic:
	// 10 requests per minute without a token, 30 with one.
	GitHubRequestsPerMinute int `json:"github_requests_per_minute"`

	AutoSendEnabled bool   `json:"auto_send_enabled"`
	FetchTime       string `json:"fetch_time"`
	SendTime        string `json:"send_time"`

	DailySendLimit      int `json:"daily_send_limit"`
	SendIntervalSeconds int `json:"send_interval_seconds"`

	// RewardAmount is the bonus in CNY (the currency shown in the email). The
	// wallet itself is USD-denominated; see service/open_source_promotion.go.
	RewardAmount float64 `json:"reward_amount"`
	RewardNote   string  `json:"reward_note"`

	// EmailSubject and EmailBody override the built-in bilingual invitation.
	// Placeholders: {{SystemName}}, {{Repository}}, {{Contribution}},
	// {{Amount}}, {{Link}}, {{Note}}. EmailBody is an HTML fragment.
	EmailSubject string `json:"email_subject"`
	EmailBody    string `json:"email_body"`
}

const (
	defaultOpenSourcePromotionFetchTime = "03:00"
	defaultOpenSourcePromotionSendTime  = "10:00"
	maxOpenSourcePromotionRewardAmount  = 1_000_000
	maxOpenSourcePromotionTokenLength   = 512
	maxOpenSourcePromotionSubjectRunes  = 300
	maxOpenSourcePromotionBodyRunes     = 20_000
	maxOpenSourcePromotionRPM           = 600
)

var openSourcePromotionSettings = OpenSourcePromotionSettings{
	Enabled:                 false,
	GitHubToken:             "",
	Keywords:                []string{},
	TopicChinese:            true,
	MinStars:                5,
	MaxStars:                500,
	ActiveDays:              180,
	MaxReposPerRun:          20,
	MaxAuthorsPerRepo:       3,
	IncludePRAuthors:        true,
	RequireChineseProject:   true,
	RequireChineseAuthor:    false,
	EmailWhitelist:          []string{},
	GitHubRequestsPerMinute: 0,
	AutoSendEnabled:         false,
	FetchTime:               defaultOpenSourcePromotionFetchTime,
	SendTime:                defaultOpenSourcePromotionSendTime,
	DailySendLimit:          50,
	SendIntervalSeconds:     30,
	RewardAmount:            10,
	RewardNote:              "",
	EmailSubject:            "",
	EmailBody:               "",
}

func init() {
	config.GlobalConfig.Register("open_source_promotion", &openSourcePromotionSettings)
}

// GetOpenSourcePromotionSettings returns the live settings, normalized so a
// partially cleared form cannot silently disable or misconfigure the loop.
func GetOpenSourcePromotionSettings() *OpenSourcePromotionSettings {
	normalizeOpenSourcePromotionSettings(&openSourcePromotionSettings)
	return &openSourcePromotionSettings
}

// normalizeOpenSourcePromotionSettings fixes order/c range mistakes in memory
// only, so an operator can still clear a field in the UI to fall back to the
// default instead of having the value rewritten behind their back.
func normalizeOpenSourcePromotionSettings(settings *OpenSourcePromotionSettings) {
	if settings.MinStars < 0 {
		settings.MinStars = 0
	}
	if settings.MaxStars <= 0 {
		settings.MaxStars = 500
	}
	if settings.MinStars > settings.MaxStars {
		settings.MinStars, settings.MaxStars = settings.MaxStars, settings.MinStars
	}
	settings.ActiveDays = clampOpenSourcePromotionInt(settings.ActiveDays, 1, 3650, 180)
	settings.MaxReposPerRun = clampOpenSourcePromotionInt(settings.MaxReposPerRun, 1, 100, 20)
	settings.MaxAuthorsPerRepo = clampOpenSourcePromotionInt(settings.MaxAuthorsPerRepo, 1, 20, 3)
	settings.DailySendLimit = clampOpenSourcePromotionInt(settings.DailySendLimit, 1, 1000, 50)
	settings.SendIntervalSeconds = clampOpenSourcePromotionInt(settings.SendIntervalSeconds, 5, 3600, 30)
	if math.IsNaN(settings.RewardAmount) || math.IsInf(settings.RewardAmount, 0) || settings.RewardAmount < 0 {
		settings.RewardAmount = 10
	}
	if settings.RewardAmount > maxOpenSourcePromotionRewardAmount {
		settings.RewardAmount = maxOpenSourcePromotionRewardAmount
	}
	settings.FetchTime = normalizeOpenSourcePromotionClock(settings.FetchTime, defaultOpenSourcePromotionFetchTime)
	settings.SendTime = normalizeOpenSourcePromotionClock(settings.SendTime, defaultOpenSourcePromotionSendTime)
	settings.Keywords = normalizeOpenSourcePromotionList(settings.Keywords)
	settings.EmailWhitelist = normalizeOpenSourcePromotionList(settings.EmailWhitelist)
	settings.GitHubToken = strings.TrimSpace(settings.GitHubToken)
	settings.RewardNote = strings.TrimSpace(settings.RewardNote)
	settings.EmailSubject = strings.TrimSpace(settings.EmailSubject)
	settings.EmailBody = strings.TrimSpace(settings.EmailBody)
	settings.GitHubRequestsPerMinute = clampOpenSourcePromotionInt(settings.GitHubRequestsPerMinute, 0, maxOpenSourcePromotionRPM, 0)
}

func clampOpenSourcePromotionInt(value, minValue, maxValue, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return min(max(value, minValue), maxValue)
}

var openSourcePromotionClockPattern = regexp.MustCompile(`^([01][0-9]|2[0-3]):([0-5][0-9])$`)

func parseOpenSourcePromotionClock(value string) (hour, minute int, ok bool) {
	matches := openSourcePromotionClockPattern.FindStringSubmatch(strings.TrimSpace(value))
	if matches == nil {
		return 0, 0, false
	}
	hour, _ = strconv.Atoi(matches[1])
	minute, _ = strconv.Atoi(matches[2])
	return hour, minute, true
}

func normalizeOpenSourcePromotionClock(value, fallback string) string {
	if _, _, ok := parseOpenSourcePromotionClock(value); ok {
		return strings.TrimSpace(value)
	}
	return fallback
}

// normalizeOpenSourcePromotionList trims, drops blanks, and removes duplicates
// while preserving the operator's order.
func normalizeOpenSourcePromotionList(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, value)
	}
	return result
}

// OpenSourcePromotionClockSlot returns today's local-time instant for the
// given HH:MM setting. A malformed value falls back to the provided default.
func OpenSourcePromotionClockSlot(now time.Time, value, fallback string) time.Time {
	hour, minute, ok := parseOpenSourcePromotionClock(value)
	if !ok {
		hour, minute, _ = parseOpenSourcePromotionClock(fallback)
	}
	return time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())
}

// OpenSourcePromotionGitHubRequestsPerMinute returns the effective call rate.
// GitHub allows 10 search requests per minute anonymously and 30 when
// authenticated; an explicit setting is clamped to the documented maximum.
func OpenSourcePromotionGitHubRequestsPerMinute(settings *OpenSourcePromotionSettings) int {
	if settings.GitHubRequestsPerMinute > 0 {
		return min(settings.GitHubRequestsPerMinute, maxOpenSourcePromotionRPM)
	}
	if strings.TrimSpace(settings.GitHubToken) != "" {
		return 30
	}
	return 10
}

// ValidateOpenSourcePromotionOption validates a single `open_source_promotion.*`
// value before it is persisted. Unknown keys are accepted so future fields do
// not break older builds.
func ValidateOpenSourcePromotionOption(key, value string) error {
	if !strings.HasPrefix(key, "open_source_promotion.") {
		return nil
	}
	value = strings.TrimSpace(value)
	switch key {
	case "open_source_promotion.fetch_time", "open_source_promotion.send_time":
		if _, _, ok := parseOpenSourcePromotionClock(value); !ok {
			return fmt.Errorf("%s must be HH:MM between 00:00 and 23:59", key)
		}
	case "open_source_promotion.reward_amount":
		amount, err := strconv.ParseFloat(value, 64)
		if err != nil || math.IsNaN(amount) || math.IsInf(amount, 0) {
			return fmt.Errorf("%s must be a finite number", key)
		}
		if amount < 0 || amount > maxOpenSourcePromotionRewardAmount {
			return fmt.Errorf("%s must be between 0 and %d", key, maxOpenSourcePromotionRewardAmount)
		}
	case "open_source_promotion.github_token":
		if len(value) > maxOpenSourcePromotionTokenLength {
			return fmt.Errorf("%s must not exceed %d characters", key, maxOpenSourcePromotionTokenLength)
		}
	case "open_source_promotion.email_subject":
		if len([]rune(value)) > maxOpenSourcePromotionSubjectRunes {
			return fmt.Errorf("%s must not exceed %d characters", key, maxOpenSourcePromotionSubjectRunes)
		}
	case "open_source_promotion.email_body":
		if len([]rune(value)) > maxOpenSourcePromotionBodyRunes {
			return fmt.Errorf("%s must not exceed %d characters", key, maxOpenSourcePromotionBodyRunes)
		}
	case "open_source_promotion.github_requests_per_minute":
		number, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("%s must be an integer", key)
		}
		if number < 0 || number > maxOpenSourcePromotionRPM {
			return fmt.Errorf("%s must be between 0 and %d", key, maxOpenSourcePromotionRPM)
		}
	case "open_source_promotion.min_stars", "open_source_promotion.max_stars",
		"open_source_promotion.active_days", "open_source_promotion.max_repos_per_run",
		"open_source_promotion.max_authors_per_repo", "open_source_promotion.daily_send_limit",
		"open_source_promotion.send_interval_seconds":
		number, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("%s must be an integer", key)
		}
		if number < 0 {
			return fmt.Errorf("%s must not be negative", key)
		}
	}
	return nil
}
