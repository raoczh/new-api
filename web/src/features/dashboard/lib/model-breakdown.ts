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
import type { PerfModelSummary } from '@/features/performance-metrics/types'

import type { QuotaDataItem } from '../types'

export interface ModelBreakdownRow {
  model: string
  requests: number
  tokens: number
  cacheTokens: number
  cost: number
  costShare: number
  successRate?: number
  avgLatencyMs?: number
}

const DEFAULT_LIMIT = 10

/**
 * Aggregate raw quota rows into the model-level table that replaces the two
 * redundant dashboard charts. Rows are ordered by spend so the table answers
 * "which model costs the most" first; performance data is joined by name when
 * available.
 */
export function buildModelBreakdownRows(
  data: QuotaDataItem[],
  performance: PerfModelSummary[] = [],
  limit = DEFAULT_LIMIT
): ModelBreakdownRow[] {
  const totals = new Map<
    string,
    {
      requests: number
      tokens: number
      cacheTokens: number
      cost: number
    }
  >()

  for (const item of data) {
    const model = item.model_name?.trim() || 'Unknown'
    const current = totals.get(model) ?? {
      requests: 0,
      tokens: 0,
      cacheTokens: 0,
      cost: 0,
    }
    current.requests += Number(item.count) || 0
    current.tokens += Number(item.token_used) || 0
    current.cacheTokens +=
      (Number(item.cache_read_tokens) || 0) +
      (Number(item.cache_creation_tokens) || 0)
    current.cost += Number(item.quota) || 0
    totals.set(model, current)
  }

  const totalCost = [...totals.values()].reduce(
    (sum, item) => sum + item.cost,
    0
  )
  const performanceByName = new Map(
    performance.map((item) => [item.model_name, item])
  )

  return [...totals.entries()]
    .map(([model, item]) => {
      const perf = performanceByName.get(model)
      return {
        model,
        requests: item.requests,
        tokens: item.tokens,
        cacheTokens: item.cacheTokens,
        cost: item.cost,
        costShare: totalCost > 0 ? item.cost / totalCost : 0,
        successRate: perf?.success_rate,
        avgLatencyMs: perf?.avg_latency_ms,
      } satisfies ModelBreakdownRow
    })
    .sort((a, b) => b.cost - a.cost || b.requests - a.requests)
    .slice(0, Math.max(1, limit))
}
