package service

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/MoeForge/moego/ojson"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Claude Code client recognition. A channel restricted to Claude Code clients
// serves only requests this file recognises, and a channel test that simulates
// the client sends the request and headers built here, so both sides agree on
// what a Claude Code request looks like.

// claudeCodeCLIVersion is the client version a simulated request reports. From
// 2.1.78 on the client sends metadata.user_id as a JSON object.
const claudeCodeCLIVersion = "2.1.258"

const claudeCodeSystemPrompt = "You are Claude Code, Anthropic's official CLI for Claude."

// claudeCodeTestMaxTokens bounds the reply of a simulated request. It is not
// 1: a one-token request is the client's connectivity probe, which upstream
// gateways accept without looking at the rest of the request.
const claudeCodeTestMaxTokens = 16

var claudeCodeUserAgentPattern = regexp.MustCompile(`(?i)^claude-cli/\d+\.\d+\.\d+`)

// claudeCodeLegacyUserIDPattern is the metadata.user_id of clients before
// 2.1.78: user_{64 hex}_account_{optional uuid}_session_{uuid}.
var claudeCodeLegacyUserIDPattern = regexp.MustCompile(`^user_[a-fA-F0-9]{64}_account_[a-fA-F0-9-]*_session_[a-fA-F0-9-]{36}$`)

// claudeCodeSystemPrompts are the openings of the system prompts the client
// and its sub-agents send. A system block that is close enough to one of them
// identifies the client.
var claudeCodeSystemPrompts = []string{
	claudeCodeSystemPrompt,
	"You are a Claude agent, built on Anthropic's Claude Agent SDK.",
	"You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.",
	"You are a file search specialist for Claude Code, Anthropic's official CLI for Claude.",
	"You are a helpful AI assistant tasked with summarizing conversations.",
	"You are an interactive CLI tool that helps users",
}

const claudeCodeSystemPromptThreshold = 0.5

// The client's auto-mode security monitor sends a long classifier prompt of
// its own instead of the usual system prompt.
const (
	claudeCodeSecurityMonitorPrefix = "You are a security monitor for autonomous AI coding agents."
	claudeCodeSecurityMonitorMinLen = 10_000
)

var claudeCodeSecurityMonitorMarkers = []string{
	"## Threat Model",
	"- `<transcript>`:",
	"## HARD BLOCK",
	"## SOFT BLOCK",
	"## Classification Process",
	"## Output Format",
	"<block>yes</block>",
	"<block>no</block>",
}

// IsClaudeCodeRequest reports whether the request comes from the Claude Code
// client. The client only talks to the Messages API, so a request to any other
// endpoint is not one, whatever its User-Agent says.
//
// A Messages request needs the client's User-Agent, a system block the client
// sends, the X-App, anthropic-beta and anthropic-version headers, and a
// metadata.user_id in the client's format. The one-token connectivity probe
// carries no system prompt and is accepted on its User-Agent alone.
func IsClaudeCodeRequest(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return false
	}
	if !claudeCodeUserAgentPattern.MatchString(c.Request.UserAgent()) {
		return false
	}
	path := c.Request.URL.Path
	if strings.HasSuffix(path, "/messages/count_tokens") {
		return true
	}
	if !strings.HasSuffix(path, "/messages") {
		return false
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return false
	}
	body, err := storage.Bytes()
	if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
		return false
	}
	c.Request.Body = io.NopCloser(storage)
	if err != nil || !ojson.ValidBytes(body) {
		return false
	}

	values := ojson.GetManyBytes(body, "max_tokens", "model", "system", "metadata.user_id")
	if values[0].Type == ojson.Number && values[0].Float() == 1 {
		return true
	}
	if values[1].Type != ojson.String || !hasClaudeCodeSystemPrompt(values[2]) {
		return false
	}
	header := c.Request.Header
	if header.Get("X-App") == "" || header.Get("anthropic-beta") == "" || header.Get("anthropic-version") == "" {
		return false
	}
	return values[3].Type == ojson.String && isClaudeCodeUserID(values[3].String())
}

// hasClaudeCodeSystemPrompt reports whether one block of the system array is a
// prompt the client sends: its billing attribution block, its security
// monitor prompt, or text close to one of its system prompt openings.
func hasClaudeCodeSystemPrompt(system ojson.Result) bool {
	if !system.IsArray() {
		return false
	}
	found := false
	system.ForEach(func(_, block ojson.Result) bool {
		text := block.Get("text")
		if text.Type != ojson.String || text.String() == "" {
			return true
		}
		content := text.String()
		if strings.HasPrefix(content, "x-anthropic-billing-header") && strings.Contains(content, "cc_entrypoint=") {
			found = true
			return false
		}
		if block.Get("type").String() == "text" && len(content) >= claudeCodeSecurityMonitorMinLen &&
			strings.HasPrefix(content, claudeCodeSecurityMonitorPrefix) {
			hasEveryMarker := true
			for _, marker := range claudeCodeSecurityMonitorMarkers {
				if !strings.Contains(content, marker) {
					hasEveryMarker = false
					break
				}
			}
			if hasEveryMarker {
				found = true
				return false
			}
		}
		normalized := strings.Join(strings.Fields(content), " ")
		for _, prompt := range claudeCodeSystemPrompts {
			if bigramSimilarity(normalized, prompt) >= claudeCodeSystemPromptThreshold {
				found = true
				return false
			}
		}
		return true
	})
	return found
}

