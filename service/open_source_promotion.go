package service

import (
	"context"
	"errors"
	"fmt"
	"html"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/shopspring/decimal"
)

// promotionStuckSendTimeout is how long a row may stay in "sending" before a
// crashed process is assumed and the row is released for retry.
const promotionStuckSendTimeout = 30 * time.Minute

// PromotionFetchState is the resumable cursor of one harvesting task. It is
// stored as the SystemTask state, so the task runner must not overwrite it with
// the generic progress reporter.
type PromotionFetchState struct {
	Total           int `json:"total"`
	Processed       int `json:"processed"`
	Progress        int `json:"progress"`
	CursorPage      int `json:"cursor_page"`
	CursorRepoIndex int `json:"cursor_repo_index"`
	AuthorsSeen     int `json:"authors_seen"`
	// CurrentRepository is the repository being harvested right now, so the
	// admin page can show concrete progress instead of only a percentage.
	CurrentRepository string `json:"current_repository,omitempty"`
}

// PromotionEmailState is the live progress of one sending run.
type PromotionEmailState struct {
	Total     int `json:"total"`
	Processed int `json:"processed"`
	Progress  int `json:"progress"`
	Sent      int `json:"sent"`
	Failed    int `json:"failed"`
	Skipped   int `json:"skipped"`
}

// PromotionFetchSummary is the task result persisted for administrators.
type PromotionFetchSummary struct {
	Repositories     int  `json:"repositories"`
	AuthorsFound     int  `json:"authors_found"`
	Inserted         int  `json:"inserted"`
	SkippedDuplicate int  `json:"skipped_duplicate"`
	SkippedFiltered  int  `json:"skipped_filtered"`
	RateLimited      bool `json:"rate_limited"`
	CursorReset      bool `json:"cursor_reset"`
}

// PromotionEmailSummary is the email task result.
type PromotionEmailSummary struct {
	Sent          int    `json:"sent"`
	Failed        int    `json:"failed"`
	Skipped       int    `json:"skipped"`
	Recovered     int64  `json:"recovered"`
	SkippedReason string `json:"skipped_reason,omitempty"`
}

