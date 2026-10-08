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
import type { Chapter, Copy } from './types'

/**
 * Documentation content. Kept free of React so the chapter structure and the
 * anchor ids the sidebar links to can be asserted in tests.
 *
 * Only `en` and `zh` are authored; other interface languages fall back to
 * English through `resolveDocLanguage`.
 */
const TRIAGE_ROWS: Array<{ tool: Copy; target: Copy }> = [
  {
    tool: { en: 'Cherry Studio, Chatbox, NextChat', zh: 'Cherry Studio、Chatbox、NextChat 等聊天客户端' },
    target: { en: 'Common client settings', zh: '常见客户端怎么填' },
  },
  {
    tool: { en: 'Claude Code', zh: 'Claude Code' },
    target: { en: 'CC Switch and Claude Code', zh: 'CC Switch 与 Claude Code' },
  },
  {
    tool: { en: 'Codex App', zh: 'Codex App' },
    target: { en: 'Codex App and SK keys', zh: 'Codex App 与 SK 密钥' },
  },
  {
    tool: { en: 'WorkBuddy, Trae', zh: 'WorkBuddy、Trae' },
    target: { en: 'WorkBuddy and Trae', zh: 'WorkBuddy 与 Trae' },
  },
  {
    tool: { en: 'My own program', zh: '自己的程序 / 代码' },
    target: { en: 'Use an SDK in your own program', zh: '在自己的程序里使用 SDK' },
  },
]

function buildTriageChapter(): Chapter {
  return {
    id: 'find-your-path',
    title: { en: 'Find your path', zh: '先看这一节' },
    topics: [
      {
        id: 'paths',
        title: { en: 'Pick the section for your tool', zh: '按你用的工具找对应章节' },
        blocks: [
          {
            type: 'p',
            text: {
              en: 'Every route needs the same three values: the site address, an API key, and a model ID. The difference is only where you paste them. Find your tool below and jump straight to that section.',
              zh: '所有接入方式需要的都是同三样东西：站点地址、API 密钥、模型 ID，区别只在于填在哪里。先在下面找到你用的工具，直接跳到对应章节。',
            },
          },
          {
            type: 'list',
            items: TRIAGE_ROWS.map((row) => ({
              en: `${row.tool.en} → ${row.target.en}`,
              zh: `${row.tool.zh} → ${row.target.zh}`,
            })),
          },
          {
            type: 'p',
            text: {
              en: 'Nothing here matches? Start with “Four steps to a working connection”, which works for any OpenAI-compatible client.',
              zh: '都不匹配？从“四步完成接入”开始，它适用于任何 OpenAI 兼容客户端。',
            },
          },
        ],
      },
    ],
  }
}

