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

export function buildClientPages(urls: DocUrls): DocPage[] {
  const { site, api } = urls

  return [
    {
      slug: 'config/ccswitch',
      title: { en: 'CC Switch (recommended)', zh: 'CC Switch（推荐）' },
      summary: {
        en: 'Import this site into Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw and Hermes with one click.',
        zh: '一键把本站导入 Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw 和 Hermes。',
      },
      sections: [
        {
          id: 'what',
          title: { en: 'What CC Switch does', zh: 'CC Switch 是什么' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'CC Switch is a desktop app that writes provider settings into the config files of coding agents and switches between them. This site can send it a ready-made provider, so you do not have to edit any config file by hand.',
                zh: 'CC Switch 是一个桌面工具，负责把服务商配置写入各编程工具的配置文件，并在多个服务商之间切换。本站可以直接把配置好的服务商发送给它，不需要手动改配置文件。',
              },
            },
            {
              type: 'table',
              head: [
                { en: 'App', zh: '应用' },
                { en: 'One-click import', zh: '一键导入' },
                { en: 'Address it uses', zh: '使用的地址' },
              ],
              rows: [
                [both('Claude Code'), { en: 'Yes', zh: '支持' }, both(site)],
                [both('Codex'), { en: 'Yes', zh: '支持' }, both(api)],
                [both('Gemini CLI'), { en: 'Yes', zh: '支持' }, both(site)],
                [
                  both('OpenCode / OpenClaw / Hermes / Grok Build'),
                  { en: 'Yes', zh: '支持' },
                  both(api),
                ],
                [
                  both('Claude Desktop / Pi'),
                  { en: 'No, add it manually', zh: '不支持，需手动添加' },
                  { en: `${site} / ${api}`, zh: `${site} / ${api}` },
                ],
              ],
            },
          ],
        },
        {
          id: 'import',
          title: { en: 'Import from this site', zh: '从本站一键导入' },
          blocks: [
            {
              type: 'steps',
              items: [
                {
                  en: 'Download CC Switch from https://ccswitch.io/zh/ for your operating system, install it and open it once so the system registers ccswitch:// links.',
                  zh: '从 CC Switch 官网 https://ccswitch.io/zh/ 下载对应系统的安装包，安装后至少打开一次，让系统识别 ccswitch:// 导入链接。',
                },
                {
                  en: 'On this site open API Keys, open the row menu of the key you want and choose CC Switch.',
                  zh: '在本站打开“API 密钥”，找到要使用的密钥，打开该行菜单选择“CC Switch”。',
                },
                {
                  en: 'Pick the application, then pick a model. For Claude Code you can also set separate Haiku, Sonnet and Opus models; leave them empty to use the primary model everywhere.',
                  zh: '选择应用，再选择模型。Claude Code 还可以分别指定 Haiku、Sonnet、Opus 模型；留空则全部使用主模型。',
                },
                {
                  en: 'Select Open CC Switch and allow the browser to open the app. Check the imported address, key and model, then enable the provider in CC Switch.',
                  zh: '点击“打开 CC Switch”，允许浏览器唤起软件。核对导入的地址、密钥和模型，然后在 CC Switch 中启用该服务商。',
                },
                {
                  en: 'Start a new Claude Code or Codex session and send a short message. Importing only adds the provider; it is used after you enable it.',
                  zh: '新开一个 Claude Code 或 Codex 会话，发送一条简短消息测试。导入只是新增配置，启用后才会生效。',
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
          id: 'manual',
          title: { en: 'Add the provider manually', zh: '手动添加服务商' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'If the link does not open the app, add a provider in CC Switch by hand. Claude Code uses the site root without /v1; Codex and other OpenAI-compatible apps use the /v1 address.',
                zh: '如果链接没有唤起软件，可以在 CC Switch 里手动新增服务商。Claude Code 填写不带 /v1 的站点地址；Codex 和其他 OpenAI 兼容应用填写带 /v1 的地址。',
              },
            },
            {
              type: 'code',
              code: `Claude Code\n  Base URL: ${site}\n  API Key:  sk-YOUR-KEY\n  Model:    YOUR-CLAUDE-MODEL-ID\n\nCodex\n  Base URL: ${api}\n  API Key:  sk-YOUR-KEY\n  Model:    YOUR-RESPONSES-MODEL-ID`,
            },
            {
              type: 'note',
              text: {
                en: 'The “Test connection” button may call a fixed endpoint or model and fail even when real conversations work. Trust a real short message over the test button.',
                zh: '“测试连接”按钮可能调用固定的接口或模型，即使真实对话正常也可能失败。请以实际发送一条短消息的结果为准。',
              },
            },
          ],
        },
      ],
    },
    {
      slug: 'config/claude-code',
      title: { en: 'Claude Code (manual)', zh: '手动配置 Claude Code' },
      summary: {
        en: 'Point Claude Code CLI and the VS Code extension at this site with environment variables or settings.json.',
        zh: '用环境变量或 settings.json 让 Claude Code 命令行与 VS Code 插件连接本站。',
      },
      sections: [
        {
          id: 'install',
          title: { en: 'Install', zh: '安装' },
          blocks: [
            {
              type: 'tabs',
              samples: [
                {
                  label: 'macOS / Linux',
                  code: 'curl -fsSL https://claude.ai/install.sh | bash',
                },
                {
                  label: 'Windows PowerShell',
                  code: 'irm https://claude.ai/install.ps1 | iex',
                },
                {
                  label: 'npm',
                  code: 'npm install -g @anthropic-ai/claude-code',
                },
              ],
            },
          ],
        },
        {
          id: 'settings-file',
          title: {
            en: 'Configure with settings.json (recommended)',
            zh: '用 settings.json 配置（推荐）',
          },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Edit `~/.claude/settings.json` (Windows: `%USERPROFILE%\\.claude\\settings.json`) and add an env block. This applies to every project and to background agents. Keep any other keys already in the file.',
                zh: '编辑 `~/.claude/settings.json`（Windows 为 `%USERPROFILE%\\.claude\\settings.json`），加入 env 配置块。它对所有项目和后台任务都生效。文件里已有的其他配置项请保留。',
              },
            },
            {
              type: 'code',
              label: 'settings.json',
              code: `{\n  "env": {\n    "ANTHROPIC_BASE_URL": "${site}",\n    "ANTHROPIC_AUTH_TOKEN": "sk-YOUR-KEY",\n    "ANTHROPIC_MODEL": "YOUR-CLAUDE-MODEL-ID",\n    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "YOUR-FAST-MODEL-ID",\n    "API_TIMEOUT_MS": "600000",\n    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"\n  }\n}`,
            },
            {
              type: 'table',
              head: [
                { en: 'Variable', zh: '变量' },
                { en: 'Meaning', zh: '含义' },
              ],
              rows: [
                [
                  both('ANTHROPIC_BASE_URL'),
                  {
                    en: `The site root, ${site}. Do not add /v1.`,
                    zh: `站点根地址 ${site}，不要加 /v1。`,
                  },
                ],
                [
                  both('ANTHROPIC_AUTH_TOKEN'),
                  {
                    en: 'Your sk- key, sent as Authorization: Bearer.',
                    zh: '你的 sk- 密钥，以 Authorization: Bearer 发送。',
                  },
                ],
                [
                  both('ANTHROPIC_MODEL'),
                  {
                    en: 'Default model ID. Optional; /model can switch it later.',
                    zh: '默认模型 ID，可选；之后可用 /model 切换。',
                  },
                ],
                [
                  both('ANTHROPIC_DEFAULT_HAIKU_MODEL'),
                  {
                    en: 'Model for background tasks such as titles and summaries. Optional; pick a cheaper model.',
                    zh: '用于生成标题、摘要等后台任务的模型，可选，建议选便宜的模型。',
                  },
                ],
                [
                  both(
                    'ANTHROPIC_DEFAULT_SONNET_MODEL / ANTHROPIC_DEFAULT_OPUS_MODEL'
                  ),
                  {
                    en: 'What the sonnet and opus aliases in /model resolve to. Optional.',
                    zh: '/model 中 sonnet、opus 别名对应的模型，可选。',
                  },
                ],
                [
                  both('API_TIMEOUT_MS'),
                  {
                    en: 'Request timeout in milliseconds. Raise it for long tasks.',
                    zh: '请求超时时间（毫秒），长任务可调大。',
                  },
                ],
                [
                  both('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'),
                  {
                    en: 'Stops telemetry, auto-update and other traffic that does not go through this site. Optional.',
                    zh: '关闭遥测、自动更新等不经过本站的网络请求，可选。',
                  },
                ],
              ],
            },
          ],
        },
        {
          id: 'shell',
          title: { en: 'Configure for one terminal', zh: '只在当前终端生效' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'For a quick test, export the variables in a terminal and start claude from that same terminal. They disappear when the terminal closes.',
                zh: '临时测试时，可以在终端里设置变量，然后在同一个终端启动 claude。关闭终端后失效。',
              },
            },
            {
              type: 'tabs',
              samples: [
                {
                  label: 'macOS / Linux',
                  code: `export ANTHROPIC_BASE_URL="${site}"\nexport ANTHROPIC_AUTH_TOKEN="sk-YOUR-KEY"\nclaude`,
                },
                {
                  label: 'Windows PowerShell',
                  code: `$env:ANTHROPIC_BASE_URL = "${site}"\n$env:ANTHROPIC_AUTH_TOKEN = "sk-YOUR-KEY"\nclaude`,
                },
              ],
            },
          ],
        },
        {
          id: 'vscode',
          title: { en: 'VS Code extension', zh: 'VS Code 插件' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'The extension checks credentials before it starts, so put the variables in VS Code’s user settings (Preferences: Open User Settings (JSON)) rather than only in ~/.claude/settings.json.',
                zh: '插件启动前会先检查凭据，因此要把变量写进 VS Code 的用户设置（命令面板执行 Preferences: Open User Settings (JSON)），不要只写在 ~/.claude/settings.json 里。',
              },
            },
            {
              type: 'code',
              label: 'VS Code settings.json',
              code: `"claudeCode.environmentVariables": [\n  { "name": "ANTHROPIC_BASE_URL", "value": "${site}" },\n  { "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-YOUR-KEY" }\n]`,
            },
          ],
        },
        {
          id: 'verify',
          title: { en: 'Verify', zh: '验证' },
          blocks: [
            {
              type: 'steps',
              items: [
                {
                  en: 'Start claude and run /status. The “Anthropic base URL” line should show this site and the auth line should name ANTHROPIC_AUTH_TOKEN.',
                  zh: '启动 claude 并执行 /status。“Anthropic base URL”一行应显示本站地址，凭据一行应显示 ANTHROPIC_AUTH_TOKEN。',
                },
                {
                  en: 'Send a short question. Then open Usage Logs on this site: a new entry confirms the request arrived.',
                  zh: '发送一句简短问题，再打开本站“使用日志”，有新记录就说明请求到达了本站。',
                },
                {
                  en: 'If Claude Code still asks you to log in, the key did not reach it before first-run setup. Put it in ~/.claude/settings.json rather than a project settings file.',
                  zh: '如果 Claude Code 仍要求登录，说明首次启动时没有读到密钥。请把它放在 ~/.claude/settings.json 中，而不是项目级配置文件里。',
                },
                {
                  en: 'If you were previously logged in with a claude.ai account and see an auth conflict warning, run /logout once.',
                  zh: '如果之前登录过 claude.ai 账号并看到凭据冲突提示，执行一次 /logout。',
                },
              ],
            },
            {
              type: 'appLinks',
              items: [
                {
                  to: '/usage-logs',
                  text: { en: 'Open Usage Logs', zh: '打开使用日志' },
                },
              ],
            },
            {
              type: 'note',
              text: {
                en: 'Never put the key in a project’s .claude/settings.json; that file is usually committed to the repository.',
                zh: '不要把密钥写进项目里的 .claude/settings.json，这个文件通常会被提交到代码仓库。',
              },
              tone: 'warning',
            },
          ],
        },
      ],
    },
    {
      slug: 'config/codex',
      title: { en: 'Codex (manual)', zh: '手动配置 Codex' },
      summary: {
        en: 'One config.toml drives Codex CLI, the IDE extension and the desktop app.',
        zh: 'Codex 命令行、IDE 插件和桌面 App 共用同一份 config.toml。',
      },
      sections: [
        {
          id: 'install',
          title: { en: 'Install', zh: '安装' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Install the CLI with npm, or install the Codex IDE extension or desktop app from OpenAI. All of them read `~/.codex/config.toml` (Windows: `%USERPROFILE%\\.codex\\config.toml`) and the same saved credential.',
                zh: '用 npm 安装命令行，或从 OpenAI 官方安装 Codex IDE 插件、桌面 App。它们都读取 `~/.codex/config.toml`（Windows 为 `%USERPROFILE%\\.codex\\config.toml`）和同一份已保存的凭据。',
              },
            },
            { type: 'code', code: 'npm install -g @openai/codex' },
          ],
        },
        {
          id: 'config',
          title: { en: 'Edit config.toml', zh: '修改 config.toml' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Quit Codex completely, back up any existing file, then set the top-level model and model_provider and add the provider table. If those keys already exist, change their values instead of adding duplicates. Save the file as plain text named config.toml, not config.toml.txt.',
                zh: '先完全退出 Codex，备份已有文件，然后设置顶层的 model 和 model_provider，并添加服务商配置。如果这两个键已存在，请修改其值，不要重复写。文件要存为纯文本 config.toml，不要变成 config.toml.txt。',
              },
            },
            {
              type: 'code',
              label: 'config.toml',
              code: `model = "YOUR-RESPONSES-MODEL-ID"\nmodel_provider = "tokencome"\n\n[model_providers.tokencome]\nname = "Tokencome API"\nbase_url = "${api}"\nwire_api = "responses"\nrequires_openai_auth = true`,
            },
            {
              type: 'p',
              text: {
                en: '`requires_openai_auth = true` makes the provider use the API key saved by Codex sign-in, so the CLI, IDE extension and desktop app all work without extra environment variables. The provider id cannot be openai, ollama or lmstudio, which are reserved.',
                zh: '`requires_openai_auth = true` 让该服务商使用 Codex 登录时保存的 API Key，命令行、IDE 插件和桌面 App 都无需再额外设置环境变量。服务商 id 不能使用 openai、ollama、lmstudio 这几个保留名称。',
              },
            },
          ],
        },
        {
          id: 'sign-in',
          title: { en: 'Save the key', zh: '保存密钥' },
          blocks: [
            {
              type: 'tabs',
              samples: [
                {
                  label: 'CLI (macOS / Linux)',
                  code: 'printf "%s" "sk-YOUR-KEY" | codex login --with-api-key\ncodex login status',
                },
                {
                  label: 'CLI (PowerShell)',
                  code: '"sk-YOUR-KEY" | codex login --with-api-key\ncodex login status',
                },
              ],
            },
            {
              type: 'bullets',
              items: [
                {
                  en: 'Desktop app: on the signed-out screen choose “Sign in another way”, paste the sk- key and continue.',
                  zh: '桌面 App：在未登录界面选择“Sign in another way”（其他方式登录），粘贴 sk- 密钥后继续。',
                },
                {
                  en: 'IDE extension: on the signed-out screen choose “Use API Key”, paste the key and confirm.',
                  zh: 'IDE 插件：在未登录界面选择“Use API Key”，粘贴密钥并确认。',
                },
                {
                  en: 'Already signed in with ChatGPT? Sign out first (codex logout, or the account menu), then sign in with the key.',
                  zh: '已经用 ChatGPT 账号登录过？先退出（codex logout 或账号菜单），再用密钥登录。',
                },
              ],
            },
          ],
        },
        {
          id: 'env-key',
          title: {
            en: 'Alternative: read the key from an environment variable',
            zh: '另一种方式：从环境变量读取密钥',
          },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'For CI or scripts, replace `requires_openai_auth = true` with `env_key = "TOKENCOME_API_KEY"` and set that variable before starting Codex. Desktop apps launched from the Start menu or Dock only see user-level variables: on Windows add it under “Edit environment variables for your account” and sign out and back in.',
                zh: '在 CI 或脚本中，可以把 `requires_openai_auth = true` 换成 `env_key = "TOKENCOME_API_KEY"`，并在启动 Codex 前设置该变量。从开始菜单或程序坞启动的桌面 App 只能读到用户级变量：Windows 需在“编辑账户的环境变量”中添加，并注销后重新登录。',
              },
            },
            {
              type: 'tabs',
              samples: [
                {
                  label: 'macOS / Linux',
                  code: 'export TOKENCOME_API_KEY="sk-YOUR-KEY"\ncodex',
                },
                {
                  label: 'Windows PowerShell',
                  code: '[Environment]::SetEnvironmentVariable("TOKENCOME_API_KEY", "sk-YOUR-KEY", "User")',
                },
              ],
            },
          ],
        },
        {
          id: 'verify',
          title: { en: 'Verify', zh: '验证' },
          blocks: [
            {
              type: 'steps',
              items: [
                {
                  en: 'Start Codex in a project folder and send a small task, such as “list the files here”.',
                  zh: '在一个项目目录启动 Codex，发送一个简单任务，例如“列出这里的文件”。',
                },
                {
                  en: 'Open Usage Logs on this site and confirm a new entry appears with the model you configured.',
                  zh: '打开本站“使用日志”，确认出现了一条使用所配置模型的新记录。',
                },
                {
                  en: 'No entry? Check that config.toml is in the user home folder (project-level .codex/config.toml ignores provider settings), the TOML is valid, and the model supports the Responses endpoint in Model Square.',
                  zh: '没有记录？检查 config.toml 是否位于用户主目录（项目内的 .codex/config.toml 会忽略服务商设置）、TOML 语法是否正确，以及模型广场中该模型是否支持 Responses 接口。',
                },
              ],
            },
            {
              type: 'note',
              text: {
                en: 'Codex config keys change between releases. If your version rejects a key, compare it with the official Codex configuration reference.',
                zh: 'Codex 的配置项会随版本变化。如果当前版本不认某个配置项，请对照 Codex 官方配置说明核对。',
              },
            },
          ],
        },
      ],
    },
    {
      slug: 'config/agents',
      title: { en: 'Other AI agents', zh: '其他 AI 智能体' },
      summary: {
        en: 'OpenClaw, Hermes Agent, DeepSeek Harness, OpenCode and Gemini CLI.',
        zh: 'OpenClaw、Hermes Agent、DeepSeek Harness、OpenCode 和 Gemini CLI。',
      },
      sections: [
        {
          id: 'openclaw',
          title: both('OpenClaw'),
          blocks: [
            {
              type: 'p',
              text: {
                en: 'OpenClaw is an open-source personal AI agent. CC Switch can import this site into it directly. To configure it by hand, add a provider to `~/.openclaw/openclaw.json` and set it as the default model; `openclaw configure` opens the config wizard.',
                zh: 'OpenClaw 是开源的个人 AI 智能体，可以直接用 CC Switch 一键导入。手动配置时，在 `~/.openclaw/openclaw.json` 中添加服务商并设为默认模型；也可以运行 `openclaw configure` 打开配置向导。',
              },
            },
            {
              type: 'code',
              label: 'openclaw.json',
              code: `{\n  models: {\n    providers: {\n      tokencome: {\n        baseUrl: "${api}",\n        apiKey: "sk-YOUR-KEY",\n        api: "openai-completions",\n        models: [{ id: "YOUR-MODEL-ID", name: "YOUR-MODEL-ID" }],\n      },\n    },\n  },\n  agents: {\n    defaults: { model: { primary: "tokencome/YOUR-MODEL-ID" } },\n  },\n}`,
            },
            {
              type: 'p',
              text: {
                en: `For a Claude model through the Anthropic protocol, use \`api: "anthropic-messages"\` with \`baseUrl: "${site}"\`.`,
                zh: `如果要通过 Anthropic 协议使用 Claude 模型，改为 \`api: "anthropic-messages"\`，并把 \`baseUrl\` 设为 \`${site}\`。`,
              },
            },
          ],
        },
        {
          id: 'hermes',
          title: both('Hermes Agent'),
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Hermes Agent from Nous Research supports any OpenAI-compatible endpoint, and CC Switch can import into it. Install it, then run `hermes model`, choose “Custom endpoint”, and enter the base URL, key and model ID.',
                zh: 'Hermes Agent（Nous Research 出品）支持任意 OpenAI 兼容接口，也可以用 CC Switch 导入。安装后运行 `hermes model`，选择“Custom endpoint”，依次填入基础地址、密钥和模型 ID。',
              },
            },
            {
              type: 'tabs',
              samples: [
                {
                  label: 'macOS / Linux / WSL',
                  code: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash\nhermes model',
                },
                {
                  label: 'Windows PowerShell',
                  code: 'iex (irm https://hermes-agent.nousresearch.com/install.ps1)\nhermes model',
                },
                {
                  label: '~/.hermes/config.yaml',
                  code: `model:\n  provider: custom\n  base_url: ${api}\n  api_key: sk-YOUR-KEY\n  default: YOUR-MODEL-ID`,
                },
              ],
            },
            {
              type: 'note',
              text: {
                en: 'Hermes needs a model with at least 64K context. If auto-detection is wrong, add `context_length: 64000` or the model’s real value.',
                zh: 'Hermes 要求模型上下文至少 64K。如果自动识别不准，可以加上 `context_length: 64000` 或模型的实际值。',
              },
            },
          ],
        },
        {
          id: 'deepseek-harness',
          title: both('DeepSeek Harness'),
          blocks: [
            {
              type: 'p',
              text: {
                en: 'DeepSeek Harness (dsh) is DeepSeek’s open-source agent, currently a developer preview. It runs as a local web UI and accepts custom model APIs, so it can use this site’s models instead of DeepSeek’s own key.',
                zh: 'DeepSeek Harness（dsh）是 DeepSeek 推出的开源智能体，目前为开发者预览版。它以本地网页界面运行，支持自定义模型 API，因此可以改用本站的模型，而不必使用 DeepSeek 官方密钥。',
              },
            },
            { type: 'code', code: 'npx @deepseek-ai/dsh web' },
            {
              type: 'steps',
              items: [
                {
                  en: 'The command opens http://127.0.0.1:3080. Go to Settings → Models and choose “Add model provider”, then switch the card to “Custom model API”.',
                  zh: '命令会打开 http://127.0.0.1:3080。进入 Settings → Models，点击“Add model provider”，再把卡片切换为“Custom model API”。',
                },
                {
                  en: `Enter a lowercase provider ID, Base URL ${api}, protocol OpenAI Chat Completions, and your sk- key.`,
                  zh: `填写小写的 Provider ID，Base URL 填 ${api}，协议选 OpenAI Chat Completions，再填入 sk- 密钥。`,
                },
                {
                  en: 'Select “Fetch available models” or type model IDs by hand, save, then add a workspace and start a session.',
                  zh: '点击“Fetch available models”拉取模型，或手动输入模型 ID；保存后添加一个工作区并开始会话。',
                },
              ],
            },
            {
              type: 'note',
              text: {
                en: `A provider speaks one protocol. To use Claude models through the Anthropic protocol, add a second provider with protocol Anthropic Messages and Base URL ${site}. If requests fail with a correct key, enable compat settings “supportsDeveloperRole: false” and “maxTokensField: max_tokens”.`,
                zh: `每个服务商只能使用一种协议。如需通过 Anthropic 协议使用 Claude 模型，请再添加一个协议为 Anthropic Messages、Base URL 为 ${site} 的服务商。密钥正确但请求仍失败时，可在兼容设置中设置 supportsDeveloperRole: false 和 maxTokensField: max_tokens。`,
              },
            },
          ],
        },
        {
          id: 'opencode',
          title: both('OpenCode'),
          blocks: [
            {
              type: 'p',
              text: {
                en: 'OpenCode is an open-source terminal coding agent; CC Switch can import into it. To configure by hand, add a provider to `opencode.json` in your project or `~/.config/opencode/opencode.json`.',
                zh: 'OpenCode 是开源的终端编程智能体，可以用 CC Switch 导入。手动配置时，在项目中的 `opencode.json` 或 `~/.config/opencode/opencode.json` 中添加服务商。',
              },
            },
            {
              type: 'code',
              label: 'opencode.json',
              code: `{\n  "$schema": "https://opencode.ai/config.json",\n  "provider": {\n    "tokencome": {\n      "npm": "@ai-sdk/openai-compatible",\n      "name": "Tokencome",\n      "options": {\n        "baseURL": "${api}",\n        "apiKey": "{env:TOKENCOME_API_KEY}"\n      },\n      "models": {\n        "YOUR-MODEL-ID": { "name": "YOUR-MODEL-ID" }\n      }\n    }\n  }\n}`,
            },
            {
              type: 'p',
              text: {
                en: 'Set TOKENCOME_API_KEY, or run /connect, choose Other, enter the provider id tokencome and paste the key. Then run /models to pick the model.',
                zh: '设置 TOKENCOME_API_KEY 环境变量；或者执行 /connect，选择 Other，输入服务商 id tokencome 并粘贴密钥。然后执行 /models 选择模型。',
              },
            },
          ],
        },
        {
          id: 'gemini-cli',
          title: both('Gemini CLI'),
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Gemini CLI talks the native Gemini protocol. Point it at the site root, start gemini and choose “Use Gemini API key”. CC Switch can also import it.',
                zh: 'Gemini CLI 使用 Gemini 原生协议。把地址指向站点根地址，启动 gemini 后选择“Use Gemini API key”。也可以用 CC Switch 导入。',
              },
            },
            {
              type: 'tabs',
              samples: [
                {
                  label: 'macOS / Linux',
                  code: `export GOOGLE_GEMINI_BASE_URL="${site}"\nexport GEMINI_API_KEY="sk-YOUR-KEY"\ngemini -m YOUR-GEMINI-MODEL-ID`,
                },
                {
                  label: 'Windows PowerShell',
                  code: `$env:GOOGLE_GEMINI_BASE_URL = "${site}"\n$env:GEMINI_API_KEY = "sk-YOUR-KEY"\ngemini -m YOUR-GEMINI-MODEL-ID`,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'config/ide',
      title: { en: 'IDE and coding tools', zh: 'IDE 与编程工具' },
      summary: {
        en: 'Cursor, Cline, Roo Code, Kilo Code, Continue, Trae and similar editors.',
        zh: 'Cursor、Cline、Roo Code、Kilo Code、Continue、Trae 等编辑器。',
      },
      sections: [
        {
          id: 'common',
          title: { en: 'The common settings', zh: '通用填写方式' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Almost every editor has an “OpenAI Compatible” provider. Fill in these values; menu names vary between versions.',
                zh: '几乎所有编辑器都提供“OpenAI Compatible”类型的服务商，按下面填写即可，菜单名称会随版本变化。',
              },
            },
            {
              type: 'code',
              code: `Provider: OpenAI Compatible\nBase URL: ${api}\nAPI Key:  sk-YOUR-KEY\nModel ID: YOUR-MODEL-ID`,
            },
          ],
        },
        {
          id: 'per-tool',
          title: { en: 'Where to find the settings', zh: '各工具的设置入口' },
          blocks: [
            {
              type: 'table',
              head: [
                { en: 'Tool', zh: '工具' },
                { en: 'Where', zh: '设置入口' },
                { en: 'Notes', zh: '说明' },
              ],
              rows: [
                [
                  both('Cline / Roo Code / Kilo Code'),
                  {
                    en: 'Extension settings → API Provider: OpenAI Compatible',
                    zh: '插件设置 → API Provider 选 OpenAI Compatible',
                  },
                  {
                    en: `For Claude models you can also pick the Anthropic provider and set a custom base URL of ${site}.`,
                    zh: `使用 Claude 模型时，也可以选 Anthropic 并把自定义地址设为 ${site}。`,
                  },
                ],
                [
                  both('Continue'),
                  {
                    en: 'config.yaml → models, provider: openai, apiBase',
                    zh: 'config.yaml 的 models 中设置 provider: openai 与 apiBase',
                  },
                  {
                    en: 'Set apiBase to the /v1 address.',
                    zh: 'apiBase 填带 /v1 的地址。',
                  },
                ],
                [
                  both('Cursor'),
                  {
                    en: 'Settings → Models → OpenAI API Key + Override OpenAI Base URL',
                    zh: 'Settings → Models → 填 OpenAI API Key 并开启 Override OpenAI Base URL',
                  },
                  {
                    en: 'Add the model name manually. Some Cursor features always use Cursor’s own models and cannot be redirected.',
                    zh: '需要手动添加模型名。Cursor 部分功能固定使用其自带模型，无法改走本站。',
                  },
                ],
                [
                  both('Trae'),
                  {
                    en: 'Model picker or settings → Add Model / Custom Model',
                    zh: '模型选择器或设置 → 添加模型 / 自定义模型',
                  },
                  {
                    en: 'Requires a version whose custom model form has an editable API address; some editions only offer built-in models.',
                    zh: '需要“自定义模型”表单里有可编辑的 API 地址；部分版本只能选内置模型。',
                  },
                ],
                [
                  both('GitHub Copilot (VS Code)'),
                  {
                    en: 'Install an OpenAI-compatible provider extension, then add a model in Manage Models',
                    zh: '安装 OpenAI 兼容服务商扩展后，在 Manage Models 中添加模型',
                  },
                  {
                    en: 'Availability depends on your Copilot plan and VS Code version.',
                    zh: '是否可用取决于 Copilot 订阅类型和 VS Code 版本。',
                  },
                ],
              ],
            },
            {
              type: 'code',
              label: 'Continue config.yaml',
              code: `models:\n  - name: YOUR-MODEL-ID\n    provider: openai\n    model: YOUR-MODEL-ID\n    apiBase: ${api}\n    apiKey: sk-YOUR-KEY`,
            },
          ],
        },
        {
          id: 'tips',
          title: { en: 'Tips', zh: '注意事项' },
          blocks: [
            {
              type: 'bullets',
              items: [
                {
                  en: 'If an editor has separate Chat, Agent and Autocomplete models, set the one you actually use. Autocomplete needs a fast, cheap model.',
                  zh: '编辑器分别设置聊天、Agent 和自动补全模型时，要在实际使用的功能里选中它。自动补全建议选速度快、价格低的模型。',
                },
                {
                  en: 'A 404 usually means the editor added /v1 again. Try the site root instead.',
                  zh: '出现 404 通常是编辑器又拼接了一次 /v1，可改填站点根地址再试。',
                },
                {
                  en: 'Agent mode and tool calling need a model that supports function calling. Test plain chat first.',
                  zh: 'Agent 模式和工具调用需要模型支持函数调用。先测试普通对话。',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'config/office',
      title: {
        en: 'Chat, office and translation apps',
        zh: '聊天、办公与翻译软件',
      },
      summary: {
        en: 'WorkBuddy, Cherry Studio, Chatbox, Immersive Translate and other everyday apps.',
        zh: 'WorkBuddy、Cherry Studio、Chatbox、沉浸式翻译等日常软件。',
      },
      sections: [
        {
          id: 'address-rule',
          title: {
            en: 'First: which address does the app want?',
            zh: '先看软件要哪种地址',
          },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Apps ask for one of three address forms. Read the field label or placeholder; if you get a 404, try the next form.',
                zh: '软件要求填写的地址有三种形式。先看输入框的名称或占位提示；出现 404 时换下一种试试。',
              },
            },
            {
              type: 'table',
              head: [
                { en: 'The app asks for', zh: '软件要求' },
                { en: 'Enter', zh: '填写' },
              ],
              rows: [
                [
                  {
                    en: 'API host / domain (it adds /v1 itself)',
                    zh: 'API 主机 / 域名（软件自动补 /v1）',
                  },
                  both(site),
                ],
                [
                  { en: 'Base URL / API address', zh: 'Base URL / API 地址' },
                  both(api),
                ],
                [
                  {
                    en: 'Full endpoint / request URL',
                    zh: '完整接口地址 / 请求 URL',
                  },
                  both(`${api}/chat/completions`),
                ],
              ],
            },
          ],
        },
        {
          id: 'workbuddy',
          title: both('WorkBuddy'),
          blocks: [
            {
              type: 'p',
              text: {
                en: 'WorkBuddy is Tencent’s AI workspace for documents, spreadsheets, slides and data analysis. It accepts custom models through its settings.',
                zh: 'WorkBuddy 是腾讯出品的 AI 工作台，可以处理文档、表格、PPT 和数据分析，支持在设置中接入自定义模型。',
              },
            },
            {
              type: 'steps',
              items: [
                {
                  en: 'Open Settings → Models and add a custom model. Choose “Custom” so you can type the address yourself.',
                  zh: '打开“设置 → 模型”，添加自定义模型，选择“自定义 / Custom”以便手动填写地址。',
                },
                {
                  en: `Enter URL ${api}, your sk- key and an exact model ID from Model Square. WorkBuddy adds /chat/completions itself.`,
                  zh: `URL 填 ${api}，API Key 填 sk- 密钥，模型名填模型广场里的准确模型 ID。WorkBuddy 会自动补全 /chat/completions。`,
                },
                {
                  en: 'Save, start a new task, pick the model from the custom group in the model picker and send a short request.',
                  zh: '保存后新建任务，在模型选择器的自定义模型分组中选中它，发送一条简短请求测试。',
                },
              ],
            },
            {
              type: 'note',
              text: {
                en: 'Leave the “custom protocol” switch under advanced settings off. Turn it on only if you deliberately enter the full endpoint URL.',
                zh: '高级配置中的“自定义协议”开关保持关闭；只有在你有意填写完整接口地址时才需要打开。',
              },
            },
          ],
        },
        {
          id: 'cherry-studio',
          title: both('Cherry Studio'),
          blocks: [
            {
              type: 'steps',
              items: [
                {
                  en: 'Open Settings → Model Services and select Add. Choose provider type OpenAI, or Anthropic if you want Cherry Agent with Claude models.',
                  zh: '打开“设置 → 模型服务”，点击“添加”。服务商类型选 OpenAI；如果要配合 Cherry Agent 使用 Claude 模型，则选 Anthropic。',
                },
                {
                  en: `Enter API address ${site} (Cherry Studio appends /v1/chat/completions itself) and paste your key.`,
                  zh: `API 地址填 ${site}（Cherry Studio 会自动补上 /v1/chat/completions），再粘贴密钥。`,
                },
                {
                  en: 'Select “Fetch model list” and add the models you need with +, then use “Check” to test.',
                  zh: '点击“获取模型列表”，用 + 添加需要的模型，再点“检测”测试连接。',
                },
                {
                  en: 'Turn on the switch in the top-right corner of the provider; otherwise its models do not appear in the model picker.',
                  zh: '打开服务商右上角的启用开关，否则模型选择器里看不到它的模型。',
                },
              ],
            },
            {
              type: 'note',
              text: {
                en: `An address ending with # is used exactly as typed. If you enter the full ${api}/chat/completions, add # at the end.`,
                zh: `地址以 # 结尾时，Cherry Studio 不再自动拼接路径。如果你填写完整的 ${api}/chat/completions，末尾要加 #。`,
              },
            },
          ],
        },
        {
          id: 'chatbox',
          title: both('Chatbox'),
          blocks: [
            {
              type: 'steps',
              items: [
                {
                  en: 'Open Settings → Model Provider, scroll down and select Add.',
                  zh: '打开“设置 → 模型提供方”，滚动到底部点击“添加”。',
                },
                {
                  en: `Name it, choose API mode “OpenAI API Compatible”, enter API Host ${site} and your key. Leave API Path empty; it defaults to /v1/chat/completions.`,
                  zh: `填写名称，API 模式选“OpenAI API 兼容”，API Host 填 ${site}，再填密钥。API Path 留空，默认为 /v1/chat/completions。`,
                },
                {
                  en: 'Add at least one model ID, save, select Check, then start a new conversation with that model.',
                  zh: '至少添加一个模型 ID，保存后点击“检查”，再新建对话选择该模型。',
                },
              ],
            },
          ],
        },
        {
          id: 'immersive-translate',
          title: { en: 'Immersive Translate', zh: '沉浸式翻译' },
          blocks: [
            {
              type: 'steps',
              items: [
                {
                  en: 'Open the extension settings → Translation services and choose OpenAI (or add a custom AI service).',
                  zh: '打开插件设置 → 翻译服务，选择 OpenAI（或添加自定义 AI 服务）。',
                },
                {
                  en: `Enter the key, a custom model ID, and the full custom API address ${api}/chat/completions.`,
                  zh: `填入密钥、自定义模型 ID，以及完整的自定义 API 地址 ${api}/chat/completions。`,
                },
                {
                  en: 'Page translation sends many requests at once. If you see 429 errors, lower the maximum requests per second in the service settings.',
                  zh: '整页翻译会同时发出大量请求。如果出现 429，请在服务设置中调低每秒最大请求数。',
                },
              ],
            },
          ],
        },
        {
          id: 'more-apps',
          title: { en: 'More apps', zh: '更多常用软件' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'These popular apps also accept a custom OpenAI-compatible service. Look for the setting named in the table and use the address form from the first section of this page.',
                zh: '下面这些常用软件也支持自定义 OpenAI 兼容服务。按表中入口找到设置，地址形式参考本页第一节。',
              },
            },
            {
              type: 'table',
              head: [
                { en: 'Category', zh: '类别' },
                { en: 'Apps', zh: '软件' },
                { en: 'Where to configure', zh: '配置入口' },
              ],
              rows: [
                [
                  { en: 'Chat clients', zh: '聊天客户端' },
                  both('LobeChat, NextChat, DeepChat, 5ire, AnythingLLM'),
                  {
                    en: 'Settings → model provider → OpenAI, custom API address',
                    zh: '设置 → 模型服务商 → OpenAI，填写自定义 API 地址',
                  },
                ],
                [
                  { en: 'Translation', zh: '翻译工具' },
                  {
                    en: 'Bob (macOS), Easydict (macOS), Pot, STranslate (Windows), PDFMathTranslate',
                    zh: 'Bob（macOS）、Easydict（macOS）、Pot、STranslate（Windows）、PDFMathTranslate',
                  },
                  {
                    en: 'Service settings → OpenAI or “OpenAI compatible”',
                    zh: '服务设置 → OpenAI 或“OpenAI 兼容”',
                  },
                ],
                [
                  { en: 'Browser extensions', zh: '浏览器插件' },
                  {
                    en: 'Sider-style sidebars, ChatGPT Box, Hover translators',
                    zh: '侧边栏助手、ChatGPT Box、划词翻译等',
                  },
                  {
                    en: 'Extension options → custom API / API host',
                    zh: '插件选项 → 自定义 API / API Host',
                  },
                ],
                [
                  { en: 'Notes and writing', zh: '笔记与写作' },
                  {
                    en: 'Obsidian (Copilot, Tars plugins), SiYuan, Zotero (PapersGPT)',
                    zh: 'Obsidian（Copilot、Tars 插件）、思源笔记、Zotero（PapersGPT）',
                  },
                  {
                    en: 'Plugin settings → OpenAI-compatible provider, base URL',
                    zh: '插件设置 → OpenAI 兼容服务商，填写 Base URL',
                  },
                ],
                [
                  { en: 'Office plugins', zh: '办公插件' },
                  {
                    en: 'OfficeAI for Word / Excel / WPS, other Office add-ins',
                    zh: 'OfficeAI 助手（Word / Excel / WPS）等 Office 插件',
                  },
                  {
                    en: 'Plugin settings → custom model / large model settings',
                    zh: '插件设置 → 自定义模型 / 大模型设置',
                  },
                ],
                [
                  { en: 'Chat bots', zh: '群聊机器人' },
                  {
                    en: 'chatgpt-on-wechat, LangBot, AstrBot (WeChat Work, Feishu, DingTalk, QQ)',
                    zh: 'chatgpt-on-wechat、LangBot、AstrBot（企业微信、飞书、钉钉、QQ）',
                  },
                  {
                    en: 'Config file or admin panel → OpenAI base URL and key',
                    zh: '配置文件或管理面板 → OpenAI 地址与密钥',
                  },
                ],
                [
                  { en: 'Mobile', zh: '手机' },
                  {
                    en: 'Chatbox and Cherry Studio mobile, SwiftChat, other OpenAI-compatible apps',
                    zh: 'Chatbox 与 Cherry Studio 手机版、SwiftChat 等 OpenAI 兼容 App',
                  },
                  {
                    en: 'Same fields as the desktop versions',
                    zh: '与桌面版填写方式相同',
                  },
                ],
              ],
            },
            {
              type: 'note',
              text: {
                en: 'Apps built into a platform, such as DingTalk AI assistant or WPS AI, use the platform’s own models and cannot be pointed at this site. The DeepSeek and Doubao consumer apps work the same way; use the API with the tools above instead.',
                zh: '平台内置的 AI（例如钉钉 AI 助理、WPS AI）使用平台自己的模型，无法改为本站接口。DeepSeek、豆包等官方 App 也是如此；需要时请改用上面这些支持自定义 API 的工具。',
              },
            },
          ],
        },
      ],
    },
  ]
}
