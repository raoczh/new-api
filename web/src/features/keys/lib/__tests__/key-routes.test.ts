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
  groupKeyVendors,
  resolveVendorAutoRoute,
  routeToKeyGroups,
  suggestKeyName,
  UNASSIGNED_VENDOR_ID,
} from '../key-routes'

const vendors = [
  { id: 7, name: 'Anthropic', icon: 'Claude.Color', description: 'Writing' },
  { id: 3, name: 'OpenAI', icon: 'OpenAI' },
]

describe('grouping lines by model vendor', () => {
  test('lists each vendor once with its lines in the configured display order', () => {
    const choices = groupKeyVendors(
      {
        'gpt-a': { vendor_id: 3 },
        'claude-b': { vendor_id: 7 },
        'claude-a': { vendor_id: 7 },
      },
      vendors,
      ['claude-a', 'gpt-a', 'claude-b']
    )

    expect(choices.map((choice) => [choice.name, choice.groups])).toEqual([
      ['Anthropic', ['claude-a', 'claude-b']],
      ['OpenAI', ['gpt-a']],
    ])
    expect(choices[0].description).toBe('Writing')
  })

  test('collects lines without a vendor last and never offers the Auto entry as a line', () => {
    const choices = groupKeyVendors(
      {
        auto: {},
        default: {},
        'claude-a': { vendor_id: 7 },
        orphan: { vendor_id: 99 },
      },
      vendors,
      ['default', 'claude-a']
    )

    expect(choices.map((choice) => choice.id)).toEqual([
      7,
      UNASSIGNED_VENDOR_ID,
    ])
    expect(choices[1].groups).toEqual(['default', 'orphan'])
  })

  test('returns no choices when the account has no lines', () => {
    expect(groupKeyVendors({}, vendors, [])).toEqual([])
  })
})

describe('default lines of a vendor', () => {
  test('follows the administrator order and skips lines of other vendors', () => {
    expect(
      resolveVendorAutoRoute(
        ['claude-a', 'claude-b', 'claude-c'],
        ['gpt-a', 'claude-c', 'claude-a'],
        5
      )
    ).toEqual(['claude-c', 'claude-a'])
  })

  test('keeps at most the allowed number of lines', () => {
    expect(resolveVendorAutoRoute(['a', 'b', 'c'], ['a', 'b', 'c'], 2)).toEqual(
      ['a', 'b']
    )
  })

  test('falls back to the first line when the vendor is absent from the administrator order', () => {
    expect(
      resolveVendorAutoRoute(['claude-a', 'claude-b'], ['gpt-a'], 5)
    ).toEqual(['claude-a'])
    expect(resolveVendorAutoRoute([], ['gpt-a'], 5)).toEqual([])
  })
})

describe('storing the chosen lines on a key', () => {
  test('stores a single line as a plain group without cross-group retry', () => {
    expect(routeToKeyGroups(['claude-a'])).toEqual({
      group: 'claude-a',
      auto_groups_mode: 'inherit',
      auto_groups: [],
      cross_group_retry: false,
    })
  })

  test('stores several lines as an ordered Auto route that retries across them', () => {
    expect(routeToKeyGroups(['claude-b', 'claude-a'])).toEqual({
      group: 'auto',
      auto_groups_mode: 'custom',
      auto_groups: ['claude-b', 'claude-a'],
      cross_group_retry: true,
    })
  })
})

describe('default key name', () => {
  test('joins the vendor and the first line', () => {
    expect(suggestKeyName('OpenAI', 'gpt-a')).toBe('OpenAI-gpt-a')
    expect(suggestKeyName('', 'default')).toBe('default')
  })

  test('shortens a long name to the 50 bytes the server accepts without splitting a character', () => {
    const name = suggestKeyName('智谱', '高速稳定线路'.repeat(4))
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(50)
    expect(name.startsWith('智谱-高速稳定线路')).toBe(true)
    expect(name).not.toContain('�')
  })
})
