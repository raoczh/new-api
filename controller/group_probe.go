package controller

import (
	"context"
	"fmt"
	"math/rand/v2"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

type groupProbeHandler struct{}

func (groupProbeHandler) Type() string            { return model.SystemTaskTypeGroupProbe }
func (groupProbeHandler) Enabled() bool           { return perf_metrics_setting.GetSetting().Enabled }
func (groupProbeHandler) Interval() time.Duration { return 30 * time.Minute }
func (groupProbeHandler) NewPayload() any         { return nil }

type groupProbeRotation struct {
	LastModel string   `json:"last_model"`
	Remaining []string `json:"remaining"`
}

// Next rotates through a shuffled bag. Each currently available model is
// selected once before reshuffling, and adjacent rounds do not repeat a model
// when another model is available. State is saved on the leased system task.
func (rotation *groupProbeRotation) Next(models []string) string {
	remaining := make([]string, 0, len(rotation.Remaining))
	for _, name := range rotation.Remaining {
		if slices.Contains(models, name) && !slices.Contains(remaining, name) {
			remaining = append(remaining, name)
		}
	}
	if len(remaining) == 0 {
		remaining = slices.Clone(models)
		rand.Shuffle(len(remaining), func(i, j int) { remaining[i], remaining[j] = remaining[j], remaining[i] })
	}
	if len(remaining) == 0 {
		rotation.Remaining = nil
		return ""
	}
	if len(remaining) > 1 && remaining[0] == rotation.LastModel {
		remaining[0], remaining[1] = remaining[1], remaining[0]
	}
	rotation.LastModel = remaining[0]
	rotation.Remaining = remaining[1:]
	return rotation.LastModel
}

type groupProbeState struct {
	Rotations map[string]*groupProbeRotation `json:"rotations"`
	Tested    int                            `json:"tested"`
	Succeeded int                            `json:"succeeded"`
	Failed    int                            `json:"failed"`
	Skipped   int                            `json:"skipped"`
}

// probeEndpoint only accepts protocols with small synchronous test requests.
// Generative media and async task plugins require a different probe contract.
func probeEndpoint(modelName string, endpoints []constant.EndpointType) string {
	name := strings.ToLower(modelName)
	if common.IsImageGenerationModel(name) || strings.Contains(name, "image") ||
		strings.Contains(name, "seedream") || strings.Contains(name, "video") ||
		strings.Contains(name, "sora") || strings.Contains(name, "audio") ||
		strings.Contains(name, "tts") || strings.Contains(name, "whisper") ||
		slices.Contains(endpoints, constant.EndpointTypeImageGeneration) ||
		slices.Contains(endpoints, constant.EndpointTypeOpenAIVideo) {
		return ""
	}
	// Generic OpenAI-compatible channels infer embedding/rerank protocols from
	// model names, just as the existing administrator test does.
	if slices.Contains(endpoints, constant.EndpointTypeEmbeddings) {
		return string(constant.EndpointTypeEmbeddings)
	}
	if slices.Contains(endpoints, constant.EndpointTypeJinaRerank) {
		return string(constant.EndpointTypeJinaRerank)
	}
	if slices.Contains(endpoints, constant.EndpointTypeOpenAI) {
		if strings.Contains(name, "rerank") {
			return string(constant.EndpointTypeJinaRerank)
		}
		if strings.Contains(name, "embed") || strings.HasPrefix(name, "m3e") || strings.Contains(name, "bge-") {
			return string(constant.EndpointTypeEmbeddings)
		}
		if strings.Contains(name, "codex") || common.IsOpenAIResponseOnlyModel(name) {
			return string(constant.EndpointTypeOpenAIResponse)
		}
	}
	for _, endpoint := range endpoints {
		switch endpoint {
		case constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse,
			constant.EndpointTypeAnthropic, constant.EndpointTypeGemini,
			constant.EndpointTypeEmbeddings, constant.EndpointTypeJinaRerank:
			return string(endpoint)
		}
	}
	return ""
}

func (groupProbeHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	state := groupProbeState{Rotations: map[string]*groupProbeRotation{}}
	previous, err := model.GetPreviousSystemTask(task.Type, task.ID)
	if err == nil && previous != nil {
		err = previous.DecodeState(&state)
	}
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	if state.Rotations == nil {
		state.Rotations = map[string]*groupProbeRotation{}
	}
	state.Tested, state.Succeeded, state.Failed, state.Skipped = 0, 0, 0, 0
	userID, err := resolveChannelTestUserID(nil)
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	groupModels := map[string][]string{}
	for _, pricing := range model.GetPricing() {
		endpoint := probeEndpoint(pricing.ModelName, pricing.SupportedEndpointTypes)
		if endpoint == "" {
			continue
		}
		for _, group := range pricing.EnableGroup {
			if ratio_setting.ContainsGroupRatio(group) {
				groupModels[group] = append(groupModels[group], pricing.ModelName)
			}
		}
	}
	groups := make([]string, 0, len(groupModels))
	for group := range groupModels {
		groups = append(groups, group)
	}
	slices.Sort(groups)
	for _, group := range groups {
		if ctx.Err() != nil || !perf_metrics_setting.GetSetting().Enabled {
			break
		}
		rotation := state.Rotations[group]
		if rotation == nil {
			rotation = &groupProbeRotation{}
			state.Rotations[group] = rotation
		}
		models := groupModels[group]
		slices.Sort(models)
		models = slices.Compact(models)
		name := rotation.Next(models)
		// Persist before making a paid request so interruptions retain rotation.
		if err = model.UpdateSystemTaskState(task.TaskID, runnerID, state); err != nil {
			finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, state, err)
			return
		}
		channel, selectErr := model.GetRandomSatisfiedChannel(group, name, 0, nil)
		if selectErr != nil || channel == nil || channel.Type == constant.ChannelTypeTaskPlugin {
			state.Skipped++
			continue
		}
		// Choose the protocol supported by the selected channel, since pricing
		// combines capabilities from all channels that offer the same model.
		channelEndpoints := common.GetEndpointTypesByChannelType(channel.Type, name)
		config := channel.GetOtherSettings().AdvancedCustom
		if config != nil {
			channelEndpoints = config.SupportedEndpointTypesForModel(name)
		} else if slices.Contains(channelEndpoints, constant.EndpointTypeOpenAI) {
			// Catalog metadata also identifies embedding/rerank aliases whose
			// names cannot be inferred by the generic channel test.
			for _, endpoint := range model.GetModelSupportEndpointTypes(name) {
				if endpoint == constant.EndpointTypeEmbeddings || endpoint == constant.EndpointTypeJinaRerank {
					channelEndpoints = append(channelEndpoints, endpoint)
				}
			}
		}
		if channel.Type == constant.ChannelTypeMokaAI {
			channelEndpoints = []constant.EndpointType{constant.EndpointTypeEmbeddings}
		}
		endpoint := probeEndpoint(name, channelEndpoints)
		if endpoint == "" {
			state.Skipped++
			continue
		}
		probeCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
		result := runChannelTest(probeCtx, channel, userID, name, endpoint, shouldUseStreamForAutomaticChannelTest(channel), channelTestOptions{group: group, probe: true})
		cancel()
		state.Tested++
		if result.localErr != nil || result.newAPIError != nil {
			state.Failed++
		} else {
			state.Succeeded++
		}
	}
	if err = model.UpdateSystemTaskState(task.TaskID, runnerID, state); err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, state, err)
		return
	}
	if ctx.Err() != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, state, ctx.Err())
		return
	}
	if state.Failed > 0 {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, state, fmt.Errorf("%d group probes failed", state.Failed))
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, state, nil)
}
