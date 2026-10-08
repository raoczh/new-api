package perfmetrics

import (
	"math"
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
)

// StatusHours is the fixed number of hourly cells shown per group.
const StatusHours = 24

// lastSeenByGroup keeps the precise unix time of the latest sample per group
// on this node; the stored hourly buckets only give hour resolution.
var lastSeenByGroup sync.Map

type GroupHourPoint struct {
	Ts          int64   `json:"ts"`
	SuccessRate float64 `json:"success_rate"`
	AvgTtftMs   int64   `json:"avg_ttft_ms"`
	TopModel    string  `json:"top_model"`
}

type GroupModelStat struct {
	ModelName    string  `json:"model_name"`
	SuccessRate  float64 `json:"success_rate"`
	AvgTtftMs    int64   `json:"avg_ttft_ms"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	AvgTps       float64 `json:"avg_tps"`
}

type GroupSummary struct {
	SuccessRate  float64 `json:"success_rate"`
	AvgTtftMs    int64   `json:"avg_ttft_ms"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	AvgTps       float64 `json:"avg_tps"`
}

type GroupStatus struct {
	Group       string `json:"group"`
	Description string `json:"description"`
	VendorID    int    `json:"vendor_id"`
	// Summary covers the selected window; nil when the group has no samples.
	Summary    *GroupSummary    `json:"summary"`
	LastSeenTs int64            `json:"last_seen_ts"`
	Hourly     []GroupHourPoint `json:"hourly"`
	Models     []GroupModelStat `json:"models"`
}

type GroupStatusVendor struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Icon string `json:"icon,omitempty"`
}

type GroupStatusResult struct {
	WindowStart int64               `json:"window_start"`
	WindowEnd   int64               `json:"window_end"`
	HourlyStart int64               `json:"hourly_start"`
	Vendors     []GroupStatusVendor `json:"vendors"`
	Groups      []GroupStatus       `json:"groups"`
}

type groupAggregate struct {
	total      counters
	models     map[string]counters
	hours      map[int64]map[string]counters
	lastBucket int64
}

// QueryGroupStatus reports per-group health: the last StatusHours hourly
// cells plus window totals and a per-model breakdown. groupDescs maps every
// group the caller may see to its display description; groups without
// samples are still returned so they can be shown as "pending".
func QueryGroupStatus(hours int, groupDescs map[string]string) (GroupStatusResult, error) {
	now := time.Now()
	startTs, endTs := queryWindow(now, hours)
	hourlyStart, _ := queryWindow(now, StatusHours)
	queryStart := min(startTs, hourlyStart)

	names := make([]string, 0, len(groupDescs))
	for name := range groupDescs {
		names = append(names, name)
	}
	rows, err := model.GetPerfMetricsGroupRows(queryStart, endTs, names)
	if err != nil {
		return GroupStatusResult{}, err
	}

	merged := map[bucketKey]counters{}
	for _, row := range rows {
		mergeCounters(merged, bucketKey{model: row.ModelName, group: row.GroupName, bucketTs: row.BucketTs}, counters{
			requestCount:   row.RequestCount,
			successCount:   row.SuccessCount,
			totalLatencyMs: row.TotalLatencyMs,
			ttftSumMs:      row.TtftSumMs,
			ttftCount:      row.TtftCount,
			outputTokens:   row.OutputTokens,
			generationMs:   row.GenerationMs,
		})
	}
	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.bucketTs < queryStart || k.bucketTs > endTs {
			return true
		}
		if _, ok := groupDescs[k.group]; !ok {
			return true
		}
		mergeCounters(merged, k, value.(*atomicBucket).snapshot())
		return true
	})

	aggregates := map[string]*groupAggregate{}
	for key, value := range merged {
		agg, ok := aggregates[key.group]
		if !ok {
			agg = &groupAggregate{models: map[string]counters{}, hours: map[int64]map[string]counters{}}
			aggregates[key.group] = agg
		}
		agg.lastBucket = max(agg.lastBucket, key.bucketTs)
		if key.bucketTs >= startTs {
			agg.total.add(value)
			modelTotal := agg.models[key.model]
			modelTotal.add(value)
			agg.models[key.model] = modelTotal
		}
		if key.bucketTs >= hourlyStart {
			hourTs := key.bucketTs - key.bucketTs%3600
			if _, ok := agg.hours[hourTs]; !ok {
				agg.hours[hourTs] = map[string]counters{}
			}
			hourModel := agg.hours[hourTs][key.model]
			hourModel.add(value)
			agg.hours[hourTs][key.model] = hourModel
		}
	}

	modelVendors, groupEnabledVendors := pricingVendorIndex()
	usedVendors := map[int]struct{}{}
	groups := make([]GroupStatus, 0, len(groupDescs))
	requestCounts := map[string]int64{}
	for name, desc := range groupDescs {
		status := GroupStatus{Group: name, Description: desc, Hourly: []GroupHourPoint{}, Models: []GroupModelStat{}}
		agg := aggregates[name]
		if agg != nil {
			if agg.total.requestCount > 0 {
				status.Summary = &GroupSummary{
					SuccessRate:  roundRate(successRate(agg.total)),
					AvgTtftMs:    avg(agg.total.ttftSumMs, agg.total.ttftCount),
					AvgLatencyMs: avg(agg.total.totalLatencyMs, agg.total.requestCount),
					AvgTps:       roundRate(avgTps(agg.total)),
				}
			}
			status.Hourly = groupHourly(agg.hours)
			status.Models = groupModels(agg.models)
			status.LastSeenTs = agg.lastBucket
			requestCounts[name] = agg.total.requestCount
		}
		if seen, ok := lastSeenByGroup.Load(name); ok {
			status.LastSeenTs = max(status.LastSeenTs, seen.(int64))
		}
		// Vendor follows the most requested model; idle groups fall back to
		// the vendor most of their enabled models belong to.
		if len(status.Models) > 0 {
			status.VendorID = modelVendors[status.Models[0].ModelName]
		}
		if status.VendorID == 0 {
			status.VendorID = mostCommonVendor(groupEnabledVendors[name])
		}
		usedVendors[status.VendorID] = struct{}{}
		groups = append(groups, status)
	}
	sort.Slice(groups, func(i, j int) bool {
		if requestCounts[groups[i].Group] != requestCounts[groups[j].Group] {
			return requestCounts[groups[i].Group] > requestCounts[groups[j].Group]
		}
		return groups[i].Group < groups[j].Group
	})

	vendors := make([]GroupStatusVendor, 0, len(usedVendors))
	for _, vendor := range model.GetVendors() {
		if _, ok := usedVendors[vendor.ID]; ok {
			vendors = append(vendors, GroupStatusVendor{ID: vendor.ID, Name: vendor.Name, Icon: vendor.Icon})
		}
	}
	sort.Slice(vendors, func(i, j int) bool { return vendors[i].Name < vendors[j].Name })

	return GroupStatusResult{
		WindowStart: startTs,
		WindowEnd:   endTs,
		HourlyStart: hourlyStart,
		Vendors:     vendors,
		Groups:      groups,
	}, nil
}

