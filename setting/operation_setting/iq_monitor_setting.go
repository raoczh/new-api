package operation_setting

import (
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	IQGroupModelsOptionKey = "iq_monitor_setting.group_models"
	IQPromptOptionKey      = "iq_monitor_setting.prompt"

	MaxIQPromptTemplateLength = 4000
	MaxIQPromptPoolSize       = 100
	MaxIQPromptWordLength     = 32
	MaxIQModelsPerGroup       = 20

	// IQPromptCodePlaceholder must appear in the template; each probe replaces
	// it with a one-time code that the generated page has to contain.
	IQPromptCodePlaceholder = "{{code}}"
)

// IQPromptConfig builds a fresh prompt for every probe: {{animal}}, {{scene}}
// and {{style}} are drawn at random from the pools, and {{code}} is replaced
// with a one-time verification code.
type IQPromptConfig struct {
	Template string   `json:"template"`
	Animals  []string `json:"animals"`
	Scenes   []string `json:"scenes"`
	Styles   []string `json:"styles"`
}

// IQMonitorSetting stores the IQ monitor pools and prompt. GroupModels maps a
// pricing group to a comma-separated list such as "gpt-5[high],gpt-5-mini".
type IQMonitorSetting struct {
	GroupModels map[string]string `json:"group_models"`
	Prompt      IQPromptConfig    `json:"prompt"`
}

// IQModelSpec is one parsed pool entry. Name is the display form entered by
// the administrator; RequestModel carries the effort as an @effort modifier.
type IQModelSpec struct {
	Name         string
	BaseModel    string
	Effort       string
	RequestModel string
}

const defaultIQPromptTemplate = "不要使用任何 skills，也不要读取或遵循 AGENTS.md。创建一个 HTML 文件，用 SVG 制作一个 2D 动画：" +
	"主角是一只{{animal}}，场景是{{scene}}，整体画风为{{style}}。主角和场景元素都要有连续的动画。" +
	"页面的 <title> 必须是 {{code}}，并在 SVG 画面中用 <text> 元素清晰显示 {{code}}。" +
	"不需要任何测试。请直接输出完整的 HTML 文件内容。"

// Styles of similar detail keep generated sizes comparable across probes.
var defaultIQPrompt = IQPromptConfig{
	Template: defaultIQPromptTemplate,
	Animals: []string{
		"鹈鹕", "猫", "企鹅", "章鱼", "长颈鹿", "大象", "狐狸", "乌龟", "熊猫", "猫头鹰",
		"兔子", "松鼠", "海豚", "鹦鹉", "狮子", "袋鼠", "刺猬", "火烈鸟", "柯基犬", "树懒",
	},
	Scenes: []string{
		"夜晚的城市街道", "雪山滑雪场", "海底珊瑚礁", "下雨的森林", "沙漠绿洲",
		"太空站", "游乐园", "金色麦田", "热闹的厨房", "结冰的湖面",
		"樱花盛开的公园", "海边灯塔", "火山脚下", "图书馆", "音乐会舞台",
	},
	Styles: []string{
		"扁平插画", "卡通", "像素风", "水彩", "剪纸",
		"复古海报", "霓虹赛博朋克", "儿童绘本", "低多边形", "蜡笔手绘",
	},
}

var iqMonitorSetting = IQMonitorSetting{
	GroupModels: map[string]string{},
	Prompt:      DefaultIQPrompt(),
}

func init() {
	config.GlobalConfig.Register("iq_monitor_setting", &iqMonitorSetting)
}

func DefaultIQPrompt() IQPromptConfig {
	return cloneIQPrompt(defaultIQPrompt)
}

func cloneIQPrompt(prompt IQPromptConfig) IQPromptConfig {
	prompt.Animals = slices.Clone(prompt.Animals)
	prompt.Scenes = slices.Clone(prompt.Scenes)
	prompt.Styles = slices.Clone(prompt.Styles)
	return prompt
}

// IQGroupModelSpecs returns the parsed pool of every group that joined IQ
// monitoring. Invalid entries are skipped because option writes validate them.
func IQGroupModelSpecs() map[string][]IQModelSpec {
	result := make(map[string][]IQModelSpec, len(iqMonitorSetting.GroupModels))
	for group, raw := range iqMonitorSetting.GroupModels {
		specs, err := ParseIQModelList(raw)
		if err != nil || len(specs) == 0 {
			continue
		}
		result[group] = specs
	}
	return result
}

