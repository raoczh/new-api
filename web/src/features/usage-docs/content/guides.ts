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

export function buildGuidePages(urls: DocUrls): DocPage[] {
  const { site, api } = urls

  return [
    {
      slug: 'guides/streaming',
      title: { en: 'Streaming', zh: '流式响应' },
      summary: {
        en: 'Receive output token by token with server-sent events.',
        zh: '通过 SSE 逐字接收模型输出。',
      },
      sections: [
        {
          id: 'enable',
          title: { en: 'Turn on streaming', zh: '开启流式输出' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'Set `"stream": true`. The response arrives as server-sent events (text/event-stream), and OpenAI-style streams end with `data: [DONE]`. Token usage is included in the final chunk, so usage logs stay accurate when streaming.',
                zh: '设置 `"stream": true`。响应会以 SSE（text/event-stream）逐段返回，OpenAI 风格的流以 `data: [DONE]` 结束。token 用量包含在最后一个分段中，因此流式请求的使用日志同样准确。',
              },
            },
            {
              type: 'tabs',
              samples: [
                {
                  label: 'curl',
                  code: `curl -N ${api}/chat/completions \\\n  -H "Authorization: Bearer sk-YOUR-KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"YOUR-MODEL-ID","stream":true,"messages":[{"role":"user","content":"Hello"}]}'`,
                },
                {
                  label: 'Python',
                  code: `from openai import OpenAI\n\nclient = OpenAI(api_key="sk-YOUR-KEY", base_url="${api}")\nstream = client.chat.completions.create(\n    model="YOUR-MODEL-ID",\n    messages=[{"role": "user", "content": "Hello"}],\n    stream=True,\n)\nfor chunk in stream:\n    if chunk.choices and chunk.choices[0].delta.content:\n        print(chunk.choices[0].delta.content, end="", flush=True)`,
                },
                {
                  label: 'Anthropic',
                  code: `from anthropic import Anthropic\n\nclient = Anthropic(api_key="sk-YOUR-KEY", base_url="${site}")\nwith client.messages.stream(\n    model="YOUR-CLAUDE-MODEL-ID",\n    max_tokens=1024,\n    messages=[{"role": "user", "content": "Hello"}],\n) as stream:\n    for text in stream.text_stream:\n        print(text, end="", flush=True)`,
                },
              ],
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
                  en: 'Disable buffering in any proxy you run in front of your app (for nginx, `proxy_buffering off`), or the output arrives all at once.',
                  zh: '如果你在应用前面自建了代理，请关闭缓冲（nginx 为 `proxy_buffering off`），否则输出会一次性到达。',
                },
                {
                  en: 'Reasoning models may think for a while before the first token. Set client timeouts generously and avoid timing out on the first byte.',
                  zh: '推理模型在输出第一个字之前可能思考较久。客户端超时请设得宽松一些，不要按首字节超时。',
                },
                {
                  en: 'Once output has started, the gateway can no longer switch channels. A stream that breaks mid-way must be retried by your code.',
                  zh: '一旦开始输出，网关就不能再切换渠道。流式中途断开时需要由你的程序重试。',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'guides/error-handling',
      title: { en: 'Error handling and retries', zh: '错误处理与重试' },
      summary: {
        en: 'What the gateway retries for you, what your code should retry, and how to troubleshoot.',
        zh: '网关会自动重试哪些错误、你的程序该重试哪些，以及排查步骤。',
      },
      sections: [
        {
          id: 'gateway-retry',
          title: { en: 'Retries done by the gateway', zh: '网关自动重试' },
          blocks: [
            {
              type: 'bullets',
              items: [
                {
                  en: 'When an upstream channel fails before any output is sent, the gateway retries the request on another available channel. You are billed once, for the attempt that succeeds.',
                  zh: '上游渠道在输出任何内容之前失败时，网关会换一个可用渠道重试。只会对最终成功的那次请求计费。',
                },
                {
                  en: 'Some conversations are pinned to one channel to reuse prompt caching. If that channel fails, the request may stop instead of switching, so the next retry starts fresh.',
                  zh: '部分会话会固定在同一渠道以复用提示缓存。该渠道失败时，请求可能直接结束而不切换，下一次重试会重新选路。',
                },
                {
                  en: 'Errors caused by the request itself, such as insufficient balance, a forbidden model or invalid parameters, are not retried.',
                  zh: '由请求本身引起的错误（例如余额不足、模型无权访问、参数错误）不会重试。',
                },
                {
                  en: 'With the auto group and cross-group retry enabled on the key, failures can continue into the next group.',
                  zh: '密钥使用 auto 分组并开启跨分组重试时，失败后还会继续尝试下一个分组。',
                },
              ],
            },
          ],
        },
        {
          id: 'client-retry',
          title: { en: 'Retries in your code', zh: '程序端重试' },
          blocks: [
            {
              type: 'bullets',
              items: [
                {
                  en: 'Retry 429, 500, 502, 503, 504 and 529 with exponential backoff and jitter, for example 1 s, 2 s, 4 s, capped at a few attempts.',
                  zh: '对 429、500、502、503、504、529 使用指数退避加随机抖动重试，例如 1 秒、2 秒、4 秒，最多重试几次。',
                },
                {
                  en: 'Do not retry 400, 401, 403 or 404 unchanged; fix the request, key or address first.',
                  zh: '400、401、403、404 不要原样重试，先修正请求、密钥或地址。',
                },
                {
                  en: 'The official OpenAI and Anthropic SDKs already retry transient errors; set max_retries instead of writing your own loop.',
                  zh: 'OpenAI 和 Anthropic 官方 SDK 已内置对临时错误的重试，设置 max_retries 即可，无需自己写循环。',
                },
              ],
            },
            {
              type: 'code',
              label: 'Python',
              code: `from openai import OpenAI\n\nclient = OpenAI(\n    api_key="sk-YOUR-KEY",\n    base_url="${api}",\n    max_retries=3,\n    timeout=600,\n)`,
            },
          ],
        },
        {
          id: 'troubleshooting',
          title: { en: 'Troubleshooting order', zh: '推荐排查顺序' },
          blocks: [
            {
              type: 'steps',
              items: [
                {
                  en: `Key: request GET ${api}/models. A failure here is about the key, its status or quota, not the model.`,
                  zh: `先验密钥：请求 GET ${api}/models。这一步失败说明问题在密钥、状态或额度，而不在模型。`,
                },
                {
                  en: `Address: send a short non-streaming POST to ${api}/chat/completions. A 404 usually means a doubled or missing /v1.`,
                  zh: `再验地址：向 ${api}/chat/completions 发送一条不开流式的短请求。返回 404 通常是 /v1 重复或缺失。`,
                },
                {
                  en: 'Model: use an id returned by the model list and compare it with the key’s model limits and group.',
                  zh: '再验模型：使用模型列表返回的 id，并对照密钥的模型限制和分组。',
                },
                {
                  en: 'Logs: open Usage Logs. No entry means the request never reached this site; an entry with an error tells you why it failed.',
                  zh: '查看日志：打开“使用日志”。没有记录说明请求没有到达本站；有错误记录则可以看到失败原因。',
                },
                {
                  en: 'Then turn on streaming, images, tools or Agent mode one at a time.',
                  zh: '以上都通过后，再逐一开启流式、图片、工具或 Agent 模式。',
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
                {
                  to: '/status-monitor',
                  text: { en: 'Open Status Monitor', zh: '打开状态监控' },
                },
              ],
            },
          ],
        },
        {
          id: 'normal-behavior',
          title: {
            en: 'Slow replies and connection tests',
            zh: '响应慢与连接测试',
          },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'The first token can be slow when a model is busy, a conversation contains long documents or code, or a reasoning model is thinking. Streams can pause briefly, and balances can update a moment later. None of this alone means the configuration is wrong. Compare with Status Monitor to see whether a model is slow for everyone.',
                zh: '模型繁忙、对话包含长文档或代码、推理模型思考时，首字可能较慢；流式输出也可能短暂停顿，余额显示可能稍有延迟。这些现象本身不代表配置错误。可以对照“状态监控”判断该模型是否对所有人都慢。',
              },
            },
          ],
        },
        {
          id: 'contact-support',
          title: { en: 'Contact support', zh: '联系支持' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'If a short request keeps failing, send the details below. The time and the request id let the operator find your log entry. Never send the full API key, password, verification code or recovery code.',
                zh: '短请求持续失败时，请提供以下信息。时间和 request id 有助于运营方定位你的日志。不要发送完整 API 密钥、账号密码、验证码或恢复码。',
              },
            },
            {
              type: 'code',
              code: `Account email: YOUR-EMAIL\nAPI key: last 6 characters only\nClient and version: Claude Code / Codex / Cherry Studio / other\nBase URL: ${api} (or ${site} for Claude / Gemini)\nModel ID: YOUR-MODEL-ID\nError text and request id: REMOVE ALL SECRETS FIRST\nTime and time zone: YYYY-MM-DD HH:MM\nStreaming: on / off\nScope: one model / all models`,
            },
            { type: 'contact' },
          ],
        },
      ],
    },
    {
      slug: 'guides/rate-limits',
      title: { en: 'Rate limits and quota', zh: '速率限制与额度' },
      summary: {
        en: 'The limits that can stop a request and how to tell them apart.',
        zh: '可能拦住请求的各类限制，以及如何区分它们。',
      },
      sections: [
        {
          id: 'limits',
          title: { en: 'Limits that apply', zh: '会生效的限制' },
          blocks: [
            {
              type: 'table',
              head: [
                { en: 'Limit', zh: '限制' },
                { en: 'Error you see', zh: '报错表现' },
                { en: 'How to resolve', zh: '解决方法' },
              ],
              rows: [
                [
                  {
                    en: 'Request rate set by the operator',
                    zh: '运营方设置的请求频率',
                  },
                  {
                    en: '429 “request rate limit reached: at most N requests in M minutes”',
                    zh: '429“您已达到请求数限制：M 分钟内最多请求 N 次”',
                  },
                  {
                    en: 'Wait for the window to pass, or lower concurrency',
                    zh: '等待时间窗口过去，或降低并发',
                  },
                ],
                [
                  { en: 'Upstream rate limit', zh: '上游限流' },
                  {
                    en: '429 from the upstream provider',
                    zh: '上游服务商返回的 429',
                  },
                  {
                    en: 'Retry with backoff; the gateway also tries other channels',
                    zh: '按退避策略重试；网关也会尝试其他渠道',
                  },
                ],
                [
                  { en: 'Key quota', zh: '密钥额度' },
                  {
                    en: '401 Invalid token, or 403 pre_consume_token_quota_failed',
                    zh: '401 无效的令牌，或 403 pre_consume_token_quota_failed',
                  },
                  {
                    en: 'Raise the key’s quota or set it to unlimited',
                    zh: '调高密钥额度或设为无限额度',
                  },
                ],
                [
                  { en: 'Account balance', zh: '账户余额' },
                  both('403 insufficient_user_quota'),
                  {
                    en: 'Top up or redeem a code in Wallet',
                    zh: '在“钱包”中充值或兑换',
                  },
                ],
                [
                  { en: 'Key expiry', zh: '密钥有效期' },
                  { en: '401 Invalid token', zh: '401 无效的令牌' },
                  {
                    en: 'Extend the expiry or create a new key',
                    zh: '延长有效期或新建密钥',
                  },
                ],
              ],
            },
            {
              type: 'note',
              text: {
                en: 'Before a request runs, an estimated cost is reserved from the key and the account, then settled to the actual cost afterwards. A long max_tokens or a large image batch can therefore be rejected even when the final cost would have been small.',
                zh: '请求执行前，会先按预估费用从密钥和账户中预扣，结束后再按实际用量结算。因此 max_tokens 设得很大或批量生成图片时，即使最终费用不高，也可能因预扣不足而被拒绝。',
              },
            },
          ],
        },
      ],
    },
    {
      slug: 'guides/billing',
      title: { en: 'Billing and balance', zh: '计费与余额' },
      summary: {
        en: 'How a request is priced and where to see what you spent.',
        zh: '请求如何计价，以及在哪里查看消费。',
      },
      sections: [
        {
          id: 'how-priced',
          title: { en: 'How a request is priced', zh: '请求如何计价' },
          blocks: [
            {
              type: 'bullets',
              items: [
                {
                  en: 'Token-priced models charge input, output and cache tokens at separate rates. Cache reads are usually much cheaper than fresh input.',
                  zh: '按 token 计费的模型，输入、输出和缓存 token 分别计价。缓存读取通常比普通输入便宜很多。',
                },
                {
                  en: 'Per-request models, such as many image and video models, charge a fixed price per call, image or second, adjusted by size, quality or duration.',
                  zh: '按次计费的模型（例如许多图像和视频模型）按每次调用、每张图或每秒收取固定价格，并随尺寸、质量或时长调整。',
                },
                {
                  en: 'The group multiplier applies on top. The same model can cost different amounts in different groups; Model Square shows the final price per group.',
                  zh: '在此基础上再乘以分组倍率。同一模型在不同分组的价格可能不同，模型广场展示的是各分组的最终价格。',
                },
                {
                  en: 'Failed requests are not charged. If the gateway retried on another channel, only the successful attempt is billed.',
                  zh: '失败的请求不计费。网关换渠道重试时，只对最终成功的那次计费。',
                },
              ],
            },
          ],
        },
        {
          id: 'where-to-see',
          title: { en: 'Where to see your spending', zh: '在哪里查看消费' },
          blocks: [
            {
              type: 'bullets',
              items: [
                {
                  en: 'Usage Logs: one row per request with time, key, model, input and output tokens, cache tokens, duration and cost. Filter by key or model to see what an app spent.',
                  zh: '使用日志：每个请求一行，包含时间、密钥、模型、输入输出 token、缓存 token、耗时和费用。按密钥或模型筛选，即可查看某个软件的消费。',
                },
                {
                  en: 'Task Logs: image and video tasks with their status and charges.',
                  zh: '任务日志：图像和视频任务的状态与扣费。',
                },
                {
                  en: 'Dashboard: spending and request trends over time.',
                  zh: '数据看板：消费与请求量的趋势。',
                },
                {
                  en: 'Wallet: current balance, top-up, redemption codes and purchase history.',
                  zh: '钱包：当前余额、充值、兑换码与购买记录。',
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
                { to: '/wallet', text: { en: 'Open Wallet', zh: '打开钱包' } },
                {
                  to: '/pricing',
                  text: { en: 'Open Model Square', zh: '打开模型广场' },
                },
              ],
            },
          ],
        },
        {
          id: 'balance',
          title: { en: 'Top-up and redemption', zh: '充值与兑换' },
          blocks: [
            {
              type: 'steps',
              items: [
                {
                  en: 'Open Wallet, paste the complete redemption code without spaces and select Redeem.',
                  zh: '打开“钱包”，粘贴完整兑换码（去掉前后空格），点击“兑换”。',
                },
                {
                  en: 'Refresh the balance. If the code is invalid, check it was copied fully; a used code cannot be redeemed again.',
                  zh: '刷新余额。提示无效时检查是否复制完整；已使用的兑换码不能重复兑换。',
                },
                {
                  en: 'If redemption succeeds but the balance does not change after a refresh, open a ticket with your account and the approximate time.',
                  zh: '如果显示兑换成功但刷新后余额仍未变化，请提交工单，并提供账号和大致时间。',
                },
              ],
            },
            {
              type: 'appLinks',
              items: [
                {
                  to: '/tickets',
                  text: { en: 'Open a ticket', zh: '提交工单' },
                },
              ],
            },
          ],
        },
      ],
    },
  ]
}
