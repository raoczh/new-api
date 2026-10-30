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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatUptimePct,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { buildModelBreakdownRows } from '../../lib'
import type { QuotaDataItem } from '../../types'
import { PanelWrapper } from '../ui/panel-wrapper'

const PERFORMANCE_WINDOW_HOURS = 24

interface ModelBreakdownTableProps {
  data: QuotaDataItem[]
  loading?: boolean
  showPerformance?: boolean
}

export function ModelBreakdownTable(props: ModelBreakdownTableProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const metricsQuery = useQuery({
    queryKey: ['perf-metrics-summary', PERFORMANCE_WINDOW_HOURS],
    queryFn: async () =>
      requireServerSuccess(
        await getPerfMetricsSummary(PERFORMANCE_WINDOW_HOURS)
      ),
    enabled: Boolean(props.showPerformance),
    staleTime: 60 * 1000,
    retry: false,
  })

  const rows = useMemo(
    () =>
      buildModelBreakdownRows(
        props.data,
        metricsQuery.data?.data.models ?? []
      ),
    [metricsQuery.data?.data.models, props.data]
  )

  return (
    <PanelWrapper
      title={t('Model breakdown')}
      description={t('Cost, traffic, and health by model')}
      loading={props.loading}
      empty={!props.loading && rows.length === 0}
      emptyMessage={t('No model usage data')}
      height='h-40'
      contentClassName='p-0'
    >
      <Table>
        <TableHeader className='border-border/60 border-b [&_tr]:border-b-0'>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='text-muted-foreground h-10 text-xs font-medium'>
              {t('Model')}
            </TableHead>
            <TableHead className='text-muted-foreground h-10 text-right text-xs font-medium'>
              {t('Cost')}
            </TableHead>
            <TableHead className='text-muted-foreground h-10 text-right text-xs font-medium'>
              {t('Requests')}
            </TableHead>
            <TableHead className='text-muted-foreground hidden h-10 text-right text-xs font-medium sm:table-cell'>
              {t('Tokens')}
            </TableHead>
            <TableHead className='text-muted-foreground hidden h-10 text-right text-xs font-medium md:table-cell'>
              {t('Cache')}
            </TableHead>
            {props.showPerformance && (
              <TableHead className='text-muted-foreground hidden h-10 text-right text-xs font-medium md:table-cell'>
                {t('Success rate')}
              </TableHead>
            )}
            {props.showPerformance && (
              <TableHead className='text-muted-foreground hidden h-10 text-right text-xs font-medium lg:table-cell'>
                {t('Average latency')}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody className='[&>tr]:h-12'>
          {rows.map((row) => (
            <TableRow key={row.model}>
              <TableCell className='max-w-[18rem] py-2'>
                <div className='flex min-w-0 items-center gap-2'>
                  <span
                    className='bg-chart-1 size-2 shrink-0 rounded-full'
                    aria-hidden='true'
                  />
                  <span className='truncate font-medium' title={row.model}>
                    {row.model}
                  </span>
                </div>
              </TableCell>
              <TableCell className='text-right tabular-nums'>
                <div className='flex flex-col items-end gap-1'>
                  <span>{formatQuota(row.cost)}</span>
                  <span
                    className='bg-muted h-1 w-16 overflow-hidden rounded-full'
                    aria-hidden='true'
                  >
                    <span
                      className='bg-chart-1 block h-full rounded-full'
                      style={{
                        width: `${Math.min(100, row.costShare * 100).toFixed(1)}%`,
                      }}
                    />
                  </span>
                </div>
              </TableCell>
              <TableCell className='text-right tabular-nums'>
                {formatNumber(row.requests, locale)}
              </TableCell>
              <TableCell className='hidden text-right tabular-nums sm:table-cell'>
                {formatCompactNumber(row.tokens, locale)}
              </TableCell>
              <TableCell className='hidden text-right tabular-nums md:table-cell'>
                {formatCompactNumber(row.cacheTokens, locale)}
              </TableCell>
              {props.showPerformance && (
                <TableCell className='hidden text-right tabular-nums md:table-cell'>
                  <span
                    className={getSuccessRateTextClass(
                      row.successRate ?? Number.NaN
                    )}
                  >
                    {formatUptimePct(row.successRate ?? Number.NaN)}
                  </span>
                </TableCell>
              )}
              {props.showPerformance && (
                <TableCell className='hidden text-right tabular-nums lg:table-cell'>
                  {formatLatency(row.avgLatencyMs ?? Number.NaN)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </PanelWrapper>
  )
}
