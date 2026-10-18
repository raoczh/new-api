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
import { api } from '@/lib/api'

export interface PolishPromptPayload {
  model: string
  group: string
  prompt: string
}

interface ChatCompletionResult {
  choices?: Array<{ message?: { content?: string } }>
}

const POLISH_SYSTEM_PROMPT = [
  'You rewrite short image-generation prompts into a single, vivid English prompt.',
  'Keep every concrete detail the user gave (subject, colors, text, numbers, style).',
  'Add only visual qualities such as composition, lighting, lens, mood and rendering.',
  'Never add camera brands, artist names, or copyrighted characters.',
  'Reply with the prompt only: no quotes, no preface, no bullet points, under 120 words.',
].join(' ')

/**
 * Rewrite the prompt with the model the user configured in their profile.
 *
 * This goes through the playground completion route on purpose: it authenticates
 * with the user session instead of an API key, charges the account normally and
 * writes the usual consume log, so an enhancement is billed exactly like any
 * other request the user makes.
 */
export async function polishPrompt(
  payload: PolishPromptPayload,
  signal?: AbortSignal
): Promise<string> {
  const res = await api.post(
    '/pg/chat/completions',
    {
      model: payload.model,
      group: payload.group,
      stream: false,
      temperature: 0.7,
      messages: [
        { role: 'system', content: POLISH_SYSTEM_PROMPT },
        { role: 'user', content: payload.prompt },
      ],
    },
    { signal }
  )

  const data = res.data as ChatCompletionResult | undefined
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('The model returned an empty prompt.')
  }
  // Models occasionally wrap the answer in quotes even when told not to.
  return content.replace(/^["'“”]+|["'“”]+$/g, '').trim()
}
