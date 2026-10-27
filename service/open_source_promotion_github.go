package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// GitHub API errors that the harvesting task treats specially.
var (
	errGitHubRateLimited = errors.New("github api rate limit reached")
	errGitHubNotFound    = errors.New("github resource not found")
)

const (
	githubAPIVersion  = "2022-11-28"
	githubRequestTTL  = 30 * time.Second
	githubBodyMaxRead = 4 * 1024
	githubMinRemain   = 5
)

// githubClient is a thin GitHub REST client for this feature only. The token
// stays in memory and is never logged.
type githubClient struct {
	token string
	// minInterval spaces consecutive requests so the run stays inside the
	// documented per-minute budget instead of relying on 403 responses.
	minInterval time.Duration
	lastRequest time.Time
}

func newGitHubClient(token string, requestsPerMinute int) *githubClient {
	if requestsPerMinute <= 0 {
		requestsPerMinute = 10
	}
	return &githubClient{
		token:       strings.TrimSpace(token),
		minInterval: time.Minute / time.Duration(requestsPerMinute),
	}
}

// waitForSlot blocks until the next request is allowed by the configured rate.
func (client *githubClient) waitForSlot(ctx context.Context) error {
	if client.minInterval <= 0 || client.lastRequest.IsZero() {
		return nil
	}
	wait := time.Until(client.lastRequest.Add(client.minInterval))
	if wait <= 0 {
		return nil
	}
	timer := time.NewTimer(wait)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// githubRequest performs one API call and normalizes the failure modes the
// harvesting loop must distinguish: rate limiting and 404 both stop or skip work
// instead of failing the whole task.
func (client *githubClient) githubRequest(ctx context.Context, path string, query url.Values) (*http.Response, error) {
	if err := client.waitForSlot(ctx); err != nil {
		return nil, err
	}
	endpoint := "https://api.github.com" + path
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}

	requestCtx, cancel := context.WithTimeout(ctx, githubRequestTTL)
	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, endpoint, nil)
	if err != nil {
		cancel()
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", githubAPIVersion)
	if client.token != "" {
		req.Header.Set("Authorization", "Bearer "+client.token)
	}

	client.lastRequest = time.Now()
	resp, err := GetHttpClient().Do(req)
	if err != nil {
		cancel()
		return nil, err
	}
	// The caller owns the response body; closing it releases the timeout.
	resp.Body = &githubResponseBody{ReadCloser: resp.Body, cancel: cancel}

	remaining, remainingErr := strconv.Atoi(resp.Header.Get("X-RateLimit-Remaining"))
	switch {
	case resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusForbidden:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, githubBodyMaxRead))
		_ = resp.Body.Close()
		if (remainingErr == nil && remaining < githubMinRemain) || strings.Contains(strings.ToLower(string(body)), "rate limit") {
			return nil, fmt.Errorf("%w: %s", errGitHubRateLimited, resp.Status)
		}
		return nil, fmt.Errorf("github api %s: %s %s", path, resp.Status, strings.TrimSpace(string(body)))
	case resp.StatusCode == http.StatusNotFound:
		_ = resp.Body.Close()
		return nil, errGitHubNotFound
	case resp.StatusCode < 200 || resp.StatusCode >= 300:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, githubBodyMaxRead))
		_ = resp.Body.Close()
		return nil, fmt.Errorf("github api %s: %s %s", path, resp.Status, strings.TrimSpace(string(body)))
	}

	// Stop before the shared quota is exhausted: other site integrations use the
	// same token, and a partial run is resumed by the next scheduled one.
	if remainingErr == nil && remaining < githubMinRemain {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("%w: remaining %d", errGitHubRateLimited, remaining)
	}
	return resp, nil
}

// githubResponseBody releases the per-request timeout when the caller closes it.
type githubResponseBody struct {
	io.ReadCloser
	cancel context.CancelFunc
}

func (body *githubResponseBody) Close() error {
	err := body.ReadCloser.Close()
	body.cancel()
	return err
}

type githubRepositoryOwner struct {
	Login string `json:"login"`
	Id    int64  `json:"id"`
}