export function buildChapters(siteUrl: string): Chapter[] {
  const apiUrl = `${siteUrl}/v1`

  return [
    buildTriageChapter(),
    {
      id: 'before-you-start',
      title: { en: 'Before you start', zh: '开始前准备' },
      topics: [
        {
          id: 'account',
          title: { en: 'Account and balance', zh: '账号与余额' },
          blocks: [
            {
              type: 'list',
              items: [
                {
                  en: 'Register or sign in to this site. If registration is closed, contact the operator using the methods at the end of this page.',
                  zh: '先注册并登录本站。如果本站暂未开放注册，请使用文末的联系方式联系站点运营方。',
                },
                {
                  en: 'Top up before you start: a redemption code adds balance, and it is not an API key. Confirm the balance changed after redeeming.',
                  zh: '开始前先充值：兑换码可以增加余额，但兑换码不是 API 密钥。兑换后确认余额确实变了。',
                },
                {
                  en: 'Open Model Square and pick a model that is available to your account. Copy its model ID exactly, including case and punctuation. A balance, key restriction, or unavailable model can all make a correct address fail.',
                  zh: '打开“模型广场”，选一个当前账号可用的模型，完整复制模型 ID，连大小写和符号都不要改。余额不足、密钥限制或模型未开放，都可能导致地址填对了仍无法调用。',
                },
              ],
            },
            {
              type: 'p',
              text: {
                en: `Keep these two values at hand before moving on — every section below uses them. Site address: ${siteUrl}. API base URL for OpenAI-compatible clients: ${apiUrl}. When a client asks for a base URL, do not append /chat/completions; the client adds the endpoint itself.`,
                zh: `继续之前，先把这两个值放在手边——下面每一节都会用到。站点地址：${siteUrl}。OpenAI 兼容客户端的基础地址：${apiUrl}。软件要求填写“基础地址”时，不要再加 /chat/completions，软件会自行拼接接口路径。`,
              },
            },
          ],
        },
        {
          id: 'create-key',
          title: { en: 'Create an API key', zh: '创建 API 密钥' },
          blocks: [
            {
              type: 'list',
              items: [
                {
                  en: 'Open API Keys in the console and create a key. Choose a meaningful name and any model, group, quota or expiry restrictions you need.',
                  zh: '进入控制台的“API 密钥”页面，新建密钥。可以按需要设置名称、模型、分组、额度与有效期限制。',
                },
                {
                  en: 'Copy the complete key immediately and keep it private. It usually begins with sk- and is the API key used in every example below. The page also shows the base URL to use.',
                  zh: '立即复制并妥善保管完整密钥，通常以 sk- 开头。下文所有示例中的 API Key 都是这把密钥。页面上也直接显示了该使用的基础地址。',
                },
                {
                  en: 'For a first test, allow the model and group you intend to use, and set an expiry and quota that will not block the test. If you restrict the key to other models, the client cannot use this one even when your account has balance.',
                  zh: '首次测试时，确认密钥允许目标模型和分组，且有效期与额度不会拦住本次测试。即使账户有余额，密钥若只允许其他模型，这个模型仍不能调用。',
                },
                {
                  en: 'If a key is exposed, revoke it and create a new one. Never put it in a public repository, screenshot or chat message.',
                  zh: '如果密钥泄露，立即停用并重新创建。不要把密钥放进公开代码仓库、截图或聊天记录。',
                },
                {
                  en: 'For easier usage tracking, create a separate key for each app, such as Codex, Claude Code or Chatbox, and name each key accordingly.',
                  zh: '建议每个软件单独创建一把密钥，例如分别命名为 Codex、Claude Code、Chatbox，便于查看用量和排查问题。',
                },
              ],
            },
          ],
        },
        {
          id: 'redeem',
          title: { en: 'Redeem a code', zh: '兑换额度' },
          blocks: [
            {
              type: 'list',
              items: [
                {
                  en: 'Sign in and open Wallet from the console. Find the redemption-code field, paste the complete code provided to you, remove any surrounding spaces, then select Redeem.',
                  zh: '登录后进入控制台“钱包”，找到兑换码输入框，粘贴拿到的完整兑换码，去掉前后空格后点击“兑换”。',
                },
                {
                  en: 'Return to the balance display and refresh it if necessary. A successful redemption increases the available balance; usage may take a moment to update.',
                  zh: '返回余额位置核对额度；页面没立即变化时先刷新。兑换成功后可用余额应增加，用量数据可能稍后更新。',
                },
                {
                  en: 'If the code is invalid, check whether it was copied fully. An already-used code cannot be redeemed again. If the page says success but the balance still does not change after refreshing, contact support with the account and approximate time, without sending your API key.',
                  zh: '提示无效时检查有没有漏字符；提示已使用时不能重复兑换。若显示成功但刷新后余额仍没变化，提供账号和大致时间联系支持人员，不要发送 API 密钥。',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'api',
      title: { en: 'Standard API access', zh: '常规 API 接入' },
      topics: [
        {
          id: 'quick-start',
          title: {
            en: 'Four steps to a working connection',
            zh: '四步完成接入',
          },
          blocks: [
            {
              type: 'list',
              items: [
                {
                  en: 'Sign in, confirm the account has usable balance or quota, and redeem a voucher first if you have one.',
                  zh: '登录本站，先确认账户有可用余额或额度；如果持有兑换码，先完成兑换。',
                },
                {
                  en: 'Create an API key on this site and copy the entire value. Keep it private.',
                  zh: '在本站创建 API 密钥，复制完整内容并妥善保管。',
                },
                {
                  en: `In your client choose OpenAI Compatible, enter Base URL ${apiUrl}, paste the key and select an exact model ID from Model Square or /v1/models.`,
                  zh: `在客户端选择 OpenAI Compatible，基础地址填 ${apiUrl}，再粘贴密钥，并从模型广场或 /v1/models 复制准确的模型 ID。`,
                },
                {
                  en: 'For the first test, turn off streaming and tool calls or Agent mode. Send a short “Hello” message. Only after plain text works should you enable advanced features one at a time.',
                  zh: '第一次测试先关闭流式输出、工具调用或 Agent 模式，只发送简短的“你好”。普通文本成功后，再逐项启用高级功能。',
                },
              ],
            },
          ],
        },
        {
          id: 'three-fields',
          title: { en: 'The three fields', zh: '只需认清三个参数' },
          blocks: [
            {
              type: 'list',
              items: [
                {
                  en: `Base URL: ${apiUrl}. If the client says it automatically appends /v1, enter ${siteUrl} instead; avoid /v1/v1.`,
                  zh: `基础地址：${apiUrl}。如果软件说明会自动补上 /v1，就填写 ${siteUrl}，避免出现 /v1/v1。`,
                },
                {
                  en: 'API key: the sk- key created in this site’s API Keys page.',
                  zh: 'API Key：在本站“API 密钥”页面创建的 sk- 密钥。',
                },
                {
                  en: 'Model: copy an exact model identifier from Model Square. The display name and model identifier may differ.',
                  zh: '模型：从“模型广场”复制准确的模型标识，展示名称和请求使用的标识可能不同。',
                },
              ],
            },
          ],
        },
        {
          id: 'first-request',
          title: { en: 'Make your first request', zh: '发送第一条请求' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Open PowerShell on Windows. Replace sk-YOUR-KEY with your complete key and YOUR-MODEL-ID with an exact identifier from Model Square. Run the lines below in order. The first checks your key and available models; the second sends a message.',
                zh: 'Windows 用户先打开 PowerShell。将 sk-YOUR-KEY 替换为完整密钥，YOUR-MODEL-ID 替换为模型广场里的准确模型标识，依次执行以下命令。第一条检查密钥和可用模型，第二条发送消息。',
              },
            },
            {
              type: 'code',
              code: `$key = "sk-YOUR-KEY"\nInvoke-RestMethod -Uri "${apiUrl}/models" -Headers @{ Authorization = "Bearer $key" }\n$body = @{ model = "YOUR-MODEL-ID"; messages = @(@{ role = "user"; content = "Hello" }) } | ConvertTo-Json -Depth 4\nInvoke-RestMethod -Uri "${apiUrl}/chat/completions" -Method Post -Headers @{ Authorization = "Bearer $key" } -ContentType "application/json" -Body $body`,
            },
            {
              type: 'p',
              text: {
                en: 'On macOS or Linux, use curl in Terminal. Replace the key and model before running; the model-list response includes ids you can copy.',
                zh: 'macOS 或 Linux 用户可在终端使用 curl。运行前替换密钥和模型；模型列表返回的 id 可以直接复制。',
              },
            },
            {
              type: 'code',
              code: `curl "${apiUrl}/models" -H "Authorization: Bearer sk-YOUR-KEY"\ncurl "${apiUrl}/chat/completions" -H "Authorization: Bearer sk-YOUR-KEY" -H "Content-Type: application/json" -d '{"model":"YOUR-MODEL-ID","messages":[{"role":"user","content":"Hello"}]}'`,
            },
            {
              type: 'p',
              text: {
                en: 'A successful response contains choices with an assistant message. Each call may consume balance. For streaming, SDKs and other API types, use the matching endpoint and confirm that the selected model supports it.',
                zh: '成功后，响应的 choices 中会有助手回复。每次调用可能消耗余额。流式输出、SDK 或其他接口类型需要使用对应端点，并确认所选模型支持该能力。',
              },
            },
          ],
        },
        {
          id: 'sdk-example',
          title: {
            en: 'Use an SDK in your own program',
            zh: '在自己的程序里使用 SDK',
          },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'If you write code, install the OpenAI Python package with `python -m pip install openai`. The following example reads the key from an environment variable instead of placing it in source code. Set TOKENCOME_API_KEY in the same terminal before running it, and replace the model ID.',
                zh: '如果要在自己的程序里调用，先运行 `python -m pip install openai` 安装 Python SDK。下面的示例从环境变量读取密钥，不把真实密钥写进源码。请先在同一个终端设置 TOKENCOME_API_KEY，并替换模型 ID。',
              },
            },
            {
              type: 'code',
              code: `# PowerShell: $env:TOKENCOME_API_KEY = "sk-YOUR-KEY"\n# macOS/Linux: export TOKENCOME_API_KEY="sk-YOUR-KEY"\nfrom openai import OpenAI\nimport os\n\nclient = OpenAI(api_key=os.environ["TOKENCOME_API_KEY"], base_url="${apiUrl}")\nreply = client.chat.completions.create(\n    model="YOUR-MODEL-ID",\n    messages=[{"role": "user", "content": "Hello"}],\n)\nprint(reply.choices[0].message.content)`,
            },
            {
              type: 'p',
              text: {
                en: 'Save the Python lines to a .py file and run `python your-file.py`. If you see an authentication error, check the variable in that terminal. If the model does not support Chat Completions, select a compatible model or the SDK method for the supported endpoint.',
                zh: '将 Python 代码保存为 .py 文件，运行 `python 文件名.py`。出现认证错误时，先确认同一终端已设置环境变量。如果模型不支持 Chat Completions，请换支持该接口的模型，或使用该模型对应的 SDK 方法。',
              },
            },
          ],
        },
        {
          id: 'other-protocols',
          title: {
            en: 'Claude and Gemini endpoints',
            zh: 'Claude 与 Gemini 接口',
          },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Choose the protocol that your client actually supports. For an OpenAI-compatible client, use the /v1 address above. A client that explicitly supports the Anthropic Messages API uses the site URL without /v1 and sends x-api-key plus anthropic-version. A client that supports the native Gemini API uses /v1beta and x-goog-api-key. A model must be enabled for the chosen protocol and your key.',
                zh: '先确认软件使用哪种协议。OpenAI 兼容软件用上面的 /v1 地址；明确支持 Anthropic Messages API 的软件使用不带 /v1 的本站地址，并发送 x-api-key 与 anthropic-version 请求头；使用 Gemini 原生协议的软件用 /v1beta 地址和 x-goog-api-key 请求头。所选模型还必须对当前协议和密钥开放。',
              },
            },
            {
              type: 'code',
              code: `OpenAI-compatible  ${apiUrl}\nAnthropic Messages ${siteUrl}  (endpoint: /v1/messages)\nGemini native      ${siteUrl}/v1beta`,
            },
            {
              type: 'p',
              text: {
                en: 'Do not paste a complete endpoint such as /v1/chat/completions into a Base URL field. Start with GET /v1/models to check your key and network, then send a small request. Some tools add /v1 or the endpoint automatically: follow the field label and check the final URL if a 404 occurs.',
                zh: '“基础地址”一栏不要填 /v1/chat/completions 之类的完整接口路径。先请求 GET /v1/models 检查密钥与网络，再发送少量内容测试。有些工具会自动拼接 /v1 或具体接口；出现 404 时，先核对最终请求地址。',
              },
            },
          ],
        },
        {
          id: 'client-settings',
          title: { en: 'Common client settings', zh: '常见客户端怎么填' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Most clients use the same four values. Find their model-provider settings and add an OpenAI-compatible provider. Common entry points include Cherry Studio: Settings > Model Services > Add; Chatbox: Settings > Model Provider; Cursor: Settings > Models > Override Base URL; and Cline or Roo Code: Provider/API Configuration. Menu labels may change by version.',
                zh: '大多数客户端都填写同一组参数：到“模型提供方”设置里添加 OpenAI 兼容提供方。常见入口包括 Cherry Studio“设置 > 模型服务 > 添加”、Chatbox“设置 > 模型提供商”、Cursor“Settings > Models > Override Base URL”，以及 Cline/Roo Code 的“Provider/API Configuration”。菜单名称可能随版本变化。',
              },
            },
            {
              type: 'code',
              code: `Provider / API Type: OpenAI Compatible / Chat Completions\nBase URL: ${apiUrl}\nAPI Key: sk-YOUR-KEY\nModel ID: YOUR-MODEL-ID`,
            },
            {
              type: 'p',
              text: {
                en: 'Save the provider, then select the new model in a fresh chat. If the client has separate Chat, Agent and Autocomplete model settings, configure the part you intend to use. Start with a plain chat before trying Agent, images or tools.',
                zh: '保存后，在新会话中选择刚添加的模型。如果软件分别设置聊天、Agent 和自动补全模型，需要在你实际使用的功能中选中它。先测普通聊天，再试 Agent、图片或工具调用。',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'cc-switch',
      title: {
        en: 'CC Switch and Claude Code',
        zh: 'CC Switch 与 Claude Code',
      },
      topics: [
        {
          id: 'cc-switch-import',
          title: { en: 'Import from this site', zh: '从本站一键导入' },
          blocks: [
            {
              type: 'list',
              items: [
                {
                  en: 'Install CC Switch from its official site, https://ccswitch.io/zh/, then open it once so your system can handle ccswitch:// links. Choose the installer for your operating system.',
                  zh: '先从 CC Switch 官网 https://ccswitch.io/zh/ 下载与你操作系统对应的安装包，安装后至少打开一次，以便系统识别 ccswitch:// 导入链接。',
                },
                {
                  en: 'On this site, open API Keys, find the key you want to use, open its row menu and choose CC Switch. Select Claude for Claude Code, or Codex for the OpenAI-compatible route; choose an exact model ID and select Open CC Switch.',
                  zh: '在本站打开“API 密钥”，找到要使用的密钥，打开该行菜单并选择“CC Switch”。接入 Claude Code 选 Claude；接入 Codex 的 OpenAI 兼容线路选 Codex。选择准确的模型 ID 后，点击“打开 CC Switch”。',
                },
                {
                  en: 'Allow the browser to open CC Switch, inspect the imported address, key and model, then activate that provider in CC Switch. Open a new Claude Code or Codex session to test it. An import only adds a provider; you still need to select or activate it.',
                  zh: '允许浏览器打开 CC Switch，核对导入的地址、密钥和模型，然后在 CC Switch 中启用该提供方。重新打开 Claude Code 或 Codex 会话测试。导入只是新增配置，还需要切换到这条配置。',
                },
              ],
            },
          ],
        },
        {
          id: 'cc-switch-manual',
          title: {
            en: 'Enter the settings manually',
            zh: '手动填写 CC Switch',
          },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'If one-click import does not open the app, add a provider in CC Switch manually. For Claude Code, choose Claude/Anthropic and use the site address without /v1. For Codex, choose Codex/OpenAI-compatible and use the /v1 base URL. Use a model ID shown in this site, not an example model name copied from another service.',
                zh: '一键导入未唤起软件时，可在 CC Switch 中手动新增提供方。Claude Code 选择 Claude/Anthropic，地址填写不带 /v1 的本站地址；Codex 的 OpenAI 兼容线路选择 Codex/OpenAI，地址填写带 /v1 的基础地址。模型 ID 要从本站复制，不要照抄其他站点的示例模型名。',
              },
            },
            {
              type: 'code',
              code: `Claude Code / Anthropic\nBase URL: ${siteUrl}\nAPI Key: sk-YOUR-KEY\nModel ID: YOUR-CLAUDE-COMPATIBLE-MODEL-ID\n\nCodex / OpenAI-compatible\nBase URL: ${apiUrl}\nAPI Key: sk-YOUR-KEY\nModel ID: YOUR-RESPONSES-MODEL-ID`,
            },
            {
              type: 'p',
              text: {
                en: 'A connection-test button may call a fixed endpoint or model that differs from your selected route. Test by sending a real short message. If the test fails and a real message also fails, check the address, selected protocol, key permission and model ID in that order.',
                zh: '“测试连接”按钮可能调用固定接口或固定模型，不一定等于真实对话结果。请以发送简短消息为准；若测试和实际对话都失败，依次检查地址、协议、密钥权限和模型 ID。',
              },
            },
          ],
        },
        {
          id: 'claude-code',
          title: { en: 'Verify Claude Code', zh: '验证 Claude Code' },
          blocks: [
            {
              type: 'list',
              items: [
                {
                  en: 'Choose a model whose route supports the Anthropic Messages protocol. The model name alone does not prove protocol compatibility; if unsure, test the selected model or ask support.',
                  zh: '选择支持 Anthropic Messages 协议的模型。仅凭模型名字不能判断协议是否支持；不确定时先测试该模型，或咨询支持人员。',
                },
                {
                  en: `Confirm that CC Switch shows ${siteUrl} as the Claude address, with no /v1 at the end. Activate the provider and start Claude Code in a new terminal or session.`,
                  zh: `确认 CC Switch 中 Claude 地址为 ${siteUrl}，末尾没有 /v1；启用该提供方后，重新打开终端或新建 Claude Code 会话。`,
                },
                {
                  en: 'Send a short question. If Claude Code does not answer, check this site’s usage logs. No log usually means the request did not reach this site; a logged error gives a model, permission or upstream clue.',
                  zh: '发送一句简短问题。如果 Claude Code 没有回复，查看本站使用日志：没有日志通常说明请求没有到本站；有错误记录则可进一步判断模型、权限或上游问题。',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'codex',
      title: { en: 'Codex App and SK keys', zh: 'Codex App 与 SK 密钥' },
      topics: [
        {
          id: 'codex-sign-in',
          title: { en: 'Sign in with an API key', zh: '使用密钥登录' },
          blocks: [
            {
              type: 'list',
              items: [
                {
                  en: 'Install and open Codex App. On the sign-in screen, choose the API key option rather than browser sign-in. If already signed in, use the account menu to sign out or switch authentication method.',
                  zh: '安装并打开 Codex App。在登录界面选择“使用 API Key 登录”这一项，而不是网页登录；如果已经登录，可在账号菜单中退出或切换登录方式。',
                },
                {
                  en: 'Create a key on this site, paste the complete sk- value into the App key field and continue. This step supplies a credential; the request address still needs the config.toml setting below.',
                  zh: '在本站创建密钥，把完整的 sk- 密钥粘贴进 App 的密钥输入框并继续。此步只提供凭据，请求地址还需要按下文修改 config.toml。',
                },
                {
                  en: 'In Model Square, copy a model ID whose route supports the Responses API. Keep the key and model ID ready for the next steps.',
                  zh: '从模型广场复制一个支持 Responses API 的模型标识。后续配置还会用到密钥和模型标识。',
                },
              ],
            },
          ],
        },
        {
          id: 'codex-config',
          title: { en: 'Edit config.toml', zh: '修改 config.toml' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Quit Codex App completely. Open the Codex user configuration file: %USERPROFILE%\\.codex\\config.toml on Windows, or ~/.codex/config.toml on macOS/Linux. If it does not exist, create the .codex folder and a plain-text config.toml file. Back up an existing file before changing it. Do not create config.toml.txt.',
                zh: '先完全退出 Codex App。打开用户配置文件：Windows 路径为 %USERPROFILE%\\.codex\\config.toml，macOS/Linux 为 ~/.codex/config.toml。如果不存在，先创建 .codex 文件夹，再新建纯文本 config.toml 文件；修改已有文件前先备份。不要误存成 config.toml.txt。',
              },
            },
            {
              type: 'p',
              text: {
                en: 'Set the top-level model and model_provider values. If the file already has those keys, replace their values instead of writing duplicate keys. Add the provider table below. Replace only YOUR-RESPONSES-MODEL-ID with an exact model ID from Model Square.',
                zh: '设置文件顶层的 model 和 model_provider。如果原文件已有这两个键，请修改其值，不要重复写同名键；再添加下方提供方配置。只需把 YOUR-RESPONSES-MODEL-ID 换成模型广场里的准确标识。',
              },
            },
            {
              type: 'code',
              code: `model = "YOUR-RESPONSES-MODEL-ID"\nmodel_provider = "tokencome"\n\n[model_providers.tokencome]\nname = "Tokencome API"\nbase_url = "${apiUrl}"\nenv_key = "TOKENCOME_API_KEY"\nwire_api = "responses"`,
            },
            {
              type: 'p',
              text: {
                en: 'The custom provider reads TOKENCOME_API_KEY from the App process environment. Set that variable to the same site key you pasted at sign-in. On Windows, open Start > Edit environment variables for your account, add a user variable named TOKENCOME_API_KEY with the complete sk- key as its value, then sign out of Windows and sign back in. On macOS/Linux, set the variable in the environment that launches the App; a variable exported only in one terminal may not reach an App opened from the desktop.',
                zh: '自定义提供方会从 App 进程的环境变量 TOKENCOME_API_KEY 读取密钥。把它设为登录时粘贴的同一把本站密钥。Windows 可打开“开始菜单 > 编辑账户的环境变量”，新增用户变量 TOKENCOME_API_KEY，值填写完整 sk- 密钥，然后退出 Windows 账号并重新登录。macOS/Linux 要在启动 App 的环境中设置；仅在一个终端窗口 export 的变量，桌面启动的 App 可能读不到。',
              },
            },
            {
              type: 'p',
              text: {
                en: 'Reopen Codex App, select a local project and send a small test task. Check this site’s usage logs to confirm the request arrived. If there is no request, check that config.toml is in the user home directory, the file is valid TOML, the App inherited TOKENCOME_API_KEY and the selected model supports /v1/responses. A key pasted at sign-in alone does not set the custom provider environment variable.',
                zh: '重新打开 Codex App，选择本地项目并发送一个简单任务，然后在本站使用日志中确认请求到达。如果没有记录，请检查 config.toml 是否在用户主目录、TOML 语法是否正确、App 是否继承 TOKENCOME_API_KEY，以及所选模型是否支持 /v1/responses。只在登录界面粘贴密钥，不会自动设置自定义提供方的环境变量。',
              },
            },
            {
              type: 'p',
              text: {
                en: 'Codex configuration keys and App behavior may change between releases. If your App version does not load custom providers, consult its current settings documentation before relying on this setup.',
                zh: 'Codex 配置项和 App 行为可能随版本变化。如果当前 App 不读取自定义提供方，请先核对该版本的配置说明。',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'editors',
      title: { en: 'WorkBuddy and Trae', zh: 'WorkBuddy 与 Trae' },
      topics: [
        {
          id: 'workbuddy',
          title: { en: 'WorkBuddy', zh: 'WorkBuddy 接入' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'WorkBuddy versions differ in whether they allow an external model. Check the installed version before entering a key. The following steps apply only when its model settings offer a custom provider with an editable API address.',
                zh: 'WorkBuddy 各版本对外部模型的支持可能不同。先检查已安装版本：以下步骤只适用于“模型设置”里提供自定义提供方，且允许修改 API 地址的版本。',
              },
            },
            {
              type: 'list',
              items: [
                {
                  en: 'Sign in to WorkBuddy and open Settings from the avatar or gear menu. Find Model, Model Provider, Custom Model or API settings; the label may vary by release.',
                  zh: '登录 WorkBuddy，在头像或齿轮菜单中打开“设置”，查找“模型”“模型提供方”“自定义模型”或“API 设置”；名称可能因版本不同。',
                },
                {
                  en: 'Choose Add Provider or Add Custom Model. Select OpenAI Compatible when offered. For Base URL enter the address shown below; for API Key paste your complete site sk- key. Do not put the key in the URL.',
                  zh: '选择“添加提供方”或“添加自定义模型”，若有协议选项，选 OpenAI Compatible。Base URL 填下方地址；API Key 填完整本站 sk- 密钥。密钥不要拼进 URL。',
                },
                {
                  en: 'For Model ID, paste an exact model identifier from this site’s Model Square. If a display name is optional, use any name that helps you recognize the model; it does not change the request ID.',
                  zh: '模型 ID 填本站模型广场里的准确标识。若还有“显示名称”，可自定义便于辨认的名称；它不会改变请求使用的模型 ID。',
                },
                {
                  en: 'Save the provider, start a new conversation, choose the new model from the conversation model selector and send a short test message. Check usage logs here to confirm it used this key.',
                  zh: '保存提供方，新建会话，在会话的模型选择器中选刚配置的模型，发送一条简短测试消息，并在本站使用日志中确认这把密钥被调用。',
                },
                {
                  en: 'If there is no editable Base URL or only built-in models, this WorkBuddy version cannot use this method. If a 404 occurs, check whether the client added /v1 twice.',
                  zh: '如果没有可编辑的 Base URL、只能选择内置模型，该版本就无法用此方式接入。若出现 404，先检查软件是否把 /v1 拼接了两次。',
                },
              ],
            },
            {
              type: 'code',
              code: `Provider: OpenAI Compatible\nBase URL: ${apiUrl}\nAPI Key: sk-YOUR-KEY\nModel ID: YOUR-MODEL-ID`,
            },
          ],
        },
        {
          id: 'trae',
          title: { en: 'Trae', zh: 'Trae 接入' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Trae editions and releases may expose different model settings. These steps require a custom model form with an editable API URL, not just a selector of built-in models.',
                zh: 'Trae 不同版本的模型设置可能不同。以下步骤需要“自定义模型”表单里有可编辑的 API 地址；仅有内置模型选择器时不适用。',
              },
            },
            {
              type: 'list',
              items: [
                {
                  en: 'Open Trae, sign in if required, then use the gear icon or model picker to open model management. Look for Add Model or Custom Model.',
                  zh: '打开 Trae，按提示登录后，通过齿轮图标或模型选择器进入模型管理，查找“添加模型”或“自定义模型”。',
                },
                {
                  en: 'When the form lets you choose a provider or protocol, select OpenAI Compatible. Set API Base URL to the address below, paste your full site key into API Key, and enter the exact model ID from Model Square.',
                  zh: '若表单提供“提供方”或“协议”选项，选择 OpenAI Compatible。API Base URL 填下方地址，API Key 粘贴本站完整密钥，模型 ID 填模型广场里的准确标识。',
                },
                {
                  en: 'If Trae offers a connection test, run it and save. Open a new chat or coding session, select the custom model and send a small task. Confirm the request appears in this site’s usage logs.',
                  zh: '如果 Trae 提供“测试连接”，先测试再保存。新建聊天或编程会话，选中自定义模型，发送简单任务，并在本站使用日志中确认请求到达。',
                },
                {
                  en: 'For 401, check the key; for 404, check whether Trae appends /v1 itself; for a missing model, check the exact ID and key permissions. If the edition only accepts built-in providers, it cannot be connected through this form.',
                  zh: '出现 401 检查密钥；404 检查 Trae 是否自动拼接 /v1；模型找不到则检查模型 ID 和密钥权限。如果当前版本只接受内置提供方，就无法通过该表单接入。',
                },
              ],
            },
            {
              type: 'code',
              code: `Provider: OpenAI Compatible\nAPI Base URL: ${apiUrl}\nAPI Key: sk-YOUR-KEY\nModel ID: YOUR-MODEL-ID`,
            },
          ],
        },
      ],
    },
    {
      id: 'troubleshooting',
      title: { en: 'Troubleshooting', zh: '常见问题排查' },
      topics: [
        {
          id: 'diagnostic-order',
          title: { en: 'Diagnostic order', zh: '推荐排查顺序' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Work through these four steps in order. Each one eliminates a whole class of causes, so you can stop as soon as one fails.',
                zh: '按顺序走完这四步。每一步都会排除一整类原因，一旦某步失败就可以停下，问题就在那里。',
              },
            },
            {
              type: 'list',
              items: [
                {
                  en: `Key first: request GET ${apiUrl}/models with your Bearer key. A failure here means the key, its status or its quota — not the model.`,
                  zh: `先验密钥：用 Bearer 密钥请求 GET ${apiUrl}/models。这一步失败说明问题在密钥、密钥状态或额度，而不在模型。`,
                },
                {
                  en: `Address next: send a small non-streaming POST to ${apiUrl}/chat/completions. A 404 here usually means a doubled or missing /v1.`,
                  zh: `再验地址：向 ${apiUrl}/chat/completions 发送一条关闭流式的短文本 POST 请求。这一步返回 404，通常是 /v1 重复或缺失。`,
                },
                {
                  en: 'Model last: copy the model id returned by the model list, then check the key’s model and group restrictions against it.',
                  zh: '最后验模型：复制模型列表返回的 id，再对照检查密钥的模型与分组限制。',
                },
                {
                  en: 'Only then turn on streaming, images, tools or Agent mode — one at a time, so you know which feature broke.',
                  zh: '以上都通过后，再逐一打开流式、图片、工具或 Agent 模式，一次只开一项，便于定位。',
                },
              ],
            },
          ],
        },
        {
          id: 'errors',
          title: { en: 'Common errors', zh: '常见错误' },
          blocks: [
            {
              type: 'list',
              items: [
                {
                  en: '400: check the JSON body, field names and whether the chosen model supports this endpoint. For the first test, disable streaming and tools.',
                  zh: '400：检查 JSON 内容、字段名，以及所选模型是否支持当前接口。初次测试先关闭流式和工具调用。',
                },
                {
                  en: '401: check the complete key, leading/trailing spaces, key status and whether the request reached this site rather than the official API.',
                  zh: '401：检查密钥是否完整、有无前后空格、是否被停用，以及请求是否真的发往本站而不是官方接口。',
                },
                {
                  en: '403 or model unavailable: confirm that the key permits this model and group, and that the model is available in Model Square.',
                  zh: '403 或模型不可用：检查密钥允许的模型、分组，以及“模型广场”是否提供该模型。',
                },
                {
                  en: '404: check the base URL and API path. Use /v1/chat/completions for the example above; a client may append its own path.',
                  zh: '404：检查基础地址和接口路径。上方示例使用 /v1/chat/completions；客户端通常会自行拼接接口路径。',
                },
                {
                  en: '408 or request timeout: shorten the conversation and requested output, then retry once. Repeated timeouts across short requests need support investigation.',
                  zh: '408 或请求超时：缩短对话历史和输出长度后重试一次。短请求也持续超时时，需要联系支持人员排查。',
                },
                {
                  en: '413: reduce the size of the message, attached images or conversation history and try again.',
                  zh: '413：缩短消息、减少附件图片或对话历史后重试。',
                },
                {
                  en: '429: rate limited or balance exhausted. Inspect the account limits, key quota and balance, then retry only after resolving the restriction.',
                  zh: '429：触发限流或余额不足。检查账户限制、密钥额度与余额，解除限制后再重试。',
                },
                {
                  en: '500, 502, 503 or 504: the gateway or upstream service may be unavailable or slow. Check this site’s notices and the Status Monitor page, then retry a small request later.',
                  zh: '500、502、503 或 504：网关或上游服务可能故障、繁忙或超时。查看本站公告与“状态监控”页，稍后用短请求重试。',
                },
                {
                  en: '529 or overloaded: the upstream model is busy. Wait and retry, or select another available model.',
                  zh: '529 或 overloaded：上游模型繁忙。稍后重试，或改用本站当前可用的其他模型。',
                },
                {
                  en: 'no available accounts: the chosen model or group has no available upstream route. Try a different available model and contact support if it persists.',
                  zh: 'no available accounts：所选模型或分组暂时没有可用上游线路。可尝试其他可用模型；持续出现时联系支持人员。',
                },
                {
                  en: 'insufficient quota or balance not enough: inspect both account balance and this key’s own quota. Redeem or top up if needed; report a persistent mismatch to support.',
                  zh: 'insufficient quota 或 balance not enough：同时检查账户余额和这把密钥的额度。必要时兑换或充值；余额充足却持续报错时联系支持人员。',
                },
                {
                  en: 'invalid character or parse response: the client could not parse the returned content. Retry a short request; if it repeats, provide the error and model to support.',
                  zh: 'invalid character 或 parse response：客户端无法解析返回内容。先用短请求重试；仍反复出现时，向支持人员提供报错和模型名。',
                },
                {
                  en: 'Connection or TLS error: confirm HTTPS, the domain name, network access and any proxy settings in your client.',
                  zh: '连接或 TLS 错误：确认 HTTPS、域名、网络连通性，以及客户端中的代理设置。',
                },
              ],
            },
          ],
        },
        {
          id: 'normal-behavior',
          title: { en: 'Delays and connection tests', zh: '等待与连接测试' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'A first reply can be slower when the model is busy, the conversation contains a long document or code, or the upstream service is starting. Streaming output can pause briefly. Usage and balance displays may also update after a short delay. These observations alone do not prove a configuration error.',
                zh: '首次请求、模型繁忙、长代码或长文档输入时，首字可能更慢；流式输出也可能短暂停顿。余额和用量显示可能略有延迟。这些现象本身不一定代表配置错误。',
              },
            },
            {
              type: 'p',
              text: {
                en: 'Test with a short new conversation before judging speed, and check the Status Monitor page to see whether the same model is slow for everyone. A CC Switch connection test can fail even when a real conversation works, because it may use another endpoint or model.',
                zh: '判断速度时，请用新会话发送短问题，并到“状态监控”页看同一模型是否对所有人都慢。CC Switch 的连接测试可能使用另一接口或模型，因此测试失败而真实对话成功时，以真实调用结果为准。',
              },
            },
          ],
        },
        {
          id: 'contact-support',
          title: {
            en: 'What to send to support',
            zh: '联系支持人员时提供什么',
          },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'If a short request keeps failing, send the information below through a configured contact method. Include the time and exact error so the operator can find the matching usage log. Never send the full API key, account password, verification code or recovery code.',
                zh: '短请求持续失败时，可通过文末配置的联系方式提交以下信息。时间和原始报错有助于定位使用日志。不要发送完整 API 密钥、账号密码、验证码或恢复码。',
              },
            },
            {
              type: 'code',
              code: `Account email: YOUR-EMAIL\nAPI key: last 6 characters only\nClient and version: CC Switch / Claude Code / Codex / other\nBase URL: ${apiUrl} (or ${siteUrl} for Claude)\nModel ID: YOUR-MODEL-ID\nError text or screenshot: REMOVE ALL SECRETS FIRST\nApproximate time and time zone: YYYY-MM-DD HH:MM\nStreaming: on / off\nScope: one model / all models`,
            },
          ],
        },
      ],
    },
  ]
}
