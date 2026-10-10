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
import type { QuotaDataItem } from '@/features/dashboard/types'

/**
 * Safe division: handles NaN and Infinity cases
 */
export function safeDivide(
  value: number,
  divisor: number,
  precision: number = 3
): number {
  const result = value / divisor
  if (isNaN(result) || !isFinite(result)) return 0
  const factor = Math.pow(10, precision)
  return Math.round(result * factor) / factor
}

/**
 * Cache reads over all prompt tokens (uncached input + cache writes + cache
 * reads). Dividing by cache traffic alone would pin providers that never
 * report cache writes, such as OpenAI/Codex, at 100%. `null` means there were
 * no prompt tokens, which is different from a 0% hit rate.
 */
export function getCacheHitRate(usage: {
  input: number
  cacheCreation: number
  cacheRead: number
}): number | null {
  const total = usage.input + usage.cacheCreation + usage.cacheRead
  if (total === 0) return null
  return (usage.cacheRead / total) * 100
}

/**
 * Calculate aggregated statistics from quota data
 */
export function calculateDashboardStats(data: QuotaDataItem[]) {
  return data.reduce(
    (acc, item) => ({
      totalQuota: acc.totalQuota + (Number(item.quota) || 0),
      totalCount: acc.totalCount + (Number(item.count) || 0),
      totalTokens: acc.totalTokens + (Number(item.token_used) || 0),
    }),
    { totalQuota: 0, totalCount: 0, totalTokens: 0 }
  )
}