type githubRepository struct {
	FullName        string                `json:"full_name"`
	HtmlUrl         string                `json:"html_url"`
	Description     string                `json:"description"`
	Language        string                `json:"language"`
	StargazersCount int                   `json:"stargazers_count"`
	PushedAt        string                `json:"pushed_at"`
	Fork            bool                  `json:"fork"`
	Archived        bool                  `json:"archived"`
	Owner           githubRepositoryOwner `json:"owner"`
	Topics          []string              `json:"topics"`
}

type githubSearchResponse struct {
	TotalCount int                `json:"total_count"`
	Incomplete bool               `json:"incomplete_results"`
	Items      []githubRepository `json:"items"`
}

type githubCommitAuthor struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Date  string `json:"date"`
}

type githubCommitUser struct {
	Login string `json:"login"`
	Id    int64  `json:"id"`
}

type githubCommitPayload struct {
	Message string             `json:"message"`
	Author  githubCommitAuthor `json:"author"`
}

type githubCommit struct {
	Sha     string              `json:"sha"`
	Commit  githubCommitPayload `json:"commit"`
	Author  *githubCommitUser   `json:"author"`
	HtmlUrl string              `json:"html_url"`
}

type githubPullUser struct {
	Login string `json:"login"`
	Id    int64  `json:"id"`
}

type githubPullRequest struct {
	Number   int            `json:"number"`
	HtmlUrl  string         `json:"html_url"`
	Title    string         `json:"title"`
	User     githubPullUser `json:"user"`
	MergedAt string         `json:"merged_at"`
}

type githubUserProfile struct {
	Login    string `json:"login"`
	Id       int64  `json:"id"`
	Name     string `json:"name"`
	Location string `json:"location"`
	HtmlUrl  string `json:"html_url"`
	Email    string `json:"email"`
}

func (client *githubClient) getJSON(ctx context.Context, path string, query url.Values, target any) error {
	resp, err := client.githubRequest(ctx, path, query)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return common.DecodeJson(resp.Body, target)
}

// searchRepositories searches repositories matching the configured filters.
func (client *githubClient) searchRepositories(ctx context.Context, settings *operation_setting.OpenSourcePromotionSettings, page int) ([]githubRepository, error) {
	values := url.Values{}
	values.Set("q", githubRepositorySearchQuery(settings))
	values.Set("sort", "updated")
	values.Set("order", "desc")
	values.Set("per_page", "50")
	values.Set("page", strconv.Itoa(page))

	var result githubSearchResponse
	if err := client.getJSON(ctx, "/search/repositories", values, &result); err != nil {
		return nil, err
	}
	return result.Items, nil
}

// githubRepositorySearchQuery builds the qualifier string. Keywords are grouped
// before `in:`, otherwise the qualifier would only apply to the last word.
func githubRepositorySearchQuery(settings *operation_setting.OpenSourcePromotionSettings) string {
	parts := make([]string, 0, 6)
	quoted := make([]string, 0, len(settings.Keywords))
	for _, keyword := range settings.Keywords {
		keyword = strings.TrimSpace(keyword)
		if keyword == "" {
			continue
		}
		quoted = append(quoted, strconv.Quote(keyword))
	}
	if len(quoted) > 0 {
		parts = append(parts, "("+strings.Join(quoted, " OR ")+") in:name,description,readme")
	}

	since := time.Now().AddDate(0, 0, -max(settings.ActiveDays, 1)).Format("2006-01-02")
	parts = append(parts,
		fmt.Sprintf("stars:%d..%d", settings.MinStars, settings.MaxStars),
		"pushed:>="+since,
		"fork:false",
		"archived:false",
	)

	if settings.RequireChineseProject && settings.TopicChinese {
		parts = append(parts, "topic:chinese")
	}
	return strings.Join(parts, " ")
}

func (client *githubClient) listCommits(ctx context.Context, fullName string, limit int) ([]githubCommit, error) {
	values := url.Values{}
	values.Set("per_page", strconv.Itoa(clampGitHubPerPage(limit)))
	var commits []githubCommit
	if err := client.getJSON(ctx, "/repos/"+fullName+"/commits", values, &commits); err != nil {
		return nil, err
	}
	return commits, nil
}

