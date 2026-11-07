import type { TFunction } from 'i18next'

export type ImageApiEndpointId = 'gemini' | 'chat' | 'edits' | 'generations'
export type ImageApiSampleLanguage = 'curl' | 'javascript' | 'python'

export interface ImageApiField {
  name: string
  type: string
  required?: boolean
  description: string
}

/** A copyable request: a JSON body, or multipart fields where `@file` uploads. */
export interface ImageApiExample {
  id: string
  label: string
  json?: Record<string, unknown>
  form?: Array<[string, string]>
}

export interface ImageApiEndpoint {
  id: ImageApiEndpointId
  group: string
  title: string
  summary: string
  path: string
  /** Value substituted for `{model}` in the sample URL. */
  pathModel?: string
  pathParams?: ImageApiField[]
  contentType: 'application/json' | 'multipart/form-data'
  requestFields: ImageApiField[]
  responseFields: ImageApiField[]
  examples: ImageApiExample[]
  response: unknown
}

/** Models from the gpt-image-2 series with their optional capabilities. */
export const GPT_IMAGE_CAPABILITY_ROWS = [
  {
    models: 'gpt-image-2',
    qualities: 'auto, low, medium, high',
    formats: 'png, jpeg, webp, svg',
  },
  {
    models: 'gpt-image-2.5, gpt-image-2.5-flare, gpt-image-2.5-sunburst',
    qualities: 'auto, low, medium, high, xhigh, max',
    formats: 'png, jpeg, webp, svg',
  },
  {
    models: 'gpt-image-2.6, gpt-image-2.6-flare, gpt-image-2.6-sunburst',
    qualities: 'auto, low, medium, high, xhigh, max',
    formats: 'png, jpeg, webp, svg, gif',
  },
] as const

const IMAGE_PROMPT = 'A blue bird on a branch, watercolor'

/**
 * The public endpoints usable from the drawing page's models. Field lists are
 * the gateway contract; whether a model honors an option is up to the model.
 */
