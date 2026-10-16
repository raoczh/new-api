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
import { getSuccessRateLevel } from '@/features/performance-metrics/lib/format'

import { STATUS_MONITOR_HOURLY_CELLS } from '../constants'
import type { GroupHourPoint, GroupStatus, GroupStatusVendor } from '../types'

/**
 * Card-level health derived from the success rate:
 * - operational: >= 90%
 * - degraded: >= 70%
 * - outage: below 70%
 * - stale: had samples earlier in the window but none in the hourly cells
 * - pending: no samples at all
 */
export type GroupHealth =
  | 'operational'
  | 'degraded'
  | 'outage'
  | 'stale'
  | 'pending'

export const GROUP_HEALTH_CONFIG: Record<
  GroupHealth,
  { labelKey: string; dotClass: string; textClass: string }
> = {
  operational: {
    labelKey: 'Operational',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  degraded: {
    labelKey: 'Degraded',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  outage: {
    labelKey: 'Outage',
    dotClass: 'bg-red-500',
    textClass: 'text-red-600 dark:text-red-400',
  },
  stale: {
    labelKey: 'Observation expired',
    dotClass: 'bg-muted-foreground/50',
    textClass: 'text-muted-foreground',
  },
  pending: {
    labelKey: 'Awaiting observation',
    dotClass: 'bg-muted-foreground/50',
    textClass: 'text-muted-foreground',
  },
}

export function getRateHealth(rate: number): GroupHealth {
  const level = getSuccessRateLevel(rate)
  if (level === 'excellent' || level === 'good') return 'operational'
  if (level === 'warning') return 'degraded'
  if (level === 'critical') return 'outage'
  return 'pending'
}

/**
 * Health follows the latest observed hour so a recovered group is not shown
 * as degraded for the rest of the day.
 */
export function getGroupHealth(group: GroupStatus): GroupHealth {
  const latest = group.hourly.at(-1)
  if (latest) return getRateHealth(latest.success_rate)
  return group.summary ? 'stale' : 'pending'
}

export type VendorSection = {
  key?: string
  vendorId: number
  vendor: GroupStatusVendor | undefined
  groups: GroupStatus[]
}

/**
 * Keeps configured group order. Unassigned groups each get their own section.
 */
export function groupByVendor(
  groups: GroupStatus[],
  vendors: GroupStatusVendor[]
): VendorSection[] {
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]))
  const sections = new Map<string, VendorSection>()
  for (const group of groups) {
    const vendorId = vendorById.has(group.vendor_id) ? group.vendor_id : 0
    const key = vendorId ? `vendor:${vendorId}` : `group:${group.group}`
    let section = sections.get(key)
    if (!section) {
      section = { key, vendorId, vendor: vendorById.get(vendorId), groups: [] }
      sections.set(key, section)
    }
    section.groups.push(group)
  }
  return [...sections.values()]
}

export function matchesGroupSearch(group: GroupStatus, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    group.group.toLowerCase().includes(needle) ||
    group.description.toLowerCase().includes(needle)
  )
}

/**
 * Finer color grades for hourly cells, worst first. Steps at or above 90%
 * stay green, 70%-90% go yellow to orange, and below 70% are red, so the
 * scale refines GROUP_HEALTH_CONFIG without crossing its boundaries.
 */
export const HOUR_CELL_SCALE = [
  { min: 0, label: '<50%', className: 'bg-red-700' },
  { min: 50, label: '≥50%', className: 'bg-red-500' },
  { min: 70, label: '≥70%', className: 'bg-orange-500' },
  { min: 80, label: '≥80%', className: 'bg-amber-500' },
  { min: 85, label: '≥85%', className: 'bg-yellow-400' },
  { min: 90, label: '≥90%', className: 'bg-lime-400' },
  { min: 95, label: '≥95%', className: 'bg-lime-500' },
  { min: 97, label: '≥97%', className: 'bg-emerald-400' },
  { min: 99, label: '≥99%', className: 'bg-emerald-500' },
  { min: 100, label: '100%', className: 'bg-emerald-600' },
] as const

export function getHourCellClass(rate: number): string {
  let className: string = HOUR_CELL_SCALE[0].className
  for (const step of HOUR_CELL_SCALE) {
    if (rate >= step.min) className = step.className
  }
  return className
}

/** One slot per hour; slots without traffic stay undefined. */
export function buildHourlySlots(
  hourlyStart: number,
  points: GroupHourPoint[]
): { ts: number; point: GroupHourPoint | undefined }[] {
  const byHour = new Map(points.map((point) => [point.ts, point]))
  return Array.from({ length: STATUS_MONITOR_HOURLY_CELLS }, (_, slot) => {
    const ts = hourlyStart + slot * 3600
    return { ts, point: byHour.get(ts) }
  })
}