// listCommitAuthorEmails resolves the public commit email of one GitHub login.
// A single commit is enough: it carries the author email GitHub recorded.
func (client *githubClient) listCommitAuthorEmails(ctx context.Context, fullName, login string) ([]githubCommit, error) {
	values := url.Values{}
	values.Set("author", login)
	values.Set("per_page", "1")
	var commits []githubCommit
	if err := client.getJSON(ctx, "/repos/"+fullName+"/commits", values, &commits); err != nil {
		return nil, err
	}
	return commits, nil
}

func (client *githubClient) listPullRequests(ctx context.Context, fullName string, limit int) ([]githubPullRequest, error) {
	values := url.Values{}
	values.Set("state", "all")
	values.Set("sort", "updated")
	values.Set("direction", "desc")
	values.Set("per_page", strconv.Itoa(clampGitHubPerPage(limit)))
	var pulls []githubPullRequest
	if err := client.getJSON(ctx, "/repos/"+fullName+"/pulls", values, &pulls); err != nil {
		return nil, err
	}
	return pulls, nil
}

func (client *githubClient) getUserProfile(ctx context.Context, login string) (*githubUserProfile, error) {
	var profile githubUserProfile
	if err := client.getJSON(ctx, "/users/"+login, nil, &profile); err != nil {
		return nil, err
	}
	return &profile, nil
}

func clampGitHubPerPage(limit int) int {
	return min(max(limit, 1), 100)
}

// githubAuthorCandidate is one harvested author before model conversion.
type githubAuthorCandidate struct {
	Email        string
	Login        string
	UserId       int64
	AuthorName   string
	ProfileUrl   string
	Source       string
	CommitCount  int
	PullCount    int
	LatestCommit string
}

// githubHarvestResult is the outcome of harvesting one repository.
type githubHarvestResult struct {
	Repository  githubRepository
	Authors     []githubAuthorCandidate
	Skipped     int
	RateLimited bool
}

var (
	githubNoreplyDomains = []string{"users.noreply.github.com", "noreply.github.com", "example.com"}
	githubChinaKeywords  = []string{
		"china", "中国", "beijing", "北京", "shanghai", "上海", "shenzhen", "深圳",
		"hangzhou", "杭州", "guangzhou", "广州", "chengdu", "成都", "wuhan", "武汉",
		"nanjing", "南京", "xi'an", "xian", "西安", "suzhou", "苏州", "xiamen", "厦门",
		"changsha", "长沙", "zhengzhou", "郑州", "tianjin", "天津", "chongqing", "重庆",
		"hefei", "合肥", "qingdao", "青岛", "dalian", "大连", "hong kong", "香港",
		"taiwan", "台湾", "shenyang", "沈阳", "jinan", "济南", "fuzhou", "福州",
	}
	githubChineseDescriptionKeywords = []string{"中文", "chinese", "china", "国内", "国产", "汉化"}
)

// githubEmailAllowed validates syntax, drops machine-generated addresses, and
// applies the operator whitelist (exact address or domain).
func githubEmailAllowed(rawEmail string, whitelist []string) (string, bool) {
	email, err := parseGitHubEmail(rawEmail)
	if err != nil {
		return "", false
	}
	lower := strings.ToLower(email)
	for _, domain := range githubNoreplyDomains {
		if strings.HasSuffix(lower, "@"+domain) {
			return "", false
		}
	}
	if len(whitelist) == 0 {
		return email, true
	}
	for _, rule := range whitelist {
		rule = strings.ToLower(strings.TrimSpace(rule))
		if rule == "" {
			continue
		}
		if rule == lower {
			return email, true
		}
		domain := strings.TrimPrefix(rule, "@")
		if strings.HasSuffix(lower, "@"+domain) {
			return email, true
		}
	}
	return "", false
}

// parseGitHubEmail keeps the address part of a `Name <mail>` value.
func parseGitHubEmail(rawEmail string) (string, error) {
	value := strings.TrimSpace(rawEmail)
	if value == "" {
		return "", errors.New("empty email")
	}
	if start := strings.Index(value, "<"); start >= 0 {
		if end := strings.Index(value[start:], ">"); end >= 0 {
			value = value[start+1 : start+end]
		}
	}
	value = strings.TrimSpace(value)
	if strings.ContainsAny(value, " \t\r\n") || len(value) > 191 {
		return "", errors.New("invalid email")
	}
	at := strings.LastIndex(value, "@")
	if at <= 0 || at == len(value)-1 {
		return "", errors.New("invalid email")
	}
	domain := value[at+1:]
	if !strings.Contains(domain, ".") || strings.HasPrefix(domain, ".") || strings.HasSuffix(domain, ".") {
		return "", errors.New("invalid email")
	}
	return value, nil
}

