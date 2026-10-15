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

export function buildApiReferencePages(urls: DocUrls): DocPage[] {
  const { site, api } = urls

  return [
    {
      slug: 'api/index',
      title: { en: 'Compatible protocols', zh: 'API 兼容协议' },
      summary: {
        en: 'Every endpoint the gateway exposes and which protocol each belongs to.',
        zh: '网关提供的全部接口，以及它们分别属于哪种协议。',
      },
      sections: [
        {
          id: 'endpoints',
          title: { en: 'Endpoints', zh: '接口一览' },
          blocks: [
            {
              type: 'table',
              head: [
                { en: 'Endpoint', zh: '接口' },
                { en: 'Purpose', zh: '用途' },
              ],
              rows: [
                [
                  both('GET /v1/models'),
                  {
                    en: 'Models available to this key',
                    zh: '当前密钥可用的模型',
                  },
                ],
                [
                  both('POST /v1/chat/completions'),
                  { en: 'OpenAI chat completions', zh: 'OpenAI 对话补全' },
                ],
                [
                  both('POST /v1/responses'),
                  {
                    en: 'OpenAI Responses API (used by Codex)',
                    zh: 'OpenAI Responses 接口（Codex 使用）',
                  },
                ],
                [
                  both('POST /v1/messages'),
                  {
                    en: 'Anthropic Messages API (used by Claude Code)',
                    zh: 'Anthropic Messages 接口（Claude Code 使用）',
                  },
                ],
                [
                  both('POST /v1beta/models/{model}:generateContent'),
                  {
                    en: 'Gemini native, non-streaming',
                    zh: 'Gemini 原生，非流式',
                  },
                ],
                [
                  both('POST /v1beta/models/{model}:streamGenerateContent'),
                  { en: 'Gemini native, streaming', zh: 'Gemini 原生，流式' },
                ],
                [
                  both('POST /v1/embeddings'),
                  { en: 'Text embeddings', zh: '文本向量' },
                ],
                [both('POST /v1/rerank'), { en: 'Rerank', zh: '重排序' }],
                [
                  both('POST /v1/images/generations, /v1/images/edits'),
                  { en: 'Image generation and editing', zh: '图像生成与编辑' },
                ],
                [
                  both('POST /v1/audio/speech, /transcriptions, /translations'),
                  {
                    en: 'Text to speech and speech to text',
                    zh: '语音合成与语音识别',
                  },
                ],
                [
                  both('POST /v1/videos, GET /v1/videos/{id}'),
                  { en: 'Video generation tasks', zh: '视频生成任务' },
                ],
                [
                  both('POST /v1/moderations'),
                  { en: 'Content moderation', zh: '内容审核' },
                ],
              ],
            },
            {
              type: 'note',
              text: {
                en: 'Which endpoints a model supports is listed under “Endpoint type” in Model Square. Files and fine-tuning endpoints are not available.',
                zh: '每个模型支持哪些接口，以模型广场中的“端点类型”为准。文件和微调相关接口不可用。',
              },
            },
          ],
        },
        {
          id: 'conversion',
          title: { en: 'Protocol conversion', zh: '协议转换' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'The gateway converts between OpenAI chat, Responses, Anthropic Messages and Gemini where the upstream model allows it. That is why Claude Code can run on many non-Claude models and chat apps can use Claude models. Features with no equivalent in the target protocol may be dropped, so test the features you depend on.',
                zh: '在上游模型允许的情况下，网关会在 OpenAI 对话、Responses、Anthropic Messages 和 Gemini 之间做协议转换。因此 Claude Code 可以使用很多非 Claude 模型，聊天软件也可以使用 Claude 模型。目标协议中没有对应能力的特性可能会被忽略，请对依赖的功能单独测试。',
              },
            },
          ],
        },
      ],
    },
    {
      slug: 'api/authentication',
      title: { en: 'Authentication', zh: '鉴权' },
      summary: {
        en: 'Which header carries the key for each protocol.',
        zh: '各协议用哪个请求头携带密钥。',
      },
      sections: [
        {
          id: 'headers',
          title: { en: 'Accepted headers', zh: '支持的请求头' },
          blocks: [
            {
              type: 'table',
              head: [
                { en: 'Header', zh: '请求头' },
                { en: 'Where it works', zh: '适用范围' },
              ],
              rows: [
                [
                  both('Authorization: Bearer sk-YOUR-KEY'),
                  { en: 'Every endpoint', zh: '所有接口' },
                ],
                [
                  both('x-api-key: sk-YOUR-KEY'),
                  {
                    en: '/v1/messages and /v1/models (Anthropic style)',
                    zh: '/v1/messages 与 /v1/models（Anthropic 风格）',
                  },
                ],
                [
                  both('x-goog-api-key: sk-YOUR-KEY'),
                  {
                    en: '/v1beta/models/* (Gemini style)',
                    zh: '/v1beta/models/*（Gemini 风格）',
                  },
                ],
                [
                  both('?key=sk-YOUR-KEY'),
                  {
                    en: 'Gemini endpoints only; prefer a header',
                    zh: '仅 Gemini 接口，建议优先使用请求头',
                  },
                ],
              ],
            },
            {
              type: 'p',
              text: {
                en: 'The sk- prefix is optional. Anthropic clients should also send `anthropic-version: 2023-06-01`; when /v1/models receives both x-api-key and anthropic-version, it answers in Anthropic’s list format.',
                zh: 'sk- 前缀可带可不带。Anthropic 客户端还应发送 `anthropic-version: 2023-06-01`；当 /v1/models 同时收到 x-api-key 和 anthropic-version 时，会以 Anthropic 的列表格式返回。',
              },
            },
          ],
        },
        {
          id: 'checks',
          title: {
            en: 'What is checked on every request',
            zh: '每次请求会校验什么',
          },
          blocks: [
            {
              type: 'bullets',
              items: [
                {
                  en: 'The key exists, is enabled, has not expired and has quota left.',
                  zh: '密钥存在、已启用、未过期且还有额度。',
                },
                {
                  en: 'The client IP is in the key’s IP whitelist, if one is set.',
                  zh: '如果设置了 IP 白名单，客户端 IP 必须在名单内。',
                },
                {
                  en: 'The key’s group is available to your account.',
                  zh: '密钥所选分组对你的账户可用。',
                },
                {
                  en: 'The requested model is allowed by the key’s model limits.',
                  zh: '请求的模型在密钥的模型限制范围内。',
                },
                {
                  en: 'The account has enough balance for the request.',
                  zh: '账户余额足够支付本次请求。',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'api/chat',
      title: {
        en: 'Chat Completions & Responses',
        zh: 'Chat Completions 与 Responses',
      },
      summary: {
        en: 'The OpenAI-compatible text endpoints.',
        zh: 'OpenAI 兼容的文本对话接口。',
      },
      sections: [
        {
          id: 'chat-completions',
          title: both('POST /v1/chat/completions'),
          blocks: [
            {
              type: 'p',
              text: {
                en: 'The most widely supported endpoint. Request and response bodies follow the OpenAI Chat Completions format.',
                zh: '兼容性最广的接口，请求和响应格式与 OpenAI Chat Completions 一致。',
              },
            },
            {
              type: 'tabs',
              samples: [
                {
                  label: 'curl',
                  code: `curl ${api}/chat/completions \\\n  -H "Authorization: Bearer sk-YOUR-KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "YOUR-MODEL-ID",\n    "messages": [\n      {"role": "system", "content": "You are a helpful assistant."},\n      {"role": "user", "content": "Hello"}\n    ]\n  }'`,
                },
                {
                  label: 'Python',
                  code: `from openai import OpenAI\n\nclient = OpenAI(api_key="sk-YOUR-KEY", base_url="${api}")\nreply = client.chat.completions.create(\n    model="YOUR-MODEL-ID",\n    messages=[{"role": "user", "content": "Hello"}],\n)\nprint(reply.choices[0].message.content)`,
                },
              ],
            },
          ],
        },
        {
          id: 'responses',
          title: both('POST /v1/responses'),
          blocks: [
            {
              type: 'p',
              text: {
                en: 'The newer OpenAI Responses API, required by Codex. GET /v1/responses also accepts WebSocket connections, and POST /v1/responses/compact is available for context compaction.',
                zh: '较新的 OpenAI Responses 接口，Codex 依赖它。GET /v1/responses 还支持 WebSocket 连接，POST /v1/responses/compact 可用于上下文压缩。',
              },
            },
            {
              type: 'tabs',
              samples: [
                {
                  label: 'curl',
                  code: `curl ${api}/responses \\\n  -H "Authorization: Bearer sk-YOUR-KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"YOUR-RESPONSES-MODEL-ID","input":"Hello"}'`,
                },
                {
                  label: 'Python',
                  code: `from openai import OpenAI\n\nclient = OpenAI(api_key="sk-YOUR-KEY", base_url="${api}")\nreply = client.responses.create(model="YOUR-RESPONSES-MODEL-ID", input="Hello")\nprint(reply.output_text)`,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'api/messages',
      title: { en: 'Messages API', zh: 'Messages API' },
      summary: {
        en: 'The Anthropic-compatible endpoint used by Claude Code and the Anthropic SDK.',
        zh: 'Claude Code 和 Anthropic SDK 使用的 Anthropic 兼容接口。',
      },
      sections: [
        {
          id: 'request',
          title: both('POST /v1/messages'),
          blocks: [
            {
              type: 'p',
              text: {
                en: `Set the SDK base URL to the site root, ${site}; the SDK adds /v1/messages. max_tokens is required by the protocol.`,
                zh: `SDK 的 base URL 设为站点根地址 ${site}，SDK 会自行拼接 /v1/messages。协议要求必须传 max_tokens。`,
              },
            },
            {
              type: 'tabs',
              samples: [
                {
                  label: 'curl',
                  code: `curl ${site}/v1/messages \\\n  -H "x-api-key: sk-YOUR-KEY" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"YOUR-CLAUDE-MODEL-ID","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'`,
                },
                {
                  label: 'Python',
                  code: `# pip install anthropic\nfrom anthropic import Anthropic\n\nclient = Anthropic(api_key="sk-YOUR-KEY", base_url="${site}")\nmessage = client.messages.create(\n    model="YOUR-CLAUDE-MODEL-ID",\n    max_tokens=1024,\n    messages=[{"role": "user", "content": "Hello"}],\n)\nprint(message.content[0].text)`,
                },
                {
                  label: 'Node.js',
                  code: `// npm install @anthropic-ai/sdk\nimport Anthropic from '@anthropic-ai/sdk'\n\nconst client = new Anthropic({ apiKey: 'sk-YOUR-KEY', baseURL: '${site}' })\nconst message = await client.messages.create({\n  model: 'YOUR-CLAUDE-MODEL-ID',\n  max_tokens: 1024,\n  messages: [{ role: 'user', content: 'Hello' }],\n})\nconsole.log(message.content[0].text)`,
                },
              ],
            },
            {
              type: 'note',
              text: {
                en: '/v1/messages/count_tokens is not available. Clients that call it fall back to local estimates.',
                zh: '/v1/messages/count_tokens 暂不可用，调用它的客户端会退回本地估算。',
              },
            },
          ],
        },
      ],
    },
    {
      slug: 'api/gemini',
      title: { en: 'Gemini API', zh: 'Gemini API' },
      summary: {
        en: 'The native Gemini endpoints for the Google GenAI SDK and Gemini CLI.',
        zh: '供 Google GenAI SDK 和 Gemini CLI 使用的 Gemini 原生接口。',
      },
      sections: [
        {
          id: 'generate',
          title: both('POST /v1beta/models/{model}:generateContent'),
          blocks: [
            {
              type: 'tabs',
              samples: [
                {
                  label: 'curl',
                  code: `curl "${site}/v1beta/models/YOUR-GEMINI-MODEL-ID:generateContent" \\\n  -H "x-goog-api-key: sk-YOUR-KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'`,
                },
                {
                  label: 'Python',
                  code: `# pip install google-genai\nfrom google import genai\nfrom google.genai import types\n\nclient = genai.Client(\n    api_key="sk-YOUR-KEY",\n    http_options=types.HttpOptions(base_url="${site}"),\n)\nreply = client.models.generate_content(model="YOUR-GEMINI-MODEL-ID", contents="Hello")\nprint(reply.text)`,
                },
              ],
            },
            {
              type: 'p',
              text: {
                en: 'For streaming, call `:streamGenerateContent?alt=sse`. GET /v1beta/models lists models in Gemini format. `:countTokens` is not available.',
                zh: '流式输出请调用 `:streamGenerateContent?alt=sse`。GET /v1beta/models 以 Gemini 格式返回模型列表。`:countTokens` 暂不可用。',
              },
            },
          ],
        },
      ],
    },
    {
      slug: 'api/media',
      title: { en: 'Images, audio and video', zh: '图像、音频与视频' },
      summary: {
        en: 'Image generation, speech and asynchronous video tasks.',
        zh: '图像生成、语音以及异步视频任务。',
      },
      sections: [
        {
          id: 'images',
          title: { en: 'Images', zh: '图像' },
          blocks: [
            {
              type: 'code',
              code: `curl ${api}/images/generations \\\n  -H "Authorization: Bearer sk-YOUR-KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"YOUR-IMAGE-MODEL-ID","prompt":"a lighthouse at dawn","n":1,"size":"1024x1024"}'`,
            },
            {
              type: 'p',
              text: {
                en: 'Image models are usually billed per image, and size, quality and n change the price. Check the model’s price examples in Model Square before generating in bulk. Editing uses POST /v1/images/edits with multipart form data.',
                zh: '图像模型通常按张计费，尺寸、质量和 n 都会影响价格。批量生成前请先在模型广场查看该模型的价格示例。图像编辑使用 POST /v1/images/edits，以 multipart 表单提交。',
              },
            },
          ],
        },
        {
          id: 'audio',
          title: { en: 'Audio', zh: '音频' },
          blocks: [
            {
              type: 'code',
              code: `curl ${api}/audio/speech \\\n  -H "Authorization: Bearer sk-YOUR-KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"YOUR-TTS-MODEL-ID","input":"Hello","voice":"alloy"}' \\\n  --output speech.mp3`,
            },
            {
              type: 'p',
              text: {
                en: 'Speech to text uses POST /v1/audio/transcriptions (or /translations) with a multipart file upload.',
                zh: '语音识别使用 POST /v1/audio/transcriptions（或 /translations），以 multipart 上传音频文件。',
              },
            },
          ],
        },
        {
          id: 'video',
          title: { en: 'Video tasks', zh: '视频任务' },
          blocks: [
            {
              type: 'steps',
              items: [
                {
                  en: 'Create a task with POST /v1/videos. The response contains a task id.',
                  zh: '用 POST /v1/videos 创建任务，响应中包含任务 id。',
                },
                {
                  en: 'Poll GET /v1/videos/{id} until the status is completed or failed.',
                  zh: '轮询 GET /v1/videos/{id}，直到状态变为完成或失败。',
                },
                {
                  en: 'Download the result from GET /v1/videos/{id}/content.',
                  zh: '通过 GET /v1/videos/{id}/content 下载结果。',
                },
              ],
            },
            {
              type: 'code',
              code: `curl ${api}/videos \\\n  -H "Authorization: Bearer sk-YOUR-KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"YOUR-VIDEO-MODEL-ID","prompt":"waves on a beach","seconds":"5"}'\n\ncurl ${api}/videos/TASK-ID -H "Authorization: Bearer sk-YOUR-KEY"`,
            },
            {
              type: 'p',
              text: {
                en: 'Video is billed by duration or resolution, and parameters differ between models. Task status and charges appear under Task Logs in the console; failed tasks are refunded.',
                zh: '视频按时长或分辨率计费，不同模型的参数可能不同。任务状态和扣费记录可在控制台“任务日志”中查看，失败的任务会退还费用。',
              },
            },
          ],
        },
      ],
    },
    {
      slug: 'api/models',
      title: { en: 'Model list', zh: '模型列表' },
      summary: {
        en: 'List the models a key can call.',
        zh: '列出密钥可以调用的模型。',
      },
      sections: [
        {
          id: 'list',
          title: both('GET /v1/models'),
          blocks: [
            {
              type: 'code',
              code: `curl ${api}/models -H "Authorization: Bearer sk-YOUR-KEY"`,
            },
            {
              type: 'bullets',
              items: [
                {
                  en: 'The list contains only models available in the key’s group and, if model limits are set, only the allowed ones.',
                  zh: '列表只包含密钥所在分组可用的模型；如果设置了模型限制，则只返回允许的模型。',
                },
                {
                  en: 'With headers x-api-key and anthropic-version the response uses Anthropic’s format; with x-goog-api-key, or at /v1beta/models, it uses Gemini’s format.',
                  zh: '带 x-api-key 和 anthropic-version 请求头时返回 Anthropic 格式；带 x-goog-api-key 或请求 /v1beta/models 时返回 Gemini 格式。',
                },
                {
                  en: 'GET /v1/models/{model} returns a single model.',
                  zh: 'GET /v1/models/{model} 返回单个模型的信息。',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'api/errors',
      title: { en: 'Error codes', zh: '错误码' },
      summary: {
        en: 'What each status code and error code means, and what to do about it.',
        zh: '各状态码与错误码的含义及处理方法。',
      },
      sections: [
        {
          id: 'format',
          title: { en: 'Error format', zh: '错误格式' },
          blocks: [
            {
              type: 'p',
              text: {
                en: 'OpenAI-style endpoints return an error object; /v1/messages wraps it in Anthropic’s format. Messages end with a request id; include it when you contact support.',
                zh: 'OpenAI 风格的接口返回 error 对象；/v1/messages 使用 Anthropic 格式包装。错误信息末尾带有 request id，联系支持时请一并提供。',
              },
            },
            {
              type: 'tabs',
              samples: [
                {
                  label: 'OpenAI',
                  code: '{\n  "error": {\n    "message": "Invalid token (request id: 2026...)",\n    "type": "new_api_error",\n    "code": ""\n  }\n}',
                },
                {
                  label: 'Anthropic',
                  code: '{\n  "type": "error",\n  "error": {\n    "type": "insufficient_user_quota",\n    "message": "..."\n  }\n}',
                },
              ],
            },
          ],
        },
        {
          id: 'status-codes',
          title: { en: 'Status codes', zh: '状态码' },
          blocks: [
            {
              type: 'table',
              head: [
                { en: 'Status', zh: '状态码' },
                { en: 'Common cause', zh: '常见原因' },
                { en: 'What to do', zh: '处理方法' },
              ],
              rows: [
                [
                  both('400'),
                  {
                    en: 'Malformed JSON, wrong field names, or a parameter the model does not support',
                    zh: 'JSON 格式错误、字段名不对，或模型不支持某个参数',
                  },
                  {
                    en: 'Retry with a minimal request without streaming or tools, then add features back one at a time',
                    zh: '先用不带流式和工具的最简请求测试，再逐项加回功能',
                  },
                ],
                [
                  both('401'),
                  {
                    en: 'The key is wrong, incomplete, disabled, expired or out of quota',
                    zh: '密钥错误、不完整、已停用、已过期或额度用完',
                  },
                  {
                    en: 'Copy the key again without spaces; check its status, expiry and quota on the API Keys page',
                    zh: '重新完整复制密钥（不带空格），在“API 密钥”页检查状态、有效期和额度',
                  },
                ],
                [
                  both('403'),
                  {
                    en: 'Insufficient balance, model not allowed by the key, group not available, IP not in whitelist, or account banned',
                    zh: '余额不足、密钥不允许该模型、分组不可用、IP 不在白名单或账户被封禁',
                  },
                  {
                    en: 'Read the message and the code table below; top up or adjust the key',
                    zh: '查看错误信息并对照下方错误码；充值或调整密钥设置',
                  },
                ],
                [
                  both('404'),
                  {
                    en: 'Wrong address: doubled or missing /v1, or an endpoint that does not exist',
                    zh: '地址错误：/v1 重复或缺失，或接口不存在',
                  },
                  {
                    en: 'Check the final URL your client sends; see the Base URL section on the Introduction page',
                    zh: '核对客户端最终请求的地址，参见“介绍”页的基础地址一节',
                  },
                ],
                [
                  both('413'),
                  { en: 'Request body too large', zh: '请求体过大' },
                  {
                    en: 'Shorten the conversation or attach fewer or smaller images',
                    zh: '缩短对话历史，或减少、压缩附件图片',
                  },
                ],
                [
                  both('429'),
                  {
                    en: 'Too many requests in a short time, or upstream rate limiting',
                    zh: '短时间内请求过多，或上游限流',
                  },
                  {
                    en: 'Slow down and retry with backoff; lower concurrency in batch tools',
                    zh: '降低频率并按退避策略重试；批量工具中调低并发',
                  },
                ],
                [
                  both('500 / 502 / 503 / 504'),
                  {
                    en: 'Upstream failure or no available channel for the model',
                    zh: '上游故障，或该模型暂无可用渠道',
                  },
                  {
                    en: 'Check Status Monitor, wait and retry, or use another model',
                    zh: '查看状态监控，稍后重试或换用其他模型',
                  },
                ],
                [
                  both('529 / overloaded'),
                  { en: 'The upstream model is busy', zh: '上游模型繁忙' },
                  {
                    en: 'Wait and retry, or choose another model',
                    zh: '稍后重试，或换用其他模型',
                  },
                ],
              ],
            },
          ],
        },
        {
          id: 'error-codes',
          title: { en: 'Error codes and messages', zh: '错误码与提示信息' },
          blocks: [
            {
              type: 'table',
              head: [
                { en: 'Code or message', zh: '错误码或提示' },
                { en: 'Meaning', zh: '含义' },
              ],
              rows: [
                [
                  { en: 'Invalid token', zh: '无效的令牌' },
                  {
                    en: '401. The key does not exist, is disabled, expired or its quota is used up.',
                    zh: '401。密钥不存在、已停用、已过期或额度已用完。',
                  },
                ],
                [
                  both('insufficient_user_quota'),
                  {
                    en: '403. The account balance or subscription quota is not enough for this request. Top up or redeem in Wallet.',
                    zh: '403。账户余额或订阅额度不足以支付本次请求，请在“钱包”中充值或兑换。',
                  },
                ],
                [
                  both('pre_consume_token_quota_failed'),
                  {
                    en: '403. The key’s own quota is not enough. Raise the key’s quota or make it unlimited.',
                    zh: '403。这把密钥自身的额度不足，请调高密钥额度或改为无限额度。',
                  },
                ],
                [
                  {
                    en: 'This token has no access to model …',
                    zh: '该令牌无权访问模型 …',
                  },
                  {
                    en: '403. The model is not in the key’s model limits.',
                    zh: '403。该模型不在密钥的模型限制列表中。',
                  },
                ],
                [
                  {
                    en: 'Your IP is not in the token’s allowed list',
                    zh: '您的 IP 不在令牌允许访问的列表中',
                  },
                  both('403 access_denied'),
                ],
                [
                  {
                    en: 'No access to group … / group … deprecated',
                    zh: '无权访问 … 分组 / 分组 … 已被弃用',
                  },
                  {
                    en: '403. Pick another group for the key.',
                    zh: '403。请为密钥换一个分组。',
                  },
                ],
                [
                  both('model_not_found'),
                  {
                    en: '503. No available channel for this model in the key’s group. Check the model ID and group, or try another model.',
                    zh: '503。密钥所在分组下该模型没有可用渠道。请核对模型 ID 和分组，或换用其他模型。',
                  },
                ],
                [
                  {
                    en: 'Request rate limit reached',
                    zh: '您已达到请求数限制',
                  },
                  {
                    en: '429. Too many requests within the configured window. Wait and retry.',
                    zh: '429。在限定时间窗口内请求过多，请稍后重试。',
                  },
                ],
                [
                  both('sensitive_words_detected'),
                  {
                    en: 'The request was blocked by content moderation.',
                    zh: '请求被内容审核拦截。',
                  },
                ],
                [
                  both('prompt_blocked'),
                  {
                    en: 'The upstream provider refused the prompt.',
                    zh: '上游服务商拒绝了该提示内容。',
                  },
                ],
              ],
            },
          ],
        },
      ],
    },
  ]
}
