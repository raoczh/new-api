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

import {
  CHANNEL_STATUS_OPTIONS,
  isChannelStatusFilterValue,
} from '../../constants'

describe('channel status filter values', () => {
  test('offers the automatically disabled channels as their own filter', () => {
    expect(
      CHANNEL_STATUS_OPTIONS.some((option) => option.value === 'auto_disabled')
    ).toBe(true)
  })

  test('accepts every offered value', () => {
    for (const option of CHANNEL_STATUS_OPTIONS) {
      expect(isChannelStatusFilterValue(option.value)).toBe(true)
    }
  })

  test('rejects a remembered value the filter no longer offers', () => {
    expect(isChannelStatusFilterValue('retired_status')).toBe(false)
    expect(isChannelStatusFilterValue(null)).toBe(false)
  })
})