// containsCJK reports whether text carries Chinese characters, used to pick the
// email language and to spot chinese projects by description.
func containsCJK(text string) bool {
	if !utf8.ValidString(text) {
		return false
	}
	for _, r := range text {
		if unicode.Is(unicode.Han, r) {
			return true
		}
	}
	return false
}

// githubLooksChineseProject checks local metadata only, so it costs no request.
func githubLooksChineseProject(repo *githubRepository) bool {
	if containsCJK(repo.Description) || containsCJK(repo.Language) {
		return true
	}
	lowerDescription := strings.ToLower(repo.Description)
	for _, keyword := range githubChineseDescriptionKeywords {
		if strings.Contains(lowerDescription, keyword) {
			return true
		}
	}
	for _, topic := range repo.Topics {
		lower := strings.ToLower(topic)
		if strings.Contains(lower, "chinese") || strings.Contains(lower, "china") || lower == "zh" {
			return true
		}
	}
	return false
}

// githubLooksChineseAuthor checks the profile location. An empty location is
// kept so the filter does not silently discard most contributors.
func githubLooksChineseAuthor(location string) bool {
	location = strings.ToLower(strings.TrimSpace(location))
	if location == "" {
		return true
	}
	for _, keyword := range githubChinaKeywords {
		if strings.Contains(location, keyword) {
			return true
		}
	}
	return false
}

// githubContributionSummary builds the short contribution description stored on
// the recipient row and shown in the email.
func githubContributionSummary(repo *githubRepository, author *githubAuthorCandidate) string {
	description := strings.TrimSpace(repo.Description)
	if description == "" {
		description = "open-source project"
	}
	language := strings.TrimSpace(repo.Language)
	if language == "" {
		language = "unknown language"
	}
	summary := fmt.Sprintf("%s (%s, %d stars, %s) · %d commits", description, repo.FullName, repo.StargazersCount, language, max(author.CommitCount, 0))
	if author.PullCount > 0 {
		summary += fmt.Sprintf(", %d pull requests", author.PullCount)
	}
	if author.LatestCommit != "" {
		summary += " · " + firstLine(author.LatestCommit)
	}
	return truncateRunes(summary, 500)
}

func firstLine(value string) string {
	value = strings.TrimSpace(value)
	if idx := strings.IndexAny(value, "\r\n"); idx >= 0 {
		value = value[:idx]
	}
	return truncateRunes(value, 120)
}