export function buildImageApiEndpoints(t: TFunction): ImageApiEndpoint[] {
  const imageOptions = (): ImageApiField[] => [
    {
      name: 'n',
      type: 'integer',
      description: t(
        'Number of images, 1 by default. gpt-image-2 and later models generate one image per request.'
      ),
    },
    {
      name: 'size',
      type: 'string',
      description: t(
        'Output size in pixels, written as width x height with a lowercase x, such as 1024x1024 or 1536x1024. auto lets the model choose.'
      ),
    },
    {
      name: 'resolution',
      type: 'string',
      description: t(
        'Resolution tier: 1k, 2k or 4k. Together with aspect_ratio it takes precedence over size on channels that support it.'
      ),
    },
    {
      name: 'aspect_ratio',
      type: 'string',
      description: t(
        'Aspect ratio used with resolution, such as 1:1, 3:2, 4:3, 16:9 or 21:9.'
      ),
    },
    {
      name: 'quality',
      type: 'string',
      description: t(
        'Image quality: auto, low, medium or high. gpt-image-2.5 and gpt-image-2.6 also accept xhigh and max.'
      ),
    },
    {
      name: 'output_format',
      type: 'string',
      description: t(
        'Output file format: png, jpeg or webp. gpt-image-2 and later also output svg, and gpt-image-2.6 also outputs animated gif.'
      ),
    },
    {
      name: 'output_compression',
      type: 'integer',
      description: t('Compression from 0 to 100, only with jpeg or webp.'),
    },
    {
      name: 'frame_count',
      type: 'integer',
      description: t(
        'GIF only: number of frames, from 2 to 16. Omit it to let the model choose.'
      ),
    },
    {
      name: 'frame_duration_ms',
      type: 'integer',
      description: t(
        'GIF only: duration of each frame, from 20 to 655350 ms, rounded to 10 ms.'
      ),
    },
    {
      name: 'response_format',
      type: 'string',
      description: t(
        'url or b64_json. Some models return only URLs; read whichever field is present.'
      ),
    },
    {
      name: 'stream',
      type: 'boolean',
      description: t(
        'Stream SSE events where the model supports it. Not available with GIF output.'
      ),
    },
  ]
  const imageResponseFields: ImageApiField[] = [
    {
      name: 'created',
      type: 'integer',
      required: true,
      description: t('Unix timestamp of the response.'),
    },
    {
      name: 'data',
      type: 'array<object>',
      required: true,
      description: t(
        'Generated images. Read data[].url or data[].b64_json; revised_prompt is optional.'
      ),
    },
    {
      name: 'usage',
      type: 'object',
      description: t('Token usage, present when the upstream reports it.'),
    },
  ]
  const imageResponse = {
    created: 1781261901,
    data: [{ url: 'https://media.example.com/result.png' }],
    usage: {
      total_tokens: 1290,
      input_tokens: 50,
      output_tokens: 1240,
      input_tokens_details: { text_tokens: 50, image_tokens: 0 },
    },
  }
  const geminiGroup = t('Native Gemini format')
  const openAIGroup = t('Native OpenAI format')

  return [
    {
      id: 'gemini',
      group: geminiGroup,
      title: t('Gemini native format'),
      summary: t(
        'Generate images with the Gemini generateContent protocol, using a model that can output images.'
      ),
      path: '/v1beta/models/{model}:generateContent',
      pathModel: 'gemini-3-pro-image-preview',
      pathParams: [
        {
          name: 'model',
          type: 'string',
          required: true,
          description: t('Model name'),
        },
      ],
      contentType: 'application/json',
      requestFields: [
        {
          name: 'contents',
          type: 'array<object>',
          required: true,
          description: t(
            'Conversation content. Put the prompt in parts[].text; add reference images as parts[].inline_data with Base64 data.'
          ),
        },
        {
          name: 'generationConfig',
          type: 'object',
          required: true,
          description: t(
            'Generation settings. responseModalities must include IMAGE; imageConfig.aspectRatio (such as 16:9) and imageConfig.imageSize (1K, 2K or 4K) set the output shape.'
          ),
        },
      ],
      responseFields: [
        {
          name: 'candidates',
          type: 'array<object>',
          description: t(
            'Generated content. Images are in content.parts[].inlineData as a mimeType and Base64 data; text parts may accompany them.'
          ),
        },
        {
          name: 'usageMetadata',
          type: 'object',
          description: t(
            'Token usage: promptTokenCount, candidatesTokenCount and totalTokenCount.'
          ),
        },
      ],
      examples: [
        {
          id: 'basic',
          label: t('Basic'),
          json: {
            contents: [{ role: 'user', parts: [{ text: IMAGE_PROMPT }] }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
              imageConfig: { aspectRatio: '16:9', imageSize: '2K' },
            },
          },
        },
      ],
      response: {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  inlineData: { mimeType: 'image/png', data: 'BASE64_IMAGE' },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 12,
          candidatesTokenCount: 1290,
          totalTokenCount: 1302,
        },
      },
    },
    {
      id: 'chat',
      group: geminiGroup,
      title: t('OpenAI chat format'),
      summary: t(
        'Generate images through the chat completions protocol with an image-capable model.'
      ),
      path: '/v1/chat/completions',
      contentType: 'application/json',
      requestFields: [
        {
          name: 'model',
          type: 'string',
          required: true,
          description: t('Image-capable model name.'),
        },
        {
          name: 'stream',
          type: 'boolean',
          description: t(
            'Whether to stream the response as SSE. Defaults to false.'
          ),
        },
        {
          name: 'messages',
          type: 'array<object>',
          required: true,
          description: t(
            'Conversation messages. Put the prompt in a user message; add reference images as image_url content parts.'
          ),
        },
        {
          name: 'extra_body',
          type: 'object',
          description: t(
            'Provider-specific options. The OpenAI SDKs merge extra_body into the request; with raw HTTP, send these fields at the top level.'
          ),
        },
      ],
      responseFields: [
        {
          name: 'id',
          type: 'string',
          required: true,
          description: t('Response ID.'),
        },
        {
          name: 'model',
          type: 'string',
          required: true,
          description: t('Model name'),
        },
        {
          name: 'object',
          type: 'string',
          required: true,
          description: t('Always chat.completion.'),
        },
        {
          name: 'created',
          type: 'integer',
          required: true,
          description: t('Unix timestamp of the response.'),
        },
        {
          name: 'choices',
          type: 'array<object>',
          required: true,
          description: t(
            'Results. message.content holds the image as a Markdown image link or data URL, depending on the upstream.'
          ),
        },
        {
          name: 'usage',
          type: 'object',
          required: true,
          description: t(
            'Token usage: prompt_tokens, completion_tokens and total_tokens.'
          ),
        },
      ],
      examples: [
        {
          id: 'basic',
          label: t('Basic'),
          json: {
            model: 'gemini-3-pro-image-preview',
            stream: false,
            messages: [{ role: 'user', content: IMAGE_PROMPT }],
          },
        },
      ],
      response: {
        id: 'chatcmpl-123',
        model: 'gemini-3-pro-image-preview',
        object: 'chat.completion',
        created: 1781261901,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '![image](https://media.example.com/result.png)',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 1290,
          total_tokens: 1302,
        },
      },
    },
    {
      id: 'edits',
      group: openAIGroup,
      title: t('Edit images'),
      summary: t(
        'Create an edited or extended image from reference images and a prompt.'
      ),
      path: '/v1/images/edits',
      contentType: 'multipart/form-data',
      requestFields: [
        {
          name: 'image',
          type: 'file | string',
          required: true,
          description: t(
            'Reference image: a PNG, JPEG, WebP or GIF file, or an HTTP(S) URL sent as a text field. Repeat image[] for several references; the limit depends on the model.'
          ),
        },
        {
          name: 'mask',
          type: 'file | string',
          description: t(
            'Optional mask whose fully transparent area marks where to edit. It must match the first reference image in size and format.'
          ),
        },
        {
          name: 'prompt',
          type: 'string',
          required: true,
          description: t('Text description of the desired image.'),
        },
        {
          name: 'model',
          type: 'string',
          required: true,
          description: t('Image model name.'),
        },
        ...imageOptions(),
      ],
      responseFields: imageResponseFields,
      examples: [
        {
          id: 'basic',
          label: t('Basic'),
          form: [
            ['model', 'gpt-image-2.6'],
            ['prompt', 'Replace the background with a beach, keep the subject'],
            ['image', '@reference.png'],
            ['size', '1024x1024'],
            ['quality', 'high'],
          ],
        },
        {
          id: 'url',
          label: t('URL reference'),
          form: [
            ['model', 'gpt-image-2.6'],
            ['prompt', 'Replace the background with a beach, keep the subject'],
            ['image', 'https://media.example.com/reference.png'],
            ['mask', 'https://media.example.com/mask.png'],
            ['quality', 'xhigh'],
          ],
        },
        {
          id: 'gif',
          label: 'GIF',
          form: [
            ['model', 'gpt-image-2.6'],
            ['prompt', 'Make the bird flap its wings'],
            ['image', '@reference.png'],
            ['output_format', 'gif'],
            ['frame_count', '8'],
            ['frame_duration_ms', '100'],
          ],
        },
      ],
      response: imageResponse,
    },
    {
      id: 'generations',
      group: openAIGroup,
      title: t('Generate images'),
      summary: t('Create images from a text prompt.'),
      path: '/v1/images/generations',
      contentType: 'application/json',
      requestFields: [
        {
          name: 'model',
          type: 'string',
          required: true,
          description: t('Image model name.'),
        },
        {
          name: 'prompt',
          type: 'string',
          required: true,
          description: t(
            'Text description of the desired image. gpt-image models accept up to 32000 characters.'
          ),
        },
        ...imageOptions(),
        {
          name: 'background',
          type: 'string',
          description: t(
            'transparent, opaque or auto, for models that support it. Transparent output needs png or webp.'
          ),
        },
      ],
      responseFields: imageResponseFields,
      examples: [
        {
          id: 'basic',
          label: t('Basic'),
          json: {
            model: 'gpt-image-2.6',
            prompt: IMAGE_PROMPT,
            n: 1,
            size: '1024x1024',
            quality: 'high',
          },
        },
        {
          id: 'svg',
          label: 'SVG',
          json: {
            model: 'gpt-image-2.6',
            prompt: 'A minimal blue bird icon',
            size: '1024x1024',
            output_format: 'svg',
          },
        },
        {
          id: 'gif',
          label: 'GIF',
          json: {
            model: 'gpt-image-2.6',
            prompt: 'A blue bird flapping its wings among white clouds',
            output_format: 'gif',
            frame_count: 8,
            frame_duration_ms: 100,
          },
        },
      ],
      response: imageResponse,
    },
  ]
}