// RunOpenSourcePromotionFetch harvests authors for one task run. state is
// mutated in place and persisted through saveState after each repository, so an
// interrupted run resumes on the next scheduled cycle. manual lets an
// administrator run a harvest while the scheduled switch is off.
func RunOpenSourcePromotionFetch(
	ctx context.Context,
	state *PromotionFetchState,
	saveState func(PromotionFetchState) error,
	maxReposOverride int,
	manual bool,
) (PromotionFetchSummary, error) {
	summary := PromotionFetchSummary{}
	settings := operation_setting.GetOpenSourcePromotionSettings()
	if !settings.Enabled && !manual {
		return summary, common.NewMessage("Open source promotion is disabled")
	}
	if settings.GitHubToken == "" {
		logger.LogWarn(ctx, common.LogText("open source promotion is running without a GitHub token; the anonymous rate limit is low"))
	}

	maxRepos := settings.MaxReposPerRun
	if maxReposOverride > 0 {
		maxRepos = min(max(maxReposOverride, 1), 100)
	}

	client := newGitHubClient(settings.GitHubToken, operation_setting.OpenSourcePromotionGitHubRequestsPerMinute(settings))
	if state.CursorPage < 1 {
		state.CursorPage = 1
	}
	state.Total = maxRepos
	state.Processed = 0
	state.Progress = 0
	// A crashed run may have left the repository it was working on; clear it so
	// the monitor never shows a stale name before this run actually starts.
	state.CurrentRepository = ""
	// Publish the run size immediately so the monitor shows "0/N" instead of an
	// empty card while the first search request is in flight.
	if err := saveState(*state); err != nil {
		return summary, err
	}

	processedRepos := 0
	for processedRepos < maxRepos {
		if err := ctx.Err(); err != nil {
			return summary, err
		}
		repos, err := client.searchRepositories(ctx, settings, state.CursorPage)
		if err != nil {
			if errors.Is(err, errGitHubRateLimited) {
				summary.RateLimited = true
				break
			}
			return summary, err
		}
		if len(repos) == 0 {
			// Page exhausted: restart from the beginning next cycle. The email
			// uniqueness index keeps re-harvested authors from duplicating.
			state.CursorPage = 1
			state.CursorRepoIndex = 0
			summary.CursorReset = true
			break
		}
		if state.CursorRepoIndex >= len(repos) {
			state.CursorPage++
			state.CursorRepoIndex = 0
			continue
		}

		for ; state.CursorRepoIndex < len(repos) && processedRepos < maxRepos; state.CursorRepoIndex++ {
			if err := ctx.Err(); err != nil {
				return summary, err
			}
			repo := repos[state.CursorRepoIndex]
			state.CurrentRepository = repo.FullName
			if err := saveState(*state); err != nil {
				return summary, err
			}
			harvest, harvestErr := client.harvestRepository(ctx, settings, &repo)
			if harvestErr != nil {
				if errors.Is(harvestErr, errGitHubRateLimited) {
					summary.RateLimited = true
					break
				}
				// A single inaccessible repository (empty, renamed, archived
				// between search and fetch) must not abort the whole run.
				logger.LogWarn(ctx, common.LogText("open source promotion: repository %s skipped: %v", repo.FullName, harvestErr))
				summary.SkippedFiltered++
				processedRepos++
				state.Processed = processedRepos
				state.Progress = promotionProgress(processedRepos, maxRepos)
				continue
			}

			summary.Repositories++
			summary.AuthorsFound += len(harvest.Authors)
			summary.SkippedFiltered += harvest.Skipped
			state.AuthorsSeen += len(harvest.Authors)
			processedRepos++
			state.Processed = processedRepos
			state.Progress = promotionProgress(processedRepos, maxRepos)

			if len(harvest.Authors) > 0 {
				rows := promotionRowsForRepo(&harvest.Repository, harvest.Authors)
				inserted, insertErr := model.CreatePromotionRecipientsIfAbsent(rows)
				if insertErr != nil {
					return summary, insertErr
				}
				summary.Inserted += inserted
				summary.SkippedDuplicate += len(rows) - inserted
			}
			if err := saveState(*state); err != nil {
				return summary, err
			}
			if harvest.RateLimited {
				summary.RateLimited = true
				state.CursorRepoIndex++
				break
			}
		}
		if summary.RateLimited {
			break
		}
		// The page was consumed completely; advance to the next one.
		state.CursorPage++
		state.CursorRepoIndex = 0
	}

	// Persist the final cursor even when the run ended on a limit, so the next
	// cycle continues where this one stopped.
	state.CurrentRepository = ""
	if err := saveState(*state); err != nil {
		return summary, err
	}
	return summary, nil
}

func promotionProgress(processed, total int) int {
	if total <= 0 {
		return 0
	}
	return min(max(processed*100/total, 0), 100)
}

// promotionRowsForRepo converts harvested candidates to model rows. Rows are
// sorted by repository popularity so the retained row for a repeated author is
// the most notable repository.
func promotionRowsForRepo(repo *githubRepository, authors []githubAuthorCandidate) []model.PromotionRecipient {
	rows := make([]model.PromotionRecipient, 0, len(authors))
	for _, author := range authors {
		rows = append(rows, model.PromotionRecipient{
			Email:                 author.Email,
			GitHubLogin:           author.Login,
			GitHubUserId:          author.UserId,
			AuthorName:            author.AuthorName,
			ProfileUrl:            author.ProfileUrl,
			Repository:            repo.FullName,
			RepositoryUrl:         repo.HtmlUrl,
			RepositoryDescription: repo.Description,
			RepositoryStars:       repo.StargazersCount,
			RepositoryLanguage:    repo.Language,
			Source:                author.Source,
			Contribution:          githubContributionSummary(repo, &author),
			Status:                model.PromotionRecipientStatusPending,
		})
	}
	sort.SliceStable(rows, func(i, j int) bool {
		return rows[i].RepositoryStars > rows[j].RepositoryStars
	})
	return rows
}

