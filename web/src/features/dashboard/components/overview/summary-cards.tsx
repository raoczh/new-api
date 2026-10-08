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
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { useSummaryCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
import type {
  HourlyTokenUsage,
  ModelDistributionItem,
} from '@/features/dashboard/types'
import { useStatus } from '@/hooks/use-status'
import { getCurrencyLabel, isCurrencyDisplayEnabled } from '@/lib/currency'
import {
  formatCompactNumber,
  formatNumber,
  formatQuota,
} from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { computeTimeRange } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

import { StatCard } from '../ui/stat-card'

const SUMMARY_SPARKLINE_BUCKETS = 12
const STAT_CARD_TONES = [
  'accent-1',
  'accent-2',
  'accent-3',
  'accent-1',
  'accent-2',
  'accent-3',
] as const

interface SummaryCardsProps {
  tokenUsage?: HourlyTokenUsage[]
  modelDistribution?: ModelDistributionItem[]
  usageLoading?: boolean
}

function getBucketIndex(
  timestamp: number,
  start: number,
  end: number,
  bucketCount: number
): number {
  if (end <= start) return 0
  const ratio = (timestamp - start) / (end - start)
  return Math.min(bucketCount - 1, Math.max(0, Math.floor(ratio * bucketCount)))
}

function buildUsageSparkline(
  data: { created_at: number; quota?: number }[],
  start: number,
  end: number
): number[] {
  const usage = Array.from({ length: SUMMARY_SPARKLINE_BUCKETS }, () => 0)

  for (const item of data) {
    const timestamp = Number(item.created_at) || start
    const index = getBucketIndex(
      timestamp,
      start,
      end,
      SUMMARY_SPARKLINE_BUCKETS
    )
    usage[index] += Number(item.quota) || 0
  }

  return usage
}

export function SummaryCards(props: SummaryCardsProps) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { status, loading } = useStatus()

  // The 24h tile values come from the caller's queries so the overview page
  // issues a single request per endpoint. This window only drives the usage
  // sparkline, which needs finer buckets than the 24h charts provide.
  const sparklineTimeRange = useMemo(() => computeTimeRange(1), [])
  const remainQuota = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)
  const requestCount = Number(user?.request_count ?? 0)

  const usageTrendQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'summary-sparklines',
      sparklineTimeRange.start_timestamp,
      sparklineTimeRange.end_timestamp,
    ],
    queryFn: async () =>
      requireServerSuccess(
        await getUserQuotaDates({
          start_timestamp: sparklineTimeRange.start_timestamp,
          end_timestamp: sparklineTimeRange.end_timestamp,
          default_time: 'hour',
        })
      ),
    staleTime: 60 * 1000,
  })

  const todayUsage = useMemo(
    () =>
      (props.modelDistribution ?? []).reduce(
        (total, item) => total + (Number(item.actual_cost) || 0),
        0
      ),
    [props.modelDistribution]
  )

  const todayRequests = useMemo(
    () =>
      (props.modelDistribution ?? []).reduce(
        (total, item) => total + (Number(item.request_count) || 0),
        0
      ),
    [props.modelDistribution]
  )

  const todayTokens = useMemo(
    () =>
      (props.tokenUsage ?? []).reduce(
        (total, item) =>
          total +
          (Number(item.input_tokens) || 0) +
          (Number(item.output_tokens) || 0) +
          (Number(item.cache_creation_tokens) || 0) +
          (Number(item.cache_read_tokens) || 0),
        0
      ),
    [props.tokenUsage]
  )

  const sparklineData = useMemo(
    () =>
      buildUsageSparkline(
        usageTrendQuery.data?.data ?? [],
        sparklineTimeRange.start_timestamp,
        sparklineTimeRange.end_timestamp
      ),
    [
      sparklineTimeRange.end_timestamp,
      sparklineTimeRange.start_timestamp,
      usageTrendQuery.data?.data,
    ]
  )

  const currencyEnabledFromStore = isCurrencyDisplayEnabled()
  const statusCurrencyFlag =
    typeof status?.display_in_currency === 'boolean'
      ? Boolean(status.display_in_currency)
      : undefined
  const currencyEnabled =
    statusCurrencyFlag !== undefined
      ? statusCurrencyFlag
      : currencyEnabledFromStore

  const items = useSummaryCardsConfig({
    remainDisplay: formatQuota(remainQuota),
    usedDisplay: formatQuota(usedQuota),
    todayUsageDisplay: formatQuota(todayUsage),
    todayRequestDisplay: formatNumber(todayRequests),
    todayTokenDisplay: formatCompactNumber(todayTokens),
    requestCountDisplay: formatNumber(requestCount),
    currencyLabel: currencyEnabled ? getCurrencyLabel() : 'Tokens',
    currencyEnabled,
  }).map((config, index) => ({
    key: config.key,
    title: config.title,
    value: config.value,
    desc: config.description,
    icon: config.icon,
    tone: STAT_CARD_TONES[index] ?? 'accent-3',
    sparkline:
      config.key === 'todayUsage' || config.key === 'todayRequests'
        ? sparklineData
        : undefined,
  }))

  return (
    <section aria-label={t('Usage at a glance')}>
      <StaggerContainer className='tc-overview-metric-list'>
        {items.map((item) => (
          <StaggerItem key={item.key} className='tc-overview-metric'>
            <StatCard
              title={item.title}
              value={item.value}
              description={item.desc}
              icon={item.icon}
              tone={item.tone}
              sparkline={item.sparkline}
              sparklineVariant='line'
              loading={loading || Boolean(props.usageLoading)}
              compactMobile
            />
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  )
}