/** Sample code for one example; the key stays a placeholder, never a real token. */
export function buildImageApiSample(
  endpoint: ImageApiEndpoint,
  example: ImageApiExample,
  language: ImageApiSampleLanguage,
  baseUrl: string
): string {
  const url = `${baseUrl.replace(/\/+$/, '')}${endpoint.path.replace('{model}', endpoint.pathModel ?? 'MODEL')}`
  const form = example.form ?? []
  const json = JSON.stringify(example.json ?? {}, null, 2)

  if (language === 'curl') {
    const lines = [
      `curl -X POST "${url}" \\`,
      `  -H "Authorization: Bearer $API_KEY" \\`,
    ]
    if (example.form) {
      // --form-string keeps URL values literal; -F uploads @file values.
      const parts = form.map(([name, value]) =>
        value.startsWith('@')
          ? `  -F '${name}=${value}'`
          : `  --form-string '${name}=${value}'`
      )
      return [...lines, parts.join(' \\\n')].join('\n')
    }
    return [
      ...lines,
      `  -H "Content-Type: application/json" \\`,
      `  -d '${json.replaceAll("'", "'\\''")}'`,
    ].join('\n')
  }

  if (language === 'javascript') {
    if (example.form) {
      const appends = form.map(([name, value]) =>
        value.startsWith('@')
          ? `form.append('${name}', await openAsBlob('${value.slice(1)}'), '${value.slice(1)}')`
          : `form.append('${name}', '${value}')`
      )
      return [
        `import { openAsBlob } from 'node:fs'`,
        '',
        'const form = new FormData()',
        ...appends,
        '',
        `const response = await fetch('${url}', {`,
        `  method: 'POST',`,
        '  headers: { Authorization: `Bearer ${process.env.API_KEY}` },',
        '  body: form,',
        '})',
        'console.log(await response.json())',
      ].join('\n')
    }
    return [
      `const response = await fetch('${url}', {`,
      `  method: 'POST',`,
      '  headers: {',
      '    Authorization: `Bearer ${process.env.API_KEY}`,',
      `    'Content-Type': 'application/json',`,
      '  },',
      `  body: JSON.stringify(${json.replaceAll('\n', '\n  ')}),`,
      '})',
      'console.log(await response.json())',
    ].join('\n')
  }

  const header = [
    'import os',
    'import requests',
    '',
    `url = "${url}"`,
    'headers = {"Authorization": f"Bearer {os.environ[\'API_KEY\']}"}',
  ]
  if (example.form) {
    const files = form.filter(([, value]) => value.startsWith('@'))
    const data = form.filter(([, value]) => !value.startsWith('@'))
    return [
      ...header,
      'data = [',
      ...data.map(([name, value]) => `    ("${name}", "${value}"),`),
      ']',
      'files = [',
      ...files.map(
        ([name, value]) => `    ("${name}", open("${value.slice(1)}", "rb")),`
      ),
      ']',
      '',
      'response = requests.post(url, headers=headers, data=data, files=files)',
      'print(response.json())',
    ].join('\n')
  }
  return [
    ...header,
    `payload = ${pythonLiteral(json)}`,
    '',
    'response = requests.post(url, headers=headers, json=payload)',
    'print(response.json())',
  ].join('\n')
}

/** JSON is valid Python except for its boolean and null literals. */
function pythonLiteral(json: string): string {
  return json.replaceAll(/\b(true|false|null)\b/g, (literal) => {
    if (literal === 'true') return 'True'
    if (literal === 'false') return 'False'
    return 'None'
  })
}
