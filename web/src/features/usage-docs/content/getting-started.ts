/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { both, type DocPage, type DocUrls } from '../types'

export function buildGettingStartedPages(urls: DocUrls): DocPage[] {
  const { site, api } = urls

  return [
    {
      slug: '',
      title: { en: 'Introduction', zh: '介绍' },
      summary: {
        en: 'What this gateway is, the addresses to use, and the three API dialects one key unlocks.',
        zh: '本站是什么、该填哪个地址，以及一把密钥可以调用的三种接口协议。',
      },
      sections: [
        {
          id: 'overview',
          title: { en: 'Overview', zh: '概览' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'This site is a multi-model AI gateway. With one API key and one stable address you can call Claude, GPT, Gemini, DeepSeek and other models from SDKs, coding agents and everyday chat apps. Requests are routed to available upstream channels, and every call is metered and logged in your console.',
                zh: '本站是一个多模型 AI 网关。用一把 API 密钥、一个稳定地址，就能在 SDK、编程智能体和日常聊天软件里调用 Claude、GPT、Gemini、DeepSeek 等模型。请求会被路由到可用的上游渠道，每次调用都会计量并记录在控制台中。',
              },
            },
          ],
        },
        {
          id: 'base-url',
          title: { en: 'Base URL', zh: '基础地址' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Most problems come from the wrong address. OpenAI-compatible clients use the address with /v1; Anthropic (Claude) and Gemini clients use the site root and add their own path.',
                zh: '大多数接入问题都出在地址上。OpenAI 兼容客户端用带 /v1 的地址；Anthropic（Claude）和 Gemini 客户端用站点根地址，接口路径由软件自己拼接。',
              },
            },
            {
              type: 'code',
              label: 'Base URL',
              code: `OpenAI-compatible   ${api}\nAnthropic / Claude  ${site}\nGemini native       ${site}`,
            },
            {
              type: 'p',
              text: {
                en: 'Never paste a full endpoint such as `/v1/chat/completions` into a “Base URL” field. If a client says it appends /v1 by itself, enter the site root instead, so the final address never contains /v1/v1.',
                zh: '“基础地址”一栏不要填 `/v1/chat/completions` 之类的完整接口路径。如果软件说明会自动补 /v1，就填站点根地址，避免最终地址出现 /v1/v1。',
              },
            },
          ],
        },
        {
          id: 'dialects',
          title: { en: 'Three API dialects', zh: '三种接口协议' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'The same key works with all three. The gateway converts between protocols where it can, so most chat models can be called from any of them; a model that only supports one protocol returns a clear error instead.',
                zh: '同一把密钥三种协议通用。网关会在可行时做协议转换，多数对话模型可以跨协议调用；只支持特定协议的模型会返回明确的错误。',
              },
            },
            {
              type: 'table',
              head: [
                { en: 'Dialect', zh: '协议' },
                { en: 'Main endpoint', zh: '主要入口' },
                { en: 'Auth header', zh: '鉴权请求头' },
                { en: 'Typical clients', zh: '典型客户端' },
              ],
              rows: [
                [
                  { en: 'OpenAI-compatible', zh: 'OpenAI 兼容' },
                  both('POST /v1/chat/completions, POST /v1/responses'),
                  both('Authorization: Bearer'),
                  {
                    en: 'OpenAI SDK, Codex, Cherry Studio, most chat apps',
                    zh: 'OpenAI SDK、Codex、Cherry Studio 及大多数聊天软件',
                  },
                ],
                [
                  { en: 'Anthropic-compatible', zh: 'Anthropic 兼容' },
                  both('POST /v1/messages'),
                  both('x-api-key / Authorization: Bearer'),
                  {
                    en: 'Anthropic SDK, Claude Code',
                    zh: 'Anthropic SDK、Claude Code',
                  },
                ],
                [
                  { en: 'Gemini-compatible', zh: 'Gemini 兼容' },
                  both('POST /v1beta/models/{model}:generateContent'),
                  both('x-goog-api-key'),
                  {
                    en: 'Google GenAI SDK, Gemini CLI',
                    zh: 'Google GenAI SDK、Gemini CLI',
                  },
                ],
              ],
            },
          ],
        },
        {
          id: 'capabilities',
          title: { en: 'Core capabilities', zh: '核心能力' },
          blocks: [
            {
              type: 'bullets',
              items: [
                {
                  en: 'Routing and automatic retry: each request is sent to an available upstream channel. When a channel fails before any output is returned, the gateway retries on another channel, and conversations can stay on the same channel to keep prompt-cache hits.',
                  zh: '智能路由与故障重试：每个请求会发往可用的上游渠道。渠道在返回内容之前失败时，网关会自动换渠道重试；同一会话可以保持在同一渠道上，以提高缓存命中。',
                },
                {
                  en: 'Pay-as-you-go by token: input, output and cache tokens are priced separately, some models charge per request, and every call appears in your usage logs with its model, tokens and cost.',
                  zh: '按 token 计费：输入、输出和缓存 token 分别计价，部分模型按次计费；每次调用都会出现在使用日志中，包含模型、token 数和费用。',
                },
                {
                  en: 'Per-key controls: each API key can have its own group, quota, expiry, allowed models and IP whitelist, so one leaked or runaway key cannot drain the whole account.',
                  zh: '密钥级限制：每把 API 密钥可单独设置分组、额度、有效期、可用模型和 IP 白名单，单把密钥泄露或失控不会拖垮整个账户。',
                },
                {
                  en: 'Public status monitor: availability and latency of each model are shown on the Status Monitor page, so you can tell a local configuration problem from an upstream outage.',
                  zh: '状态监控：状态监控页公开展示各模型的可用率和延迟，便于区分是自己配置的问题还是上游故障。',
                },
                {
                  en: 'Model Square with live pricing: browse every model available to you, its exact model ID, supported endpoints and the price for each group.',
                  zh: '模型广场与实时价格：查看当前可用的全部模型、准确的模型 ID、支持的接口类型以及各分组价格。',
                },
                {
                  en: 'Wallet, redemption codes and tickets: top up or redeem in the console, and open a ticket when something needs the operator.',
                  zh: '钱包、兑换码与工单：在控制台充值或兑换额度，需要运营方处理时可直接提交工单。',
                },
              ],
            },
          ],
        },
        {
          id: 'next-steps',
          title: { en: 'Next steps', zh: '下一步' },
          blocks: [
            {
              type: 'docLinks',
              items: [
                {
                  slug: 'quickstart',
                  text: {
                    en: 'Quick start: send your first request in five minutes',
                    zh: '快速开始：五分钟发出第一条请求',
                  },
                },
                {
                  slug: 'config/ccswitch',
                  text: {
                    en: 'Connect Claude Code, Codex and other agents with CC Switch',
                    zh: '用 CC Switch 接入 Claude Code、Codex 等工具',
                  },
                },
                {
                  slug: 'config/office',
                  text: {
                    en: 'Set up chat, translation and office apps',
                    zh: '配置聊天、翻译和办公类软件',
                  },
                },
                {
                  slug: 'api/errors',
                  text: { en: 'Look up an error code', zh: '查询错误码' },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'apikey',
      title: { en: 'API Key', zh: 'API 密钥' },
      summary: {
        en: 'Create a key, choose its restrictions and keep it safe.',
        zh: '创建密钥、设置限制并妥善保管。',
      },
      sections: [
        {
          id: 'account',
          title: { en: 'Account and balance', zh: '账号与余额' },
          blocks: [
            {
              type: 'steps',
              items: [
                {
                  en: 'Register or sign in. If registration is closed, contact the operator using the methods on the “Contact support” section of the Error handling page.',
                  zh: '先注册并登录本站。如果暂未开放注册，请通过“错误处理与重试”页中的联系方式联系运营方。',
                },
                {
                  en: 'Top up or redeem before you start. A redemption code adds balance in Wallet; it is not an API key. Confirm the balance changed after redeeming.',
                  zh: '开始前先充值或兑换：兑换码在“钱包”中增加余额，它不是 API 密钥。兑换后确认余额确实变了。',
                },
              ],
            },
            {
              type: 'appLinks',
              items: [
                { to: '/wallet', text: { en: 'Open Wallet', zh: '打开钱包' } },
              ],
            },
          ],
        },
        {
          id: 'create-key',
          title: { en: 'Create a key', zh: '创建密钥' },
          blocks: [
            {
              type: 'steps',
              items: [
                {
                  en: 'Open API Keys in the console and select Create API Key.',
                  zh: '进入控制台“API 密钥”页面，点击“创建 API 密钥”。',
                },
                {
                  en: 'Give it a name that says where it is used, such as Codex, Claude Code or Cherry Studio. One key per app makes usage easy to tell apart.',
                  zh: '名称写明用途，例如 Codex、Claude Code、Cherry Studio。每个软件单独一把密钥，便于区分用量和排查问题。',
                },
                {
                  en: 'Copy the complete key. It starts with sk- and is the “API Key” every page of this documentation refers to.',
                  zh: '复制完整密钥，以 sk- 开头。本文档所有页面里说的“API Key”都是这把密钥。',
                },
              ],
            },
            {
              type: 'appLinks',
              items: [
                {
                  to: '/keys',
                  text: { en: 'Open API Keys', zh: '打开 API 密钥' },
                },
              ],
            },
          ],
        },
        {
          id: 'restrictions',
          title: { en: 'Key settings', zh: '密钥设置项' },
          blocks: [
            {
              type: 'table',
              head: [
                { en: 'Setting', zh: '设置项' },
                { en: 'What it does', zh: '作用' },
              ],
              rows: [
                [
                  { en: 'Group', zh: '分组' },
                  {
                    en: 'Selects the upstream channels and the price multiplier the key uses. Model Square shows the price per group. The auto group tries groups in the configured order.',
                    zh: '决定这把密钥使用哪组上游渠道和价格倍率，模型广场可查看各分组价格。auto 分组会按配置的顺序依次尝试各分组。',
                  },
                ],
                [
                  { en: 'Cross-group retry', zh: '跨分组重试' },
                  {
                    en: 'Available with the auto group. When channels in the current group fail, the next group in order is tried.',
                    zh: '选择 auto 分组时可用。当前分组的渠道失败后，会按顺序尝试下一个分组。',
                  },
                ],
                [
                  { en: 'Quota', zh: '额度' },
                  {
                    en: 'Caps how much this key can spend. When it runs out, requests with this key fail even if the account still has balance. Unlimited quota spends from the account balance only.',
                    zh: '限制这把密钥最多能消费多少。用完后，即使账户还有余额，这把密钥的请求也会失败。无限额度则只受账户余额限制。',
                  },
                ],
                [
                  { en: 'Expiration time', zh: '过期时间' },
                  {
                    en: 'After this time the key stops working. Use short expiry for temporary or shared keys.',
                    zh: '到期后密钥失效。临时或共享使用的密钥建议设置较短有效期。',
                  },
                ],
                [
                  { en: 'Model limits', zh: '模型限制' },
                  {
                    en: 'Only the listed models can be called, and /v1/models returns only those models for this key.',
                    zh: '只能调用列出的模型，/v1/models 也只会返回这些模型。',
                  },
                ],
                [
                  { en: 'IP whitelist', zh: 'IP 白名单' },
                  {
                    en: 'Only requests from these IPs or CIDR ranges are accepted. Leave it empty for laptops or changing networks.',
                    zh: '只接受来自这些 IP 或 CIDR 网段的请求。笔记本或网络经常变化时请留空。',
                  },
                ],
              ],
            },
            {
              type: 'note',
              text: {
                en: 'For a first test, allow the model you plan to use and keep quota and expiry generous. A key restricted to other models cannot call this one, whatever the account balance.',
                zh: '首次测试时，确认密钥允许目标模型，额度和有效期不要卡得太紧。密钥若只允许其他模型，无论账户余额多少都无法调用当前模型。',
              },
            },
          ],
        },
        {
          id: 'key-safety',
          title: { en: 'Keep it safe', zh: '安全保管' },
          blocks: [
            {
              type: 'bullets',
              items: [
                {
                  en: 'Treat the key like a password. Never put it in a public repository, screenshot, chat message or front-end code that runs in a browser.',
                  zh: '把密钥当作密码对待。不要放进公开代码仓库、截图、聊天记录或在浏览器中运行的前端代码。',
                },
                {
                  en: 'In your own programs, read the key from an environment variable rather than writing it into source code.',
                  zh: '在自己的程序里，从环境变量读取密钥，不要写进源码。',
                },
                {
                  en: 'If a key is exposed, disable or delete it on the API Keys page and create a new one.',
                  zh: '密钥一旦泄露，立即在“API 密钥”页面停用或删除，再重新创建。',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'quickstart',
      title: { en: 'Quick start', zh: '快速开始' },
      summary: {
        en: 'Check your key, then send a first message with curl, PowerShell, Python or Node.js.',
        zh: '先验证密钥，再用 curl、PowerShell、Python 或 Node.js 发出第一条消息。',
      },
      sections: [
        {
          id: 'three-values',
          title: { en: 'The three values', zh: '只需三个参数' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Every client needs the same three values; only the place you paste them differs.',
                zh: '所有接入方式都只需要这三样东西，区别只在于填在哪里。',
              },
            },
            {
              type: 'table',
              head: [
                { en: 'Value', zh: '参数' },
                { en: 'What to enter', zh: '填写内容' },
              ],
              rows: [
                [
                  { en: 'Base URL', zh: '基础地址' },
                  {
                    en: `${api} for OpenAI-compatible clients; ${site} for Claude and Gemini clients.`,
                    zh: `OpenAI 兼容客户端填 ${api}；Claude 和 Gemini 客户端填 ${site}。`,
                  },
                ],
                [
                  both('API Key'),
                  {
                    en: 'The sk- key from the API Keys page.',
                    zh: '“API 密钥”页面创建的 sk- 密钥。',
                  },
                ],
                [
                  { en: 'Model ID', zh: '模型 ID' },
                  {
                    en: 'An exact ID copied from Model Square or /v1/models. Display names and IDs can differ.',
                    zh: '从模型广场或 /v1/models 复制的准确 ID，展示名称和 ID 可能不同。',
                  },
                ],
              ],
            },
          ],
        },
        {
          id: 'check-key',
          title: { en: 'Step 1: check the key', zh: '第一步：验证密钥' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'List the models this key can use. A JSON list means the key and network work; copy an id from it for the next step.',
                zh: '列出这把密钥可用的模型。返回 JSON 列表说明密钥和网络都正常，从中复制一个 id 用于下一步。',
              },
            },
            {
              type: 'tabs',
              samples: [
                {
                  label: 'curl',
                  code: `curl ${api}/models \\\n  -H "Authorization: Bearer sk-YOUR-KEY"`,
                },
                {
                  label: 'PowerShell',
                  code: `$key = "sk-YOUR-KEY"\nInvoke-RestMethod -Uri "${api}/models" -Headers @{ Authorization = "Bearer $key" }`,
                },
              ],
            },
          ],
        },
        {
          id: 'first-request',
          title: { en: 'Step 2: send a message', zh: '第二步：发送消息' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Replace sk-YOUR-KEY and YOUR-MODEL-ID. Keep streaming and tools off for this first test. Each successful call may consume balance.',
                zh: '替换 sk-YOUR-KEY 和 YOUR-MODEL-ID。首次测试先不开流式和工具调用。每次成功调用都可能消耗余额。',
              },
            },
            {
              type: 'tabs',
              samples: [
                {
                  label: 'curl',
                  code: `curl ${api}/chat/completions \\\n  -H "Authorization: Bearer sk-YOUR-KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"YOUR-MODEL-ID","messages":[{"role":"user","content":"Hello"}]}'`,
                },
                {
                  label: 'PowerShell',
                  code: `$key = "sk-YOUR-KEY"\n$body = @{ model = "YOUR-MODEL-ID"; messages = @(@{ role = "user"; content = "Hello" }) } | ConvertTo-Json -Depth 4\nInvoke-RestMethod -Uri "${api}/chat/completions" -Method Post -Headers @{ Authorization = "Bearer $key" } -ContentType "application/json" -Body $body`,
                },
                {
                  label: 'Python',
                  code: `# pip install openai\n# export API_KEY="sk-YOUR-KEY"   (PowerShell: $env:API_KEY = "sk-YOUR-KEY")\nimport os\nfrom openai import OpenAI\n\nclient = OpenAI(api_key=os.environ["API_KEY"], base_url="${api}")\nreply = client.chat.completions.create(\n    model="YOUR-MODEL-ID",\n    messages=[{"role": "user", "content": "Hello"}],\n)\nprint(reply.choices[0].message.content)`,
                },
                {
                  label: 'Node.js',
                  code: `// npm install openai\n// export API_KEY="sk-YOUR-KEY"\nimport OpenAI from 'openai'\n\nconst client = new OpenAI({ apiKey: process.env.API_KEY, baseURL: '${api}' })\nconst reply = await client.chat.completions.create({\n  model: 'YOUR-MODEL-ID',\n  messages: [{ role: 'user', content: 'Hello' }],\n})\nconsole.log(reply.choices[0].message.content)`,
                },
              ],
            },
            {
              type: 'p',
              text: {
                en: 'A successful reply contains `choices[0].message.content`. If it fails, look up the status code on the Error codes page.',
                zh: '成功时，响应中的 `choices[0].message.content` 就是模型回复。失败时，到“错误码”页面按状态码排查。',
              },
            },
          ],
        },
        {
          id: 'pick-route',
          title: {
            en: 'Step 3: connect your tool',
            zh: '第三步：接入你的工具',
          },
          blocks: [
            {
              type: 'docLinks',
              items: [
                {
                  slug: 'config/ccswitch',
                  text: {
                    en: 'Claude Code, Codex, OpenCode, OpenClaw, Hermes: use CC Switch',
                    zh: 'Claude Code、Codex、OpenCode、OpenClaw、Hermes：用 CC Switch 一键导入',
                  },
                },
                {
                  slug: 'config/claude-code',
                  text: {
                    en: 'Configure Claude Code by hand',
                    zh: '手动配置 Claude Code',
                  },
                },
                {
                  slug: 'config/codex',
                  text: {
                    en: 'Configure Codex CLI, IDE extension or desktop app',
                    zh: '配置 Codex CLI、IDE 插件或桌面 App',
                  },
                },
                {
                  slug: 'config/agents',
                  text: {
                    en: 'OpenClaw, Hermes Agent, DeepSeek Harness, OpenCode, Gemini CLI',
                    zh: 'OpenClaw、Hermes Agent、DeepSeek Harness、OpenCode、Gemini CLI',
                  },
                },
                {
                  slug: 'config/ide',
                  text: {
                    en: 'Cursor, Cline, Roo Code, Continue, Trae and other IDE tools',
                    zh: 'Cursor、Cline、Roo Code、Continue、Trae 等 IDE 工具',
                  },
                },
                {
                  slug: 'config/office',
                  text: {
                    en: 'WorkBuddy, Cherry Studio, Chatbox, translation and office apps',
                    zh: 'WorkBuddy、Cherry Studio、Chatbox、翻译与办公软件',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'models',
      title: { en: 'Model Square', zh: '模型广场' },
      summary: {
        en: 'Find the exact model ID, the endpoints a model supports and its price per group.',
        zh: '查找准确的模型 ID、模型支持的接口类型以及各分组价格。',
      },
      sections: [
        {
          id: 'reading',
          title: { en: 'What Model Square shows', zh: '模型广场能看到什么' },
          blocks: [
            {
              type: 'bullets',
              items: [
                {
                  en: 'Model ID: the exact value for the model field. Copy it as is, including case and punctuation.',
                  zh: '模型 ID：请求中 model 字段要填的准确值，大小写和符号都不要改。',
                },
                {
                  en: 'Endpoint type: which protocols the model can be called through, such as OpenAI chat, Responses, Anthropic or Gemini. Coding agents need a model that supports their protocol.',
                  zh: '端点类型：模型可以通过哪些协议调用，例如 OpenAI 对话、Responses、Anthropic 或 Gemini。编程智能体需要选择支持其协议的模型。',
                },
                {
                  en: 'Price: input, output and cache prices per million tokens, or a per-request price. Prices already include the selected group’s multiplier.',
                  zh: '价格：每百万 token 的输入、输出和缓存价格，或按次价格。显示的价格已包含所选分组的倍率。',
                },
                {
                  en: 'Groups: the groups that can serve the model. Your key’s group decides which price applies.',
                  zh: '分组：哪些分组可以提供这个模型。你的密钥所用的分组决定了适用哪个价格。',
                },
                {
                  en: 'Availability and latency: recent uptime and performance per group, where monitoring data exists.',
                  zh: '可用率与延迟：有监控数据时，显示各分组近期的可用率和性能。',
                },
              ],
            },
            {
              type: 'appLinks',
              items: [
                {
                  to: '/pricing',
                  text: { en: 'Open Model Square', zh: '打开模型广场' },
                },
                {
                  to: '/status-monitor',
                  text: { en: 'Open Status Monitor', zh: '打开状态监控' },
                },
              ],
            },
          ],
        },
        {
          id: 'choosing',
          title: { en: 'Choosing a model', zh: '如何选择模型' },
          blocks: [
            {
              type: 'bullets',
              items: [
                {
                  en: 'Claude Code needs a model that supports the Anthropic Messages endpoint; Codex needs one that supports the Responses endpoint. A model name alone does not prove protocol support.',
                  zh: 'Claude Code 需要支持 Anthropic Messages 接口的模型；Codex 需要支持 Responses 接口的模型。仅凭模型名字不能判断是否支持该协议。',
                },
                {
                  en: 'Chat and translation apps work with any model that supports OpenAI chat completions.',
                  zh: '聊天和翻译软件选择支持 OpenAI 对话接口的模型即可。',
                },
                {
                  en: 'Try a model in the Playground before configuring it in a client. It uses your account directly, so you can rule out client settings.',
                  zh: '配置到客户端之前，可以先在“游乐场”试用模型，排除客户端设置带来的干扰。',
                },
              ],
            },
            {
              type: 'appLinks',
              items: [
                {
                  to: '/playground',
                  text: { en: 'Open Playground', zh: '打开游乐场' },
                },
              ],
            },
          ],
        },
      ],
    },
  ]
}
