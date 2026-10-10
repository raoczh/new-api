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
import { describe, expect, test } from 'vitest'

import { getLogTokenUsage } from '../format'

describe('getLogTokenUsage', () => {
  test('OpenAI-semantic log subtracts cache read and write from prompt tokens', () => {
    const usage = getLogTokenUsage(
      { prompt_tokens: 1000, completion_tokens: 50 },
      { cache_tokens: 600, cache_creation_tokens: 100 }
    )
    expect(usage).toEqual({
      uncachedInput: 300,
      output: 50,
      cacheRead: 600,
      cacheWrite: 100,
    })
  })

  test('Anthropic-semantic log keeps prompt tokens as uncached input', () => {
    const usage = getLogTokenUsage(
      { prompt_tokens: 200, completion_tokens: 30 },
      { claude: true, cache_tokens: 400, cache_creation_tokens_5m: 60 }
    )
    expect(usage).toEqual({
      uncachedInput: 200,
      output: 30,
      cacheRead: 400,
      cacheWrite: 60,
    })
  })

  test('explicit OpenAI usage_semantic overrides the claude flag', () => {
    const usage = getLogTokenUsage(
      { prompt_tokens: 1000, completion_tokens: 0 },
      { claude: true, usage_semantic: 'openai', cache_tokens: 900 }
    )
    expect(usage.uncachedInput).toBe(100)
  })

  test('overlapping cache counts never produce negative uncached input', () => {
    const usage = getLogTokenUsage(
      { prompt_tokens: 100, completion_tokens: 0 },
      { cache_tokens: 90, cache_creation_tokens: 50 }
    )
    expect(usage.uncachedInput).toBe(0)
  })

  test('missing metadata keeps raw prompt tokens', () => {
    const usage = getLogTokenUsage(
      { prompt_tokens: 7, completion_tokens: 3 },
      null
    )
    expect(usage).toEqual({
      uncachedInput: 7,
      output: 3,
      cacheRead: 0,
      cacheWrite: 0,
    })
  })
})
