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
import type { SampleModelFamily } from '../hooks'

export type SampleLanguage = 'curl' | 'python'

export const SAMPLE_LANGUAGES: Record<SampleLanguage, string> = {
  curl: 'cURL',
  python: 'Python',
}

export const SAMPLE_HIGHLIGHT: Record<SampleLanguage, string> = {
  curl: 'bash',
  python: 'python',
}

/** Build a first-call sample for one protocol against this gateway. */
export function buildCodeSample(
  family: SampleModelFamily,
  language: SampleLanguage,
  origin: string,
  model: string
): string {
  if (family === 'claude') {
    return language === 'curl'
      ? [
          `curl ${origin}/v1/messages \\`,
          '  -H "x-api-key: $API_KEY" \\',
          '  -H "anthropic-version: 2023-06-01" \\',
          '  -H "content-type: application/json" \\',
          `  -d '{"model": "${model}", "max_tokens": 1024,`,
          `       "messages": [{"role": "user", "content": "Hello"}]}'`,
        ].join('\n')
      : [
          'from anthropic import Anthropic',
          '',
          `client = Anthropic(base_url="${origin}", api_key="sk-...")`,
          '',
          'message = client.messages.create(',
          `    model="${model}",`,
          '    max_tokens=1024,',
          '    messages=[{"role": "user", "content": "Hello"}],',
          ')',
          'print(message.content[0].text)',
        ].join('\n')
  }

  if (family === 'gemini') {
    return language === 'curl'
      ? [
          `curl "${origin}/v1beta/models/${model}:generateContent" \\`,
          '  -H "x-goog-api-key: $API_KEY" \\',
          '  -H "content-type: application/json" \\',
          `  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'`,
        ].join('\n')
      : [
          'from google import genai',
          '',
          'client = genai.Client(',
          '    api_key="sk-...",',
          `    http_options={"base_url": "${origin}"},`,
          ')',
          '',
          'response = client.models.generate_content(',
          `    model="${model}", contents="Hello"`,
          ')',
          'print(response.text)',
        ].join('\n')
  }

  return language === 'curl'
    ? [
        `curl ${origin}/v1/chat/completions \\`,
        '  -H "Authorization: Bearer $API_KEY" \\',
        '  -H "content-type: application/json" \\',
        `  -d '{"model": "${model}",`,
        `       "messages": [{"role": "user", "content": "Hello"}]}'`,
      ].join('\n')
    : [
        'from openai import OpenAI',
        '',
        `client = OpenAI(base_url="${origin}/v1", api_key="sk-...")`,
        '',
        'completion = client.chat.completions.create(',
        `    model="${model}",`,
        '    messages=[{"role": "user", "content": "Hello"}],',
        ')',
        'print(completion.choices[0].message.content)',
      ].join('\n')
}
