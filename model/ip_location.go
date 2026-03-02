package model

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	defaultIPLocationAPIURL = "https://ipinfo.dkly.net/api/"
	defaultIPLocationAPIKey = "a3b3be25941f14415ba93648ea46308cd5f9d6d7c256dc4753a351eaf8cc9b0e"
	ipLocationCacheTTL      = 24 * time.Hour
)

type ipLocationCacheItem struct {
	Location  string
	ExpiredAt time.Time
}

type ipLocationResponse struct {
	Location struct {
		Country struct {
			Name string `json:"name"`
		} `json:"country"`
		Region struct {
			Name string `json:"name"`
		} `json:"region"`
		City string `json:"city"`
	} `json:"location"`
	Security struct {
		IsBogon bool `json:"is_bogon"`
	} `json:"security"`
}

var (
	ipLocationCache     = map[string]ipLocationCacheItem{}
	ipLocationCacheLock sync.RWMutex
	ipLocationHTTP      = &http.Client{Timeout: 5 * time.Second}
)

func queryIPLocation(ip string) string {
	cleanIP := strings.TrimSpace(ip)
	if cleanIP == "" {
		return ""
	}
	parsedIP := net.ParseIP(cleanIP)
	if parsedIP == nil {
		return ""
	}
	if parsedIP.IsLoopback() || parsedIP.IsPrivate() || parsedIP.IsUnspecified() || parsedIP.IsMulticast() {
		return ""
	}

	now := time.Now()
	ipLocationCacheLock.RLock()
	cacheItem, ok := ipLocationCache[cleanIP]
	ipLocationCacheLock.RUnlock()
	if ok && cacheItem.ExpiredAt.After(now) {
		return cacheItem.Location
	}

	location := fetchIPLocation(cleanIP)
	ipLocationCacheLock.Lock()
	ipLocationCache[cleanIP] = ipLocationCacheItem{
		Location:  location,
		ExpiredAt: now.Add(ipLocationCacheTTL),
	}
	ipLocationCacheLock.Unlock()
	return location
}

func fetchIPLocation(ip string) string {
	apiURL := strings.TrimSpace(common.GetEnvOrDefaultString("IPINFO_DKLY_API_URL", defaultIPLocationAPIURL))
	apiKey := strings.TrimSpace(common.GetEnvOrDefaultString("IPINFO_DKLY_API_KEY", defaultIPLocationAPIKey))
	if apiURL == "" || apiKey == "" {
		return ""
	}

	endpoint := fmt.Sprintf("%s?key=%s&ip=%s", strings.TrimRight(apiURL, "/")+"/", url.QueryEscape(apiKey), url.QueryEscape(ip))
	request, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return ""
	}

	response, err := ipLocationHTTP.Do(request)
	if err != nil {
		return ""
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return ""
	}

	var payload ipLocationResponse
	if err = common.DecodeJson(response.Body, &payload); err != nil {
		return ""
	}
	if payload.Security.IsBogon {
		return ""
	}

	parts := make([]string, 0, 3)
	if x := strings.TrimSpace(payload.Location.Country.Name); x != "" {
		parts = append(parts, x)
	}
	if x := strings.TrimSpace(payload.Location.Region.Name); x != "" {
		parts = append(parts, x)
	}
	if x := strings.TrimSpace(payload.Location.City); x != "" {
		parts = append(parts, x)
	}
	return strings.Join(parts, " / ")
}