func truncateRunes(value string, maxRunes int) string {
	if utf8.RuneCountInString(value) <= maxRunes {
		return value
	}
	return string([]rune(value)[:maxRunes])
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

// githubAuthorState accumulates one address seen in several commits or PRs.
type githubAuthorState struct {
	candidate githubAuthorCandidate
}

// harvestRepository collects owner, commit author, and (optionally) pull request
// author emails for one repository, applying the configured filters.
func (client *githubClient) harvestRepository(ctx context.Context, settings *operation_setting.OpenSourcePromotionSettings, repo *githubRepository) (*githubHarvestResult, error) {
	result := &githubHarvestResult{Repository: *repo}
	if settings.RequireChineseProject && !settings.TopicChinese && !githubLooksChineseProject(repo) {
		result.Skipped++
		return result, nil
	}

	commits, err := client.listCommits(ctx, repo.FullName, 100)
	if err != nil {
		return nil, err
	}

	states := make(map[string]*githubAuthorState, len(commits))
	order := make([]string, 0, len(commits))
	for _, commit := range commits {
		email, ok := githubEmailAllowed(commit.Commit.Author.Email, settings.EmailWhitelist)
		if !ok {
			result.Skipped++
			continue
		}
		state, exists := states[email]
		if !exists {
			candidate := githubAuthorCandidate{
				Email:      email,
				AuthorName: commit.Commit.Author.Name,
				Source:     model.PromotionRecipientSourceCommit,
			}
			if commit.Author != nil {
				candidate.Login = commit.Author.Login
				candidate.UserId = commit.Author.Id
				candidate.ProfileUrl = "https://github.com/" + commit.Author.Login
				if strings.EqualFold(commit.Author.Login, repo.Owner.Login) {
					candidate.Source = model.PromotionRecipientSourceOwner
				}
			}
			state = &githubAuthorState{candidate: candidate}
			states[email] = state
			order = append(order, email)
		}
		state.candidate.CommitCount++
		if state.candidate.LatestCommit == "" {
			state.candidate.LatestCommit = commit.Commit.Message
		}
	}

	if settings.IncludePRAuthors {
		pulls, pullErr := client.listPullRequests(ctx, repo.FullName, max(settings.MaxAuthorsPerRepo*10, 30))
		if pullErr != nil && !errors.Is(pullErr, errGitHubNotFound) {
			return nil, pullErr
		}
		loginsSeen := make(map[string]struct{}, len(states))
		for _, state := range states {
			if state.candidate.Login != "" {
				loginsSeen[strings.ToLower(state.candidate.Login)] = struct{}{}
			}
		}
		for _, pull := range pulls {
			login := strings.TrimSpace(pull.User.Login)
			if login == "" {
				continue
			}
			key := strings.ToLower(login)
			if _, ok := loginsSeen[key]; ok {
				continue
			}
			commitsForLogin, commitErr := client.listCommitAuthorEmails(ctx, repo.FullName, login)
			if commitErr != nil {
				if errors.Is(commitErr, errGitHubNotFound) || errors.Is(commitErr, errGitHubRateLimited) {
					if errors.Is(commitErr, errGitHubRateLimited) {
						result.RateLimited = true
						break
					}
					continue
				}
				return nil, commitErr
			}
			if len(commitsForLogin) == 0 {
				continue
			}
			email, ok := githubEmailAllowed(commitsForLogin[0].Commit.Author.Email, settings.EmailWhitelist)
			if !ok {
				result.Skipped++
				continue
			}
			if state, exists := states[email]; exists {
				state.candidate.PullCount++
				loginsSeen[key] = struct{}{}
				continue
			}
			states[email] = &githubAuthorState{candidate: githubAuthorCandidate{
				Email:        email,
				Login:        login,
				UserId:       pull.User.Id,
				ProfileUrl:   "https://github.com/" + login,
				AuthorName:   login,
				Source:       model.PromotionRecipientSourcePR,
				PullCount:    1,
				LatestCommit: commitsForLogin[0].Commit.Message,
			}}
			order = append(order, email)
			loginsSeen[key] = struct{}{}
		}
	}

	candidates := make([]githubAuthorCandidate, 0, len(order))
	for _, email := range order {
		state := states[email]
		if settings.RequireChineseAuthor && state.candidate.Login != "" {
			profile, profileErr := client.getUserProfile(ctx, state.candidate.Login)
			switch {
			case profileErr == nil:
				state.candidate.AuthorName = firstNonEmpty(profile.Name, state.candidate.AuthorName)
				state.candidate.ProfileUrl = firstNonEmpty(profile.HtmlUrl, state.candidate.ProfileUrl)
				if !githubLooksChineseAuthor(profile.Location) {
					result.Skipped++
					continue
				}
			case errors.Is(profileErr, errGitHubRateLimited):
				result.RateLimited = true
			case !errors.Is(profileErr, errGitHubNotFound):
				return nil, profileErr
			}
		}
		candidates = append(candidates, state.candidate)
	}

	sortCandidatesByActivity(candidates)
	if len(candidates) > settings.MaxAuthorsPerRepo {
		result.Skipped += len(candidates) - settings.MaxAuthorsPerRepo
		candidates = candidates[:settings.MaxAuthorsPerRepo]
	}
	result.Authors = candidates
	return result, nil
}

// sortCandidatesByActivity orders by commit count, then pull request count. The
// list is short (bounded by the commit page), so insertion sort stays simple.
func sortCandidatesByActivity(candidates []githubAuthorCandidate) {
	for i := 1; i < len(candidates); i++ {
		for j := i; j > 0; j-- {
			left, right := candidates[j-1], candidates[j]
			if left.CommitCount > right.CommitCount ||
				(left.CommitCount == right.CommitCount && left.PullCount >= right.PullCount) {
				break
			}
			candidates[j-1], candidates[j] = right, left
		}
	}
}
