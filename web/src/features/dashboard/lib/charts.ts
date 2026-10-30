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
import type {
  QuotaDataItem,
  ProcessedUserChartData,
} from '@/features/dashboard/types'
import { getCurrencyDisplay } from '@/lib/currency'
import { formatChartTime, type TimeGranularity } from '@/lib/time'

type TFunction = (key: string) => string

// Keep chart series on the same calm indigo → violet → teal → amber → rose
// ramp as the interface tokens instead of VChart's default rainbow palette.
const DASHBOARD_CHART_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#14b8a6',
  '#f59e0b',
  '#f43f5e',
  '#0ea5e9',
  '#84cc16',
  '#f97316',
  '#64748b',
] as const

export function getDashboardChartColors(domainLength: number): string[] {
  if (domainLength <= 0) return []
  return Array.from(
    { length: domainLength },
    (_, index) => DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length]
  )
}

function renderQuotaCompat(rawQuota: number, digits = 4): string {
  const { config, meta } = getCurrencyDisplay()
  if (meta.kind === 'tokens') return rawQuota.toLocaleString()
  const usd = rawQuota / config.quotaPerUnit
  const rate = 'exchangeRate' in meta ? meta.exchangeRate : 1
  const symbol = 'symbol' in meta ? meta.symbol : '$'
  const value = usd * rate
  const fixed = value.toFixed(digits)
  if (Number.parseFloat(fixed) === 0 && rawQuota > 0 && value > 0) {
    return symbol + Math.pow(10, -digits).toFixed(digits)
  }
  return symbol + fixed
}

/**
 * Process per-user ranking and trend data
 */

const USER_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#14b8a6',
  '#f59e0b',
  '#f43f5e',
  '#0ea5e9',
  '#84cc16',
  '#f97316',
  '#64748b',
  '#a855f7',
]

