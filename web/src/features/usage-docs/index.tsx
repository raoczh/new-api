import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'

type Copy = { en: string; zh: string }
type Block = {
  type: 'p' | 'list' | 'code'
  text?: Copy
  items?: Copy[]
  code?: string
}
type Topic = { id: string; title: Copy; blocks: Block[] }
type Chapter = { id: string; title: Copy; topics: Topic[] }

const chapters: Chapter[] = [
  {
    id: 'before-you-start',
    title: { en: 'Before you start', zh: '开始前准备' },
    topics: [
      {
        id: 'account',
        title: { en: 'Account and balance', zh: '账号与余额' },
        blocks: [
          {
            type: 'p',
            text: {
              en: 'Register and sign in to this site. Open Model Square to check which models are currently available, then check your balance and any applicable usage limits in the console. A model shown elsewhere on the internet is not necessarily enabled here.',
              zh: '先注册并登录本站。进入“模型广场”查看当前可用模型，再在控制台确认余额与使用限制。网上看到的模型名称，不代表本站一定已开通。',
            },
          },
          {
            type: 'p',
            text: {
              en: 'The API address is this site origin plus /v1. For example, if this site is https://example.com, the base URL is https://example.com/v1. Do not append /chat/completions when an app asks for a base URL.',
              zh: 'API 基础地址是本站网址加 /v1。例如本站是 https://example.com，基础地址就是 https://example.com/v1。软件要求填写“基础地址”时，不要再加 /chat/completions。',
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
                en: 'Copy the complete key immediately and keep it private. It usually begins with sk-. It is different from your account password and from an official OpenAI API key.',
                zh: '立即复制并妥善保管完整密钥，通常以 sk- 开头。它不是登录密码，也不是 OpenAI 官方 API Key。',
              },
              {
                en: 'If a key is exposed, revoke it and create a new one. Never put it in a public repository, screenshot or chat message.',
                zh: '如果密钥泄露，立即停用并重新创建。不要把密钥放进公开代码仓库、截图或聊天记录。',
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
        id: 'three-fields',
        title: { en: 'The three fields', zh: '只需认清三个参数' },
        blocks: [
          {
            type: 'list',
            items: [
              {
                en: 'Base URL: this site origin followed by /v1. Some clients ask for the server URL without /v1; follow that client’s field description.',
                zh: '基础地址：本站网址后面加 /v1。有些软件明确要求填写不含 /v1 的服务器地址，此时按该软件字段说明填写。',
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
              en: 'This PowerShell example uses the OpenAI-compatible Chat Completions endpoint. Replace the URL, key and model, then run the commands in PowerShell. On macOS or Linux, send the same JSON body and Authorization: Bearer header with curl or an SDK.',
              zh: '下面是 Windows PowerShell 中调用 OpenAI 兼容 Chat Completions 接口的示例。先替换网址、密钥和模型标识，再逐行执行。macOS/Linux 可用 curl 或 SDK 发送相同 JSON 请求体和 Authorization: Bearer 请求头。',
            },
          },
          {
            type: 'code',
            code: '$body = @{ model = "YOUR-MODEL-ID"; messages = @(@{ role = "user"; content = "Hello" }) } | ConvertTo-Json -Depth 4\nInvoke-RestMethod -Uri "https://YOUR-SITE.example/v1/chat/completions" -Method Post -Headers @{ Authorization = "Bearer sk-YOUR-KEY" } -ContentType "application/json" -Body $body',
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
    ],
  },
  {
    id: 'codex',
    title: { en: 'Codex App and SK keys', zh: 'Codex App 与 SK 密钥' },
    topics: [
      {
        id: 'codex-difference',
        title: { en: 'Know the distinction', zh: '先区分两种密钥' },
        blocks: [
          {
            type: 'p',
            text: {
              en: 'The Codex App sign-in screen belongs to OpenAI. A key issued by this site cannot be used as an OpenAI account login or pasted into the official OpenAI key field and expected to use this gateway. Third-party access requires a custom model provider, if your installed Codex App supports that configuration.',
              zh: 'Codex App 的登录界面属于 OpenAI。本站发放的 sk- 密钥不能用于登录 OpenAI 账号，也不能仅粘贴进“OpenAI API Key”框就自动走本站。要接入第三方网关，需要你安装的 Codex App 版本支持自定义模型提供方配置。',
            },
          },
          {
            type: 'p',
            text: {
              en: 'First check the App settings for a custom provider or base URL. If your version has no such option and does not load Codex configuration, this route is unavailable in that version; use a client with a custom OpenAI-compatible provider instead. Do not overwrite your official OpenAI credentials.',
              zh: '先检查 App 设置中是否有“自定义提供方”或“基础地址”，以及它是否读取 Codex 配置。如果当前版本没有这些能力，便无法通过该版本 App 直连本站；请改用支持自定义 OpenAI 兼容提供方的客户端。不要覆盖你的 OpenAI 官方凭据。',
            },
          },
        ],
      },
      {
        id: 'codex-config',
        title: { en: 'Custom provider configuration', zh: '配置自定义提供方' },
        blocks: [
          {
            type: 'p',
            text: {
              en: 'For Codex installations that support custom providers through config.toml, add a provider like the example below. Replace the site URL and model ID. Choose a model that supports the Responses API; Chat Completions support alone is insufficient.',
              zh: '如果你的 Codex 安装支持通过 config.toml 配置自定义提供方，可按下面的示例添加。替换本站网址与模型标识。请选择支持 Responses API 的模型；仅支持 Chat Completions 的模型不能保证在 Codex 中工作。',
            },
          },
          {
            type: 'code',
            code: 'model = "YOUR-RESPONSES-MODEL-ID"\nmodel_provider = "site"\n\n[model_providers.site]\nname = "Site API"\nbase_url = "https://YOUR-SITE.example/v1"\nenv_key = "SITE_API_KEY"\nwire_api = "responses"',
          },
          {
            type: 'p',
            text: {
              en: 'Set SITE_API_KEY to your site key in your operating system environment, fully quit the App, then reopen it. On Windows PowerShell, set it for the current launch with $env:SITE_API_KEY="sk-YOUR-KEY"; on macOS/Linux use export SITE_API_KEY="sk-YOUR-KEY". Launch the App from that environment only if it inherits these variables. A persistent system environment variable may require a new login session.',
              zh: '再把本站密钥放入操作系统环境变量 SITE_API_KEY，完全退出并重新打开 App。Windows PowerShell 当前窗口可用 $env:SITE_API_KEY="sk-YOUR-KEY"；macOS/Linux 可用 export SITE_API_KEY="sk-YOUR-KEY"。只有从该环境启动并继承变量的 App 才能读到它；持久化系统变量后可能需要重新登录系统。',
            },
          },
          {
            type: 'p',
            text: {
              en: 'If the App ignores the custom provider, verify its version and configuration support rather than repeatedly entering the site key into OpenAI sign-in. Codex CLI and Codex App may expose different settings.',
              zh: '如果 App 没有读取自定义提供方，应核实当前版本的配置支持情况，不要反复把本站密钥填进 OpenAI 登录界面。Codex CLI 与 Codex App 的设置能力可能不同。',
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
            type: 'list',
            items: [
              {
                en: 'Open WorkBuddy settings and find Models, Providers or API configuration. Menu names differ by version.',
                zh: '打开 WorkBuddy 设置，寻找“模型”“提供方”或“API 配置”。不同版本菜单名称可能不同。',
              },
              {
                en: 'Add a custom OpenAI-compatible provider, if available. Enter this site’s base URL ending in /v1, the site sk- key, and an exact model ID from Model Square.',
                zh: '如果提供“自定义 OpenAI 兼容提供方”，新增该提供方。基础地址填本站 /v1 地址，API Key 填本站 sk- 密钥，模型填“模型广场”的准确标识。',
              },
              {
                en: 'Save, select the new model in a new chat, and send a short test message. If no custom provider or base URL field exists, this version cannot be configured through this method.',
                zh: '保存后，在新会话中选中刚配置的模型，发送一条简短测试消息。如果没有自定义提供方或基础地址字段，当前版本不能用此方式接入。',
              },
            ],
          },
        ],
      },
      {
        id: 'trae',
        title: { en: 'Trae', zh: 'Trae 接入' },
        blocks: [
          {
            type: 'list',
            items: [
              {
                en: 'Open Trae settings or the model selector and look for Add Model, Custom Model or an OpenAI-compatible provider. Availability depends on the edition and version.',
                zh: '打开 Trae 设置或模型选择器，寻找“添加模型”“自定义模型”或 OpenAI 兼容提供方。是否提供此功能取决于版本。',
              },
              {
                en: 'Set the API base URL to this site origin plus /v1, paste your site sk- key, and enter a supported model ID exactly as listed.',
                zh: 'API 基础地址填写本站网址加 /v1，粘贴本站 sk- 密钥，并准确填写已支持的模型标识。',
              },
              {
                en: 'Save and choose the configured model for chat or coding. If Trae only offers built-in providers, it cannot be made to use a third-party key by changing the key alone.',
                zh: '保存后，在聊天或编程功能中选择已配置的模型。如果 Trae 仅提供内置提供方，单纯更换密钥无法让它走第三方网关。',
              },
            ],
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
        id: 'errors',
        title: { en: 'Common errors', zh: '常见错误' },
        blocks: [
          {
            type: 'list',
            items: [
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
                en: '429 or insufficient balance: inspect limits, key quota and account balance. Retry only after resolving the restriction.',
                zh: '429 或余额不足：查看限流、密钥额度与账户余额，解除限制后再重试。',
              },
              {
                en: 'Connection or TLS error: confirm HTTPS, the domain name, network access and any proxy settings in your client.',
                zh: '连接或 TLS 错误：确认 HTTPS、域名、网络连通性，以及客户端中的代理设置。',
              },
            ],
          },
        ],
      },
    ],
  },
]

export function UsageDocs() {
  const { i18n, t } = useTranslation()
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en'

  return (
    <PublicLayout>
      <div className='mx-auto grid max-w-7xl gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]'>
        <aside
          className='lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto'
          aria-label={t('Usage Documentation')}
        >
          <nav
            className='flex gap-4 overflow-x-auto pb-3 lg:block lg:space-y-5'
            aria-label={t('Usage Documentation')}
          >
            {chapters.map((chapter) => (
              <div key={chapter.id} className='shrink-0'>
                <a
                  className='text-foreground text-sm font-semibold hover:underline'
                  href={`#${chapter.id}`}
                >
                  {chapter.title[language]}
                </a>
                <ul className='mt-2 space-y-1 lg:pl-3'>
                  {chapter.topics.map((topic) => (
                    <li key={topic.id}>
                      <a
                        className='text-muted-foreground hover:text-foreground block py-1 text-xs'
                        href={`#${topic.id}`}
                      >
                        {topic.title[language]}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <article className='min-w-0 pb-20'>
          <h1 className='mb-3 text-3xl font-semibold'>
            {t('Usage Documentation')}
          </h1>
          <p className='text-muted-foreground mb-10 text-sm'>
            {language === 'zh'
              ? '从注册账号到发送第一条请求，逐步完成接入。'
              : 'From account setup to your first request, one step at a time.'}
          </p>
          <div className='mb-10 flex flex-wrap gap-3 text-sm'>
            <Link to='/keys' className='text-primary hover:underline'>
              {language === 'zh' ? '创建 API 密钥' : 'Create an API key'}
            </Link>
            <Link to='/pricing' className='text-primary hover:underline'>
              {language === 'zh' ? '查看模型广场' : 'Browse Model Square'}
            </Link>
          </div>
          {chapters.map((chapter) => (
            <section
              key={chapter.id}
              id={chapter.id}
              className='mb-12 scroll-mt-24'
            >
              <h2 className='border-b pb-3 text-2xl font-semibold'>
                {chapter.title[language]}
              </h2>
              {chapter.topics.map((topic) => (
                <section
                  key={topic.id}
                  id={topic.id}
                  className='mt-8 scroll-mt-24 space-y-4'
                >
                  <h3 className='text-lg font-semibold'>
                    {topic.title[language]}
                  </h3>
                  {topic.blocks.map((block) => {
                    const blockKey =
                      block.code ?? block.text?.en ?? block.items?.[0]?.en
                    if (block.type === 'code') {
                      return (
                        <pre
                          key={blockKey}
                          className='bg-muted overflow-x-auto rounded-sm p-4 text-xs leading-relaxed'
                        >
                          <code>{block.code}</code>
                        </pre>
                      )
                    }
                    if (block.type === 'list') {
                      return (
                        <ol
                          key={blockKey}
                          className='text-muted-foreground list-decimal space-y-2 pl-6 text-sm leading-7'
                        >
                          {block.items?.map((item) => (
                            <li key={item.en}>{item[language]}</li>
                          ))}
                        </ol>
                      )
                    }
                    return (
                      <p
                        key={blockKey}
                        className='text-muted-foreground text-sm leading-7'
                      >
                        {block.text?.[language]}
                      </p>
                    )
                  })}
                </section>
              ))}
            </section>
          ))}
        </article>
      </div>
    </PublicLayout>
  )
}
