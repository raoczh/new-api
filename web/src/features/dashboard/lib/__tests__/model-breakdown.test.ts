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
import { expect, test } from 'vitest'

import type { QuotaDataItem } from '@/features/dashboard/types'
import type { PerfModelSummary } from '@/features/performance-metrics/types'

import { buildModelBreakdownRows } from '../model-breakdown'

const usage: QuotaDataItem[] = [
  {
    created_at: 0,
    model_name: 'gpt-4.1-mini',
    count: 10,
    token_used: 1_000,
    cache_read_tokens: 200,
    cache_creation_tokens: 50,
    quota: 2_000,
  },
  {
    created_at: 0,
    model_name: 'claude-sonnet',
    count: 2,
    token_used: 500,
    quota: 8_000,
  },
  {
    created_at: 0,
    model_name: 'gpt-4.1-mini',
    count: 5,
    token_used: 500,
    cache_read_tokens: 100,
    quota: 1_000,
  },
]

const performance: PerfModelSummary[] = [
  {
    model_name: 'claude-sonnet',
    success_rate: 99.5,
    avg_latency_ms: 1_200,
    avg_tps: 80,
  },
]

test('aggregates usage by model, orders by spend and joins performance by name', () => {
  const rows = buildModelBreakdownRows(usage, performance)

  expect(rows).toEqual([
    {
      model: 'claude-sonnet',
      requests: 2,
      tokens: 500,
      cacheTokens: 0,
      cost: 8_000,
      costShare: 8_000 / 11_000,
      successRate: 99.5,
      avgLatencyMs: 1_200,
    },
    {
      model: 'gpt-4.1-mini',
      requests: 15,
      tokens: 1_500,
      cacheTokens: 350,
      cost: 3_000,
      costShare: 3_000 / 11_000,
      successRate: undefined,
      avgLatencyMs: undefined,
    },
  ])
})

test('limits the table to the requested number of models', () => {
  expect(buildModelBreakdownRows(usage, performance, 1)).toHaveLength(1)
  expect(buildModelBreakdownRows(usage, performance, 1)[0].model).toBe(
    'claude-sonnet'
  )
})

test('uses a fallback model name and handles a zero-cost window', () => {
  const rows = buildModelBreakdownRows([
    { created_at: 1, count: 1, token_used: 10, quota: 0 },
  ])

  expect(rows[0]).toMatchObject({
    model: 'Unknown',
    requests: 1,
    tokens: 10,
    cost: 0,
    costShare: 0,
  })
})