export function processUserChartData(
  data: QuotaDataItem[],
  timeGranularity: TimeGranularity = 'day',
  t?: TFunction,
  limit = 10
): ProcessedUserChartData {
  const tt: TFunction = t ?? ((x) => x)
  const { config } = getCurrencyDisplay()
  const quotaPerUnit = config.quotaPerUnit

  const formatVal = (raw: number) => renderQuotaCompat(raw, 2)

  const emptyResult: ProcessedUserChartData = {
    spec_user_rank: {
      type: 'bar',
      data: [{ id: 'userRankData', values: [] }],
      xField: 'rawQuota',
      yField: 'User',
      seriesField: 'User',
      direction: 'horizontal',
      title: {
        visible: true,
        text: tt('User Consumption Ranking'),
        subtext: tt('No data available'),
      },
      legends: { visible: false },
      color: { type: 'ordinal', range: USER_COLORS },
      background: { fill: 'transparent' },
    },
    spec_user_trend: {
      type: 'area',
      data: [{ id: 'userTrendData', values: [] }],
      xField: 'Time',
      yField: 'rawQuota',
      seriesField: 'User',
      title: {
        visible: true,
        text: tt('User Consumption Trend'),
        subtext: tt('No data available'),
      },
      legends: { visible: true, selectMode: 'single' },
      color: { type: 'ordinal', range: USER_COLORS },
      point: { visible: false },
      background: { fill: 'transparent' },
    },
  }

  if (!data || data.length === 0) return emptyResult

  // Group by user id so users sharing a display name stay separate, falling
  // back to the name only for rows without an id.
  const userIds = new Map<string, string>()
  const userQuotaTotal = new Map<string, number>()
  data.forEach((item) => {
    const userId =
      item.user_id === undefined || item.user_id === null
        ? `name:${item.username || 'unknown'}`
        : String(item.user_id)
    if (!userIds.has(userId)) {
      userIds.set(userId, item.username || 'unknown')
    }
    const prev = userQuotaTotal.get(userId) || 0
    userQuotaTotal.set(userId, prev + (Number(item.quota) || 0))
  })

  const sorted = [...userQuotaTotal.entries()].sort((a, b) => b[1] - a[1])
  const topUsers = sorted.slice(0, limit).map(([id]) => id)
  const topUserSet = new Set(topUsers)
  // The chart title reports site-wide spend, so it must include the users that
  // the ranking itself truncates away.
  const totalQuota = sorted.reduce((s, [, q]) => s + q, 0)

  // Duplicate display names would collapse identical series labels, so append
  // the id when the same name belongs to more than one user.
  const labelCounts = new Map<string, number>()
  userIds.forEach((name) => {
    labelCounts.set(name, (labelCounts.get(name) ?? 0) + 1)
  })
  const displayName = (userId: string) => {
    const name = userIds.get(userId) ?? 'unknown'
    return (labelCounts.get(name) ?? 0) > 1 ? `${name} (#${userId})` : name
  }

  const rankValues = sorted.slice(0, limit).map(([userId, quota]) => ({
    User: displayName(userId),
    rawQuota: quota,
    Usage: Number((quota / quotaPerUnit).toFixed(4)),
  }))

  const userColorMap = topUsers.reduce<Record<string, string>>(
    (acc, userId, i) => {
      acc[displayName(userId)] = USER_COLORS[i % USER_COLORS.length]
      return acc
    },
    {}
  )

  const timeUserMap = new Map<string, Map<string, number>>()
  const timeTimestamps = new Map<string, number>()

  data.forEach((item) => {
    const ts = Number(item.created_at)
    const timeKey = formatChartTime(ts, timeGranularity)
    timeTimestamps.set(timeKey, Math.min(timeTimestamps.get(timeKey) ?? ts, ts))
    const userId =
      item.user_id === undefined || item.user_id === null
        ? `name:${item.username || 'unknown'}`
        : String(item.user_id)
    if (!topUserSet.has(userId)) return
    let map = timeUserMap.get(timeKey)
    if (!map) {
      map = new Map()
      timeUserMap.set(timeKey, map)
    }
    map.set(userId, (map.get(userId) || 0) + (Number(item.quota) || 0))
  })

  const sortedTimePoints = [...timeTimestamps]
    .sort((a, b) => a[1] - b[1])
    .map(([time]) => time)
  const trendValues: Array<{
    Time: string
    User: string
    rawQuota: number
    Usage: number
  }> = []

  sortedTimePoints.forEach((time) => {
    topUsers.forEach((userId) => {
      const q = timeUserMap.get(time)?.get(userId) || 0
      trendValues.push({
        Time: time,
        User: displayName(userId),
        rawQuota: q,
        Usage: Number((q / quotaPerUnit).toFixed(4)),
      })
    })
  })

  return {
    spec_user_rank: {
      type: 'bar',
      data: [{ id: 'userRankData', values: rankValues }],
      xField: 'rawQuota',
      yField: 'User',
      seriesField: 'User',
      direction: 'horizontal',
      title: {
        visible: true,
        text: tt('User Consumption Ranking'),
        subtext: `${tt('Total:')} ${formatVal(totalQuota)}`,
      },
      legends: { visible: false },
      bar: {
        state: { hover: { stroke: '#000', lineWidth: 1 } },
      },
      label: {
        visible: true,
        position: 'outside',
        formatMethod: (value: number) => formatVal(value),
        style: { fontSize: 11 },
      },
      axes: [
        { orient: 'left', type: 'band' },
        { orient: 'bottom', type: 'linear', visible: false },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.User,
              value: (datum: Record<string, unknown>) =>
                formatVal(Number(datum?.rawQuota) || 0),
            },
          ],
          updateContent: (
            array: Array<{
              key: string
              value: string | number
              datum?: Record<string, unknown>
            }>
          ) => {
            for (let i = 0; i < array.length; i++) {
              const rawQuota = array[i].datum?.rawQuota
              const value =
                rawQuota === undefined ? array[i].value : Number(rawQuota)
              array[i].value = formatVal(Number(value) || 0)
            }
            return array
          },
        },
      },
      color: { specified: userColorMap },
      background: { fill: 'transparent' },
      animation: true,
    },
    spec_user_trend: {
      type: 'area',
      data: [{ id: 'userTrendData', values: trendValues }],
      xField: 'Time',
      yField: 'rawQuota',
      seriesField: 'User',
      stack: false,
      title: {
        visible: true,
        text: tt('User Consumption Trend'),
        subtext: `${tt('Total:')} ${formatVal(totalQuota)}`,
      },
      legends: { visible: true, selectMode: 'single' },
      axes: [
        { orient: 'bottom', type: 'band' },
        {
          orient: 'left',
          type: 'linear',
          label: {
            formatMethod: (value: number) => formatVal(value),
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.User,
              value: (datum: Record<string, unknown>) =>
                formatVal(Number(datum?.rawQuota) || 0),
            },
          ],
        },
        dimension: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.User,
              value: (datum: Record<string, unknown>) =>
                Number(datum?.rawQuota) || 0,
            },
          ],
          updateContent: (
            array: Array<{
              key: string
              value: string | number
            }>
          ) => {
            array.sort(
              (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
            )
            let sum = 0
            for (let i = 0; i < array.length; i++) {
              const v = Number(array[i].value) || 0
              sum += v
              array[i].value = formatVal(v)
            }
            array.unshift({
              key: tt('Total:'),
              value: formatVal(sum),
            })
            return array
          },
        },
      },
      area: {
        style: {
          fillOpacity: 0.15,
          curveType: 'monotone',
        },
      },
      line: {
        style: {
          lineWidth: 2,
          curveType: 'monotone',
        },
      },
      point: { visible: false },
      color: { specified: userColorMap },
      background: { fill: 'transparent' },
      animation: true,
    },
  }
}
