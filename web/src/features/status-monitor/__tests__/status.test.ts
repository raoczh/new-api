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

import {
  buildHourlySlots,
  getGroupHealth,
  groupByVendor,
  matchesGroupSearch,
} from '../lib/status'
import type { GroupStatus } from '../types'

const HOUR_START = 1789387200

function makeGroup(overrides: Partial<GroupStatus>): GroupStatus {
  return {
    group: 'g',
    description: '',
    vendor_id: 0,
    summary: null,
    last_seen_ts: 0,
    hourly: [],
    models: [],
    ...overrides,
  }
}

const summary = {
  success_rate: 100,
  avg_ttft_ms: 0,
  avg_latency_ms: 0,
  avg_tps: 0,
}

describe('getGroupHealth', () => {
  it('returns pending when the group has no samples', () => {
    expect(getGroupHealth(makeGroup({}))).toBe('pending')
  })

  it('returns stale when samples exist only outside the 24 hourly cells', () => {
    expect(getGroupHealth(makeGroup({ summary }))).toBe('stale')
  })

  it('follows the latest hour so a recovered group shows operational', () => {
    const group = makeGroup({
      summary,
      hourly: [
        { ts: HOUR_START, success_rate: 10, avg_ttft_ms: 0, top_model: 'm' },
        {
          ts: HOUR_START + 3600,
          success_rate: 95,
          avg_ttft_ms: 0,
          top_model: 'm',
        },
      ],
    })
    expect(getGroupHealth(group)).toBe('operational')
  })

  it('maps a latest hour between 70% and 90% to degraded', () => {
    const group = makeGroup({
      summary,
      hourly: [
        { ts: HOUR_START, success_rate: 80, avg_ttft_ms: 0, top_model: 'm' },
      ],
    })
    expect(getGroupHealth(group)).toBe('degraded')
  })

  it('maps a latest hour below 70% to outage', () => {
    const group = makeGroup({
      summary,
      hourly: [
        { ts: HOUR_START, success_rate: 50, avg_ttft_ms: 0, top_model: 'm' },
      ],
    })
    expect(getGroupHealth(group)).toBe('outage')
  })
})

describe('buildHourlySlots', () => {
  it('returns 24 hourly slots with gaps left empty for hours without traffic', () => {
    const point = {
      ts: HOUR_START + 23 * 3600,
      success_rate: 100,
      avg_ttft_ms: 1,
      top_model: 'm',
    }
    const slots = buildHourlySlots(HOUR_START, [point])
    expect(slots).toHaveLength(24)
    expect(slots[0]).toEqual({ ts: HOUR_START, point: undefined })
    expect(slots[23].point).toBe(point)
  })
})

describe('groupByVendor', () => {
  const vendors = [
    { id: 1, name: 'OpenAI' },
    { id: 2, name: 'Claude' },
  ]

  it('puts larger vendors first, keeps group order, and unknown vendors last', () => {
    const sections = groupByVendor(
      [
        makeGroup({ group: 'orphan', vendor_id: 99 }),
        makeGroup({ group: 'claude', vendor_id: 2 }),
        makeGroup({ group: 'codex-b', vendor_id: 1 }),
        makeGroup({ group: 'codex-a', vendor_id: 1 }),
      ],
      vendors
    )
    expect(sections.map((s) => s.vendorId)).toEqual([1, 2, 0])
    expect(sections[0].groups.map((g) => g.group)).toEqual([
      'codex-b',
      'codex-a',
    ])
    expect(sections[2].vendor).toBeUndefined()
  })

  it('returns no sections for an empty group list', () => {
    expect(groupByVendor([], vendors)).toEqual([])
  })
})

describe('matchesGroupSearch', () => {
  const group = makeGroup({ group: 'codex-pro', description: 'Codex 纯血' })

  it('matches the group key or description case-insensitively', () => {
    expect(matchesGroupSearch(group, 'CODEX')).toBe(true)
    expect(matchesGroupSearch(group, '纯血')).toBe(true)
  })

  it('rejects groups that match neither field', () => {
    expect(matchesGroupSearch(group, 'claude')).toBe(false)
  })

  it('treats a blank query as a match', () => {
    expect(matchesGroupSearch(group, '  ')).toBe(true)
  })
})