// RunOpenSourcePromotionEmailTask delivers pending invitation emails one by one.
// When ids is non-empty only those rows are considered and the daily quota is
// bypassed, because an administrator explicitly asked for them. manual marks a
// "send all pending" action, which bypasses the automatic-sending switch but
// still respects the daily quota. saveState persists the live progress so the
// admin page can follow the run.
func RunOpenSourcePromotionEmailTask(ctx context.Context, ids []int, manual bool, saveState func(PromotionEmailState) error) (PromotionEmailSummary, error) {
	summary := PromotionEmailSummary{}
	settings := operation_setting.GetOpenSourcePromotionSettings()
	if len(ids) == 0 && !manual && !settings.AutoSendEnabled {
		summary.SkippedReason = "auto_send_disabled"
		return summary, nil
	}
	if !common.EmailDeliveryConfigured() {
		return summary, common.NewMessage("Email delivery is not configured")
	}
	address := strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/")
	if address == "" {
		return summary, common.NewMessage("Server address is not configured; the invitation link cannot be built")
	}

	now := common.GetTimestamp()
	recovered, err := model.ResetStuckPromotionEmails(now-int64(promotionStuckSendTimeout.Seconds()), now)
	if err != nil {
		return summary, err
	}
	summary.Recovered = recovered

	limit := settings.DailySendLimit
	if len(ids) > 0 {
		// An explicit selection is sent in full: the daily quota only throttles
		// the scheduled and "send all" runs, not a hand-picked batch.
		limit = len(ids)
	} else {
		nowTime := time.Now()
		dayStart := time.Date(nowTime.Year(), nowTime.Month(), nowTime.Day(), 0, 0, 0, 0, nowTime.Location())
		sentToday, countErr := model.CountPromotionEmailsSentSince(dayStart.Unix())
		if countErr != nil {
			return summary, countErr
		}
		remaining := settings.DailySendLimit - int(sentToday)
		if remaining <= 0 {
			summary.SkippedReason = "daily_limit_reached"
			return summary, nil
		}
		limit = remaining
	}

	rows, err := model.ListPromotionRecipientsForSending(limit, ids)
	if err != nil {
		return summary, err
	}

	// A broken reward configuration must not block the invitation: the email
	// simply will not promise a bonus until the administrator fixes it.
	if _, quotaErr := OpenSourcePromotionRewardQuota(); quotaErr != nil {
		logger.LogWarn(ctx, common.LogText("open source promotion: reward quota unavailable, emails will still be sent: %v", quotaErr))
	}

	sentInThisRun := 0
	state := PromotionEmailState{Total: len(rows)}
	if saveState != nil {
		if err := saveState(state); err != nil {
			return summary, err
		}
	}
	for i, row := range rows {
		if err := ctx.Err(); err != nil {
			return summary, err
		}
		claimed, claimErr := model.ClaimPromotionEmailForSend(row.Id, common.GetTimestamp())
		if claimErr != nil {
			return summary, claimErr
		}
		if !claimed {
			summary.Skipped++
			state.Skipped++
		} else {
			subject, content := buildOpenSourcePromotionEmail(row, settings, address)
			sendErr := common.SendEmail(subject, row.Email, content)
			finishedAt := common.GetTimestamp()
			if sendErr != nil {
				summary.Failed++
				state.Failed++
				if markErr := model.MarkPromotionEmailFailed(row.Id, sendErr.Error(), finishedAt); markErr != nil {
					logger.LogWarn(ctx, common.LogText("open source promotion: failed to mark email %d as failed: %v", row.Id, markErr))
				}
				logger.LogWarn(ctx, common.LogText("open source promotion: email to %s failed: %v", row.Email, sendErr))
			} else {
				summary.Sent++
				sentInThisRun++
				state.Sent++
				if markErr := model.MarkPromotionEmailSent(row.Id, finishedAt); markErr != nil {
					logger.LogWarn(ctx, common.LogText("open source promotion: failed to mark email %d as sent: %v", row.Id, markErr))
				}
			}
		}

		state.Processed = i + 1
		state.Progress = promotionProgress(state.Processed, state.Total)
		if saveState != nil {
			if err := saveState(state); err != nil {
				return summary, err
			}
		}

		// Keep a gap between messages; skip the wait after the last one.
		if i < len(rows)-1 {
			if err := sleepWithContext(ctx, time.Duration(settings.SendIntervalSeconds)*time.Second); err != nil {
				return summary, err
			}
		}
	}
	if sentInThisRun > 0 {
		logger.LogInfo(ctx, common.LogText("open source promotion: %d invitation emails sent", sentInThisRun))
	}
	return summary, nil
}

