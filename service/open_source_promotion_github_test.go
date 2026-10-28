package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestGitHubEmailAllowedRejectsMachineAddresses protects the address filter:
// commits legitimately carry GitHub web-flow, CI bot, and local-host addresses,
// and none of them can reach a person. Earlier versions only knew about
// noreply.github.com and example.com, so `foo@github.com` and `build@host.local`
// ended up in the outreach list.
func TestGitHubEmailAllowedRejectsMachineAddresses(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    string
		allowed bool
	}{
		{name: "personal address", raw: "Dev@QQ.com", want: "Dev@QQ.com", allowed: true},
		{name: "gmail address", raw: "someone@gmail.com", want: "someone@gmail.com", allowed: true},
		{name: "github web flow", raw: "noreply@github.com", allowed: false},
		{name: "github service account", raw: "somebody@github.com", allowed: false},
		{name: "github noreply with id", raw: "12345+user@users.noreply.github.com", allowed: false},
		{name: "github subdomain", raw: "action@actions.github.com", allowed: false},
		{name: "private local domain", raw: "build@host.local", allowed: false},
		{name: "localhost domain", raw: "root@box.localhost", allowed: false},
		{name: "reserved invalid tld", raw: "ci@runner.invalid", allowed: false},
		{name: "reserved test tld", raw: "ci@runner.test", allowed: false},
		{name: "example com", raw: "a@example.com", allowed: false},
		{name: "example subdomain", raw: "a@mail.example.com", allowed: false},
		{name: "example org", raw: "a@example.org", allowed: false},
		{name: "no reply local part", raw: "no-reply@corp.com", allowed: false},
		{name: "noreply with tag", raw: "noreply+bot@corp.com", allowed: false},
		{name: "mailer daemon", raw: "MAILER-DAEMON@corp.com", allowed: false},
		{name: "domain without dot", raw: "foo@localhost", allowed: false},
		{name: "empty", raw: "", allowed: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			email, allowed := githubEmailAllowed(test.raw, nil)
			assert.Equal(t, test.allowed, allowed)
			assert.Equal(t, test.want, email)
		})
	}
}

// TestGitHubEmailAllowedAppliesWhitelist covers the operator filter, including
// the rule that a whitelist entry cannot reintroduce a reserved domain.
func TestGitHubEmailAllowedAppliesWhitelist(t *testing.T) {
	email, allowed := githubEmailAllowed("dev@qq.com", []string{"@gmail.com"})
	assert.False(t, allowed)
	assert.Empty(t, email)

	email, allowed = githubEmailAllowed("dev@qq.com", []string{" @qq.com "})
	assert.True(t, allowed)
	assert.Equal(t, "dev@qq.com", email)

	email, allowed = githubEmailAllowed("dev@qq.com", []string{"dev@qq.com"})
	assert.True(t, allowed)
	assert.Equal(t, "dev@qq.com", email)

	_, allowed = githubEmailAllowed("noreply@github.com", []string{"@github.com"})
	assert.False(t, allowed, "the whitelist must not override the reserved-domain filter")
}

// TestGitHubRejectedAuthorKeyDeduplicatesByLogin keeps the skip counter a count
// of authors: one bot committing fifty times is one skipped author, not fifty.
func TestGitHubRejectedAuthorKeyDeduplicatesByLogin(t *testing.T) {
	first := githubCommit{
		Commit: githubCommitPayload{Author: githubCommitAuthor{Email: "bot@corp.com"}},
		Author: &githubCommitUser{Login: "CI-Bot"},
	}
	second := githubCommit{
		Commit: githubCommitPayload{Author: githubCommitAuthor{Email: "ci-bot@corp.com"}},
		Author: &githubCommitUser{Login: "ci-bot"},
	}
	assert.Equal(t, githubRejectedAuthorKey(first), githubRejectedAuthorKey(second))

	// Commits without a linked GitHub account fall back to the address, so two
	// unattributed commits by the same person still collapse into one.
	anonymous := githubCommit{Commit: githubCommitPayload{Author: githubCommitAuthor{Email: "Someone@Corp.com"}}}
	anonymousRepeat := githubCommit{Commit: githubCommitPayload{Author: githubCommitAuthor{Email: "someone@corp.com"}}}
	assert.Equal(t, githubRejectedAuthorKey(anonymous), githubRejectedAuthorKey(anonymousRepeat))

	other := githubCommit{Commit: githubCommitPayload{Author: githubCommitAuthor{Email: "other@corp.com"}}}
	assert.NotEqual(t, githubRejectedAuthorKey(anonymous), githubRejectedAuthorKey(other))
}