// pricingVendorIndex maps each enabled model to its vendor, and each group to
// the vendors of its enabled models (one entry per model).
func pricingVendorIndex() (map[string]int, map[string][]int) {
	modelVendors := map[string]int{}
	groupVendors := map[string][]int{}
	for _, pricing := range model.GetPricing() {
		modelVendors[pricing.ModelName] = pricing.VendorID
		if pricing.VendorID == 0 {
			continue
		}
		for _, group := range pricing.EnableGroup {
			groupVendors[group] = append(groupVendors[group], pricing.VendorID)
		}
	}
	return modelVendors, groupVendors
}

func mostCommonVendor(vendorIDs []int) int {
	counts := map[int]int{}
	best := 0
	for _, id := range vendorIDs {
		counts[id]++
		if counts[id] > counts[best] || (counts[id] == counts[best] && id < best) {
			best = id
		}
	}
	return best
}

func groupHourly(hours map[int64]map[string]counters) []GroupHourPoint {
	points := make([]GroupHourPoint, 0, len(hours))
	for hourTs, models := range hours {
		total := counters{}
		topModel := ""
		var topCount int64
		for name, value := range models {
			total.add(value)
			if value.requestCount > topCount || (value.requestCount == topCount && name < topModel) {
				topModel, topCount = name, value.requestCount
			}
		}
		if total.requestCount == 0 {
			continue
		}
		points = append(points, GroupHourPoint{
			Ts:          hourTs,
			SuccessRate: roundRate(successRate(total)),
			AvgTtftMs:   avg(total.ttftSumMs, total.ttftCount),
			TopModel:    topModel,
		})
	}
	sort.Slice(points, func(i, j int) bool { return points[i].Ts < points[j].Ts })
	return points
}

func groupModels(models map[string]counters) []GroupModelStat {
	names := make([]string, 0, len(models))
	for name, value := range models {
		if value.requestCount > 0 {
			names = append(names, name)
		}
	}
	sort.Slice(names, func(i, j int) bool {
		a, b := models[names[i]].requestCount, models[names[j]].requestCount
		if a != b {
			return a > b
		}
		return names[i] < names[j]
	})
	stats := make([]GroupModelStat, 0, len(names))
	for _, name := range names {
		value := models[name]
		stats = append(stats, GroupModelStat{
			ModelName:    name,
			SuccessRate:  roundRate(successRate(value)),
			AvgTtftMs:    avg(value.ttftSumMs, value.ttftCount),
			AvgLatencyMs: avg(value.totalLatencyMs, value.requestCount),
			AvgTps:       roundRate(avgTps(value)),
		})
	}
	return stats
}

func roundRate(value float64) float64 {
	return math.Round(value*100) / 100
}