// sleepWithContext waits for d or until ctx is cancelled, whichever comes first.
func sleepWithContext(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// buildOpenSourcePromotionEmail renders the invitation. Amount and link come
// from the administrator configuration, and every interpolation is escaped.
// An administrator-provided template wins over the built-in bilingual text;
// the template itself is HTML and is used verbatim.
func buildOpenSourcePromotionEmail(row *model.PromotionRecipient, settings *operation_setting.OpenSourcePromotionSettings, serverAddress string) (string, string) {
	lang := i18n.LangEn
	if containsCJK(row.RepositoryDescription) || containsCJK(row.RepositoryLanguage) {
		lang = i18n.LangZhCN
	}
	values := map[string]string{
		"SystemName":   common.SystemName,
		"Repository":   row.Repository,
		"Contribution": firstLine(row.Contribution),
		"Amount":       formatPromotionAmount(settings.RewardAmount),
		"Link":         serverAddress + "/register",
		"Note":         settings.RewardNote,
	}
	return renderOpenSourcePromotionEmail(lang, values, settings)
}

func formatPromotionAmount(amount float64) string {
	return strconv.FormatFloat(amount, 'f', -1, 64)
}

// renderOpenSourcePromotionEmail produces the subject and HTML body for one
// language. The subject is plain text, so it keeps the raw values; the body is
// HTML, so every interpolation is escaped first.
func renderOpenSourcePromotionEmail(lang string, values map[string]string, settings *operation_setting.OpenSourcePromotionSettings) (string, string) {
	subjectParams, htmlParams := promotionEmailParams(values)

	subject := i18n.Translate(lang, i18n.MsgEmailPromotionSubject, subjectParams)
	content := defaultOpenSourcePromotionEmailBody(lang, htmlParams)
	if settings.EmailSubject != "" {
		subject = renderPromotionTemplate(settings.EmailSubject, subjectParams)
	}
	if settings.EmailBody != "" {
		content = renderPromotionTemplate(settings.EmailBody, htmlParams)
	}
	return subject, content
}

// defaultOpenSourcePromotionEmailBody is the built-in invitation used when the
// administrator has not written a template.
func defaultOpenSourcePromotionEmailBody(lang string, params map[string]any) string {
	content := fmt.Sprintf("<p>%s</p><p>%s</p><p>%s</p><p>%s</p>",
		i18n.Translate(lang, i18n.MsgEmailPromotionGreeting, params),
		i18n.Translate(lang, i18n.MsgEmailPromotionContribution, params),
		i18n.Translate(lang, i18n.MsgEmailPromotionReward, params),
		i18n.Translate(lang, i18n.MsgEmailPromotionFooter, params),
	)
	if note, _ := params["Note"].(string); note != "" {
		content += fmt.Sprintf("<p>%s</p>", i18n.Translate(lang, i18n.MsgEmailPromotionNote, params))
	}
	return content
}

// PromotionEmailPreview is one rendered invitation language. Administrators
// read it in the settings page, so the built-in copy is never hidden.
type PromotionEmailPreview struct {
	Language string `json:"language"`
	Subject  string `json:"subject"`
	Body     string `json:"body"`
}

// OpenSourcePromotionBuiltinEmailPreview renders the built-in invitation (the
// text used when both template fields are empty) for every supported language
// with sample values, so administrators can see the copy before customizing it.
func OpenSourcePromotionBuiltinEmailPreview() []PromotionEmailPreview {
	settings := operation_setting.GetOpenSourcePromotionSettings()
	serverAddress := strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/")
	if serverAddress == "" {
		serverAddress = "http://localhost:3000"
	}
	values := map[string]string{
		"SystemName":   common.SystemName,
		"Repository":   "owner/example-project",
		"Contribution": "A small utility library (owner/example-project, 120 stars, Go) · 18 commits · fix: handle empty input",
		"Amount":       formatPromotionAmount(settings.RewardAmount),
		"Link":         serverAddress + "/register",
		"Note":         settings.RewardNote,
	}

	previews := make([]PromotionEmailPreview, 0, 2)
	for _, lang := range []string{i18n.LangZhCN, i18n.LangEn} {
		subjectParams, htmlParams := promotionEmailParams(values)
		previews = append(previews, PromotionEmailPreview{
			Language: lang,
			Subject:  i18n.Translate(lang, i18n.MsgEmailPromotionSubject, subjectParams),
			Body:     defaultOpenSourcePromotionEmailBody(lang, htmlParams),
		})
	}
	return previews
}

// promotionEmailParams splits the raw values into plain-text parameters for the
// subject and HTML-escaped parameters for the body.
func promotionEmailParams(values map[string]string) (map[string]any, map[string]any) {
	subjectParams := make(map[string]any, len(values))
	htmlParams := make(map[string]any, len(values))
	for name, value := range values {
		subjectParams[name] = value
		htmlParams[name] = html.EscapeString(value)
	}
	return subjectParams, htmlParams
}

// renderPromotionTemplate substitutes {{Placeholder}} tokens with the already
// escaped values. Unknown tokens are left untouched so a typo is visible in the
// delivered message instead of silently disappearing.
func renderPromotionTemplate(template string, params map[string]any) string {
	replacements := make([]string, 0, len(params)*2)
	for name, value := range params {
		text, ok := value.(string)
		if !ok {
			continue
		}
		replacements = append(replacements, "{{"+name+"}}", text)
	}
	return strings.NewReplacer(replacements...).Replace(template)
}

// OpenSourcePromotionRewardQuota converts the configured CNY reward to wallet
// quota. The wallet is USD-denominated, so the amount is divided by the
// configured exchange rate before applying QuotaPerUnit.
func OpenSourcePromotionRewardQuota() (int, error) {
	settings := operation_setting.GetOpenSourcePromotionSettings()
	rate := operation_setting.USDExchangeRate
	if rate <= 0 || math.IsNaN(rate) || math.IsInf(rate, 0) {
		rate = 7.3
	}
	if settings.RewardAmount <= 0 {
		return 0, common.NewMessage("Promotion reward amount must be greater than zero")
	}
	quotaDec := decimal.NewFromFloat(settings.RewardAmount).
		Div(decimal.NewFromFloat(rate)).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	return common.WalletQuotaFromDecimalStrict(quotaDec)
}

// GrantOpenSourcePromotionReward pays the signup bonus when the address matches
// a harvested author. emailVerified must be true: an unverified address could
// belong to someone else. Returns the quota actually credited.
func GrantOpenSourcePromotionReward(userId int, email string, emailVerified bool) (int, bool) {
	if userId <= 0 || !emailVerified {
		return 0, false
	}
	email = model.NormalizeEmail(email)
	if email == "" {
		return 0, false
	}

	// Cheap negative check first; the transaction repeats it under a row lock.
	existing, err := model.GetPromotionRecipientByEmail(email)
	if err != nil {
		logger.LogWarn(context.Background(), common.LogText("open source promotion: recipient lookup failed: %v", err))
		return 0, false
	}
	if existing == nil {
		return 0, false
	}
	if existing.RewardedAt > 0 {
		// Already paid: still keep the binding current for the admin list.
		if existing.BoundUserId == 0 {
			_ = model.BindPromotionRecipientToUser(userId, email)
		}
		return 0, false
	}

	quota, quotaErr := OpenSourcePromotionRewardQuota()
	if quotaErr != nil {
		logger.LogWarn(context.Background(), common.LogText("open source promotion: reward quota invalid: %v", quotaErr))
		return 0, false
	}

	granted, err := model.GrantPromotionReward(userId, email, quota)
	if err != nil {
		logger.LogWarn(context.Background(), common.LogText("open source promotion: reward grant failed: user_id=%d err=%v", userId, err))
		return 0, false
	}
	if !granted {
		return 0, false
	}

	model.RecordLog(userId, model.LogTypeSystem, common.NewMessage(
		"Open source promotion bonus {{quota}}",
		map[string]any{"quota": logger.FormatQuota(quota)},
	))
	logger.LogInfo(context.Background(), common.LogText("open source promotion: granted %d quota to user %d", quota, userId))
	return quota, true
}

// GrantOpenSourcePromotionRewardForOAuth pays the bonus when a GitHub login
// exposes a verified address on the harvest list. It never blocks the login.
func GrantOpenSourcePromotionRewardForOAuth(ctx context.Context, provider oauth.Provider, token *oauth.OAuthToken, userId int) {
	if userId <= 0 || token == nil || provider == nil {
		return
	}
	if provider.GetName() != "GitHub" {
		return
	}
	verifiedProvider, ok := provider.(oauth.VerifiedEmailProvider)
	if !ok {
		return
	}
	emails, err := verifiedProvider.GetVerifiedEmails(ctx, token)
	if err != nil {
		logger.LogWarn(ctx, common.LogText("open source promotion: GitHub verified email lookup failed: %v", err))
		return
	}
	for _, email := range emails {
		if _, granted := GrantOpenSourcePromotionReward(userId, email, true); granted {
			return
		}
	}
}