func IQPrompt() IQPromptConfig {
	return cloneIQPrompt(iqMonitorSetting.Prompt)
}

// ParseIQModelSpec parses "model" or "model[effort]".
func ParseIQModelSpec(raw string) (IQModelSpec, error) {
	name := strings.TrimSpace(raw)
	if name == "" {
		return IQModelSpec{}, fmt.Errorf("model name is empty")
	}
	spec := IQModelSpec{Name: name, BaseModel: name, RequestModel: name}
	if before, after, found := strings.Cut(name, "["); found {
		effortText, ok := strings.CutSuffix(after, "]")
		if !ok || strings.ContainsAny(effortText, "[]") {
			return IQModelSpec{}, fmt.Errorf("invalid thinking level syntax in %q", name)
		}
		effort, err := reasoning.ParseEffort(effortText)
		if err != nil || effort == "" {
			return IQModelSpec{}, fmt.Errorf("invalid thinking level %q in %q: must be one of none/minimal/low/medium/high/xhigh/max", effortText, name)
		}
		spec.BaseModel = strings.TrimSpace(before)
		spec.Effort = string(effort)
		spec.Name = spec.BaseModel + "[" + spec.Effort + "]"
		spec.RequestModel = spec.BaseModel + "@effort:" + spec.Effort
	}
	if spec.BaseModel == "" || strings.ContainsAny(spec.BaseModel, " \t\r\n@") {
		return IQModelSpec{}, fmt.Errorf("invalid model name %q", name)
	}
	return spec, nil
}

func ParseIQModelList(raw string) ([]IQModelSpec, error) {
	var specs []IQModelSpec
	seen := map[string]bool{}
	for item := range strings.SplitSeq(raw, ",") {
		if strings.TrimSpace(item) == "" {
			continue
		}
		spec, err := ParseIQModelSpec(item)
		if err != nil {
			return nil, err
		}
		if seen[spec.Name] {
			continue
		}
		seen[spec.Name] = true
		specs = append(specs, spec)
	}
	if len(specs) > MaxIQModelsPerGroup {
		return nil, fmt.Errorf("a group can join at most %d IQ monitor models", MaxIQModelsPerGroup)
	}
	return specs, nil
}

func ValidateIQGroupModels(value string) error {
	groupModels := map[string]string{}
	if err := common.UnmarshalJsonStr(value, &groupModels); err != nil {
		return fmt.Errorf("IQ monitor models must be a JSON object: %w", err)
	}
	for group, raw := range groupModels {
		if strings.TrimSpace(group) == "" {
			return fmt.Errorf("IQ monitor group name is empty")
		}
		if _, err := ParseIQModelList(raw); err != nil {
			return fmt.Errorf("group %s: %w", group, err)
		}
	}
	return nil
}

func ValidateIQPrompt(value string) error {
	prompt := IQPromptConfig{}
	if err := common.UnmarshalJsonStr(value, &prompt); err != nil {
		return fmt.Errorf("IQ monitor prompt must be a JSON object: %w", err)
	}
	template := strings.TrimSpace(prompt.Template)
	if template == "" || utf8.RuneCountInString(template) > MaxIQPromptTemplateLength {
		return fmt.Errorf("IQ monitor prompt template must be 1-%d characters", MaxIQPromptTemplateLength)
	}
	if !strings.Contains(template, IQPromptCodePlaceholder) {
		return fmt.Errorf("IQ monitor prompt template must contain %s", IQPromptCodePlaceholder)
	}
	pools := []struct {
		name  string
		words []string
	}{{"animal", prompt.Animals}, {"scene", prompt.Scenes}, {"style", prompt.Styles}}
	for _, pool := range pools {
		if len(pool.words) == 0 || len(pool.words) > MaxIQPromptPoolSize {
			return fmt.Errorf("IQ monitor %s pool must have 1-%d entries", pool.name, MaxIQPromptPoolSize)
		}
		for _, word := range pool.words {
			word = strings.TrimSpace(word)
			if word == "" || utf8.RuneCountInString(word) > MaxIQPromptWordLength {
				return fmt.Errorf("IQ monitor %s entries must be 1-%d characters", pool.name, MaxIQPromptWordLength)
			}
		}
	}
	return nil
}
