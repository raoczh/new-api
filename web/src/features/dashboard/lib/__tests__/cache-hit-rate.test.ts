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

import { getCacheHitRate } from '../stats'

describe('getCacheHitRate', () => {
  test('usage without cache writes divides reads by all prompt tokens', () => {
    // Codex/OpenAI never reports cache writes; the rate must not be 100%.
    expect(
      getCacheHitRate({ input: 300, cacheCreation: 0, cacheRead: 700 })
    ).toBe(70)
  })

  test('usage with cache writes counts them as prompt tokens', () => {
    expect(
      getCacheHitRate({ input: 100, cacheCreation: 100, cacheRead: 800 })
    ).toBe(80)
  })

  test('no prompt tokens returns null instead of 0%', () => {
    expect(
      getCacheHitRate({ input: 0, cacheCreation: 0, cacheRead: 0 })
    ).toBeNull()
  })
})