// isClaudeCodeUserID reports whether value is a metadata.user_id the client
// sends: a JSON object with a device and a session id, or the older
// user_..._account_..._session_... string.
func isClaudeCodeUserID(value string) bool {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "{") {
		var id claudeCodeUserID
		if err := common.UnmarshalJsonStr(value, &id); err != nil {
			return false
		}
		return id.DeviceID != "" && id.SessionID != ""
	}
	return claudeCodeLegacyUserIDPattern.MatchString(value)
}

type claudeCodeUserID struct {
	DeviceID    string `json:"device_id"`
	AccountUUID string `json:"account_uuid"`
	SessionID   string `json:"session_id"`
}

// bigramSimilarity is the Sørensen–Dice coefficient of the character pairs of
// two strings, ignoring case: 1 for equal strings, 0 for nothing in common.
func bigramSimilarity(a, b string) float64 {
	if a == b {
		return 1
	}
	pairsA, totalA := characterPairs(a)
	pairsB, totalB := characterPairs(b)
	if totalA == 0 || totalB == 0 {
		return 0
	}
	shared := 0
	for pair, countA := range pairsA {
		shared += min(countA, pairsB[pair])
	}
	return float64(2*shared) / float64(totalA+totalB)
}

func characterPairs(s string) (pairs map[string]int, total int) {
	runes := []rune(strings.ToLower(s))
	pairs = make(map[string]int, len(runes))
	for i := 0; i+1 < len(runes); i++ {
		pairs[string(runes[i:i+2])]++
		total++
	}
	return pairs, total
}

// NewClaudeCodeTestRequest builds the Messages request a channel test sends
// when it simulates the Claude Code client: the client's system prompt and a
// fresh device and session in metadata.user_id, always streamed.
func NewClaudeCodeTestRequest(model string) (*dto.ClaudeRequest, error) {
	device := make([]byte, 32)
	if _, err := rand.Read(device); err != nil {
		return nil, err
	}
	userID, err := common.Marshal(claudeCodeUserID{
		DeviceID:  hex.EncodeToString(device),
		SessionID: uuid.NewString(),
	})
	if err != nil {
		return nil, err
	}
	metadata, err := common.Marshal(map[string]string{"user_id": string(userID)})
	if err != nil {
		return nil, err
	}
	ephemeral := []byte(`{"type":"ephemeral"}`)
	return &dto.ClaudeRequest{
		Model:     model,
		Stream:    common.GetPointer(true),
		MaxTokens: common.GetPointer(uint(claudeCodeTestMaxTokens)),
		System: []dto.ClaudeMediaMessage{{
			Type:         "text",
			Text:         common.GetPointer(claudeCodeSystemPrompt),
			CacheControl: ephemeral,
		}},
		Messages: []dto.ClaudeMessage{{
			Role: "user",
			Content: []dto.ClaudeMediaMessage{{
				Type:         "text",
				Text:         common.GetPointer("hi"),
				CacheControl: ephemeral,
			}},
		}},
		Metadata: metadata,
	}, nil
}

// ClaudeCodeBetaHeader is the anthropic-beta value the client sends with an
// API key.
const ClaudeCodeBetaHeader = "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14"

// ClaudeCodeClientHeaders returns the headers that identify the Claude Code
// client to an upstream, besides anthropic-beta and anthropic-version.
func ClaudeCodeClientHeaders() map[string]string {
	return map[string]string{
		"User-Agent":                                "claude-cli/" + claudeCodeCLIVersion + " (external, cli)",
		"X-App":                                     "cli",
		"X-Stainless-Lang":                          "js",
		"X-Stainless-Package-Version":               "0.94.0",
		"X-Stainless-OS":                            "Linux",
		"X-Stainless-Arch":                          "arm64",
		"X-Stainless-Runtime":                       "node",
		"X-Stainless-Runtime-Version":               "v24.3.0",
		"X-Stainless-Retry-Count":                   "0",
		"X-Stainless-Timeout":                       "600",
		"Anthropic-Dangerous-Direct-Browser-Access": "true",
	}
}
