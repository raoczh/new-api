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
import { describe, expect, it } from 'vitest'

import { toGatewayOrigin } from '../hooks/use-gateway-facts'
import { buildCodeSample } from '../lib/code-samples'

const ORIGIN = 'https://api.example.com'

describe('toGatewayOrigin', () => {
  it.each([
    ['https://api.example.com', ORIGIN],
    ['https://api.example.com/', ORIGIN],
    ['https://api.example.com/v1', ORIGIN],
    [' https://api.example.com/v1/ ', ORIGIN],
  ])('normalizes %s', (input, expected) => {
    expect(toGatewayOrigin(input)).toBe(expected)
  })
})

describe('buildCodeSample', () => {
  it('points each protocol at its native endpoint', () => {
    expect(buildCodeSample('openai', 'curl', ORIGIN, 'gpt-x')).toContain(
      `${ORIGIN}/v1/chat/completions`
    )
    expect(buildCodeSample('claude', 'curl', ORIGIN, 'claude-x')).toContain(
      `${ORIGIN}/v1/messages`
    )
    expect(buildCodeSample('gemini', 'curl', ORIGIN, 'gemini-x')).toContain(
      `${ORIGIN}/v1beta/models/gemini-x:generateContent`
    )
  })

  it('uses the SDK base URL each client library expects', () => {
    expect(buildCodeSample('openai', 'python', ORIGIN, 'gpt-x')).toContain(
      `base_url="${ORIGIN}/v1"`
    )
    expect(buildCodeSample('claude', 'python', ORIGIN, 'claude-x')).toContain(
      `base_url="${ORIGIN}"`
    )
    expect(buildCodeSample('gemini', 'python', ORIGIN, 'gemini-x')).toContain(
      `"base_url": "${ORIGIN}"`
    )
  })

  it('never embeds a real key', () => {
    for (const family of ['openai', 'claude', 'gemini'] as const) {
      const sample = buildCodeSample(family, 'curl', ORIGIN, 'm')
      expect(sample).toContain('$API_KEY')
    }
  })
})
