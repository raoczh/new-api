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
import { VChart } from '@visactor/react-vchart'
import { Layers } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import {
  getCacheHitRate,
  getDashboardChartColors,
} from '@/features/dashboard/lib'
import type { HourlyTokenUsage } from '@/features/dashboard/types'
import { toIntlLocale } from '@/i18n/languages'
import dayjs from '@/lib/dayjs'
import { formatCompactNumber } from '@/lib/format'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import { PanelWrapper } from '../ui/panel-wrapper'

interface TokenUsageChartProps {
  data: HourlyTokenUsage[] | undefined
  /** Query window in Unix seconds, used to draw every hour on the x-axis. */
  startTimestamp: number
  endTimestamp: number
  loading?: boolean
}

type TokenDatum = { hour: string; type: string; value: number }
type RateDatum = { hour: string; type: string; rate: number | null }
type TooltipDatum = Partial<TokenDatum & RateDatum>

const HOUR_SECONDS = 3600

function toTokenCount(value: number | undefined): number {
  return Math.max(Number(value) || 0, 0)
}

export function TokenUsageChart(props: TokenUsageChartProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { resolvedTheme, themeReady } = useChartTheme()

  // The API only returns hours that had traffic. Fill the whole window so the
  // x-axis always shows a continuous 24-hour timeline.
  const hourly = useMemo(() => {
    const byHour = new Map<number, HourlyTokenUsage>()
    for (const item of props.data ?? []) byHour.set(item.created_at, item)

    const firstHour =
      props.startTimestamp - (props.startTimestamp % HOUR_SECONDS)
    const lastHour = props.endTimestamp - (props.endTimestamp % HOUR_SECONDS)
    const rows: Array<{
      hour: string
      input: number
      output: number
      cacheCreation: number
      cacheRead: number
    }> = []
    for (let hour = firstHour; hour <= lastHour; hour += HOUR_SECONDS) {
      const item = byHour.get(hour)
      rows.push({
        hour: String(hour),
        input: toTokenCount(item?.input_tokens),
        output: toTokenCount(item?.output_tokens),
        cacheCreation: toTokenCount(item?.cache_creation_tokens),
        cacheRead: toTokenCount(item?.cache_read_tokens),
      })
    }
    return rows
  }, [props.data, props.startTimestamp, props.endTimestamp])

  const seriesLabels = useMemo(
    () => ({
      input: t('Input Tokens'),
      output: t('Output Tokens'),
      cacheCreation: t('Cache Write'),
      cacheRead: t('Cache Read'),
      hitRate: t('Cache Hit Rate'),
    }),
    [t]
  )

  const tokenValues = useMemo<TokenDatum[]>(
    () =>
      hourly.flatMap((row) => [
        { hour: row.hour, type: seriesLabels.input, value: row.input },
        { hour: row.hour, type: seriesLabels.output, value: row.output },
        {
          hour: row.hour,
          type: seriesLabels.cacheCreation,
          value: row.cacheCreation,
        },
        { hour: row.hour, type: seriesLabels.cacheRead, value: row.cacheRead },
      ]),
    [hourly, seriesLabels]
  )

  const rateValues = useMemo<RateDatum[]>(
    () =>
      hourly.map((row) => ({
        hour: row.hour,
        type: seriesLabels.hitRate,
        rate: getCacheHitRate(row),
      })),
    [hourly, seriesLabels]
  )

  const cacheHitRate = useMemo(() => {
    const totals = hourly.reduce(
      (sum, row) => ({
        input: sum.input + row.input,
        cacheCreation: sum.cacheCreation + row.cacheCreation,
        cacheRead: sum.cacheRead + row.cacheRead,
      }),
      { input: 0, cacheCreation: 0, cacheRead: 0 }
    )
    // Without any cache read the rate is noise (always 0%), so hide it.
    if (totals.cacheRead === 0) return null
    const rate = getCacheHitRate(totals)
    return rate === null ? null : rate.toFixed(1)
  }, [hourly])

  const spec = useMemo(() => {
    const formatHourLabel = (hour: unknown) =>
      dayjs.unix(Number(hour)).format('HH:mm')
    const formatHourTitle = (hour: unknown) =>
      dayjs.unix(Number(hour)).format('YYYY-MM-DD HH:mm')
    const formatTooltipValue = (datum?: TooltipDatum) => {
      if (datum?.type !== seriesLabels.hitRate) {
        return formatCompactNumber(datum?.value ?? 0, locale)
      }
      if (datum.rate == null) return '-'
      return `${datum.rate.toFixed(1)}%`
    }
    const typeDomain = [
      seriesLabels.input,
      seriesLabels.output,
      seriesLabels.cacheCreation,
      seriesLabels.cacheRead,
      seriesLabels.hitRate,
    ]

    return {
      type: 'common',
      data: [
        { id: 'tokens', values: tokenValues },
        { id: 'hitRate', values: rateValues },
      ],
      series: [
        {
          type: 'line',
          id: 'tokens',
          dataId: 'tokens',
          xField: 'hour',
          yField: 'value',
          seriesField: 'type',
          activePoint: true,
          line: { style: { lineWidth: 2, lineCap: 'round' } },
          point: { visible: false },
        },
        {
          type: 'line',
          id: 'hitRate',
          dataId: 'hitRate',
          xField: 'hour',
          yField: 'rate',
          seriesField: 'type',
          activePoint: true,
          // Hours without cache traffic have no rate; bridge them instead of
          // plotting a misleading 0%.
          invalidType: 'link',
          line: {
            style: { lineWidth: 2, lineCap: 'round', lineDash: [4, 3] },
          },
          point: { visible: false },
        },
      ],
      axes: [
        {
          orient: 'bottom',
          type: 'band',
          seriesId: ['tokens', 'hitRate'],
          label: { formatMethod: formatHourLabel },
        },
        {
          orient: 'left',
          type: 'linear',
          seriesId: ['tokens'],
          label: {
            formatMethod: (value: unknown) =>
              formatCompactNumber(Number(value), locale),
          },
        },
        {
          orient: 'right',
          type: 'linear',
          seriesId: ['hitRate'],
          min: 0,
          max: 100,
          grid: { visible: false },
          label: { formatMethod: (value: unknown) => `${Number(value)}%` },
        },
      ],
      crosshair: {
        xField: {
          visible: true,
          line: { type: 'line', width: 1 },
          label: { visible: true, formatMethod: formatHourLabel },
        },
      },
      legends: {
        visible: true,
        orient: 'top',
        position: 'start',
        padding: { bottom: 12 },
      },
      tooltip: {
        mark: { visible: false },
        dimension: {
          title: {
            value: (datum?: TooltipDatum) => formatHourTitle(datum?.hour),
          },
          content: [
            {
              key: (datum?: TooltipDatum) => datum?.type ?? '',
              value: formatTooltipValue,
            },
          ],
        },
      },
      color: {
        type: 'ordinal',
        domain: typeDomain,
        range: getDashboardChartColors(typeDomain.length),
      },
    }
  }, [tokenValues, rateValues, seriesLabels, locale])

  const chartKey = ['token-usage', String(hourly.length), resolvedTheme].join(
    '-'
  )

  const isEmpty = !props.data || props.data.length === 0

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <IconBadge tone='chart-1' size='sm'>
            <Layers />
          </IconBadge>
          {t('24-Hour Token Usage')}
        </span>
      }
      description={t('Input, output, and prompt cache tokens by hour')}
      loading={props.loading}
      empty={isEmpty}
      emptyMessage={t('No token usage data')}
      height='h-[300px]'
      contentClassName='p-1.5 sm:p-2'
      headerActions={
        cacheHitRate !== null ? (
          <div className='flex shrink-0 items-center gap-2'>
            <span className='text-muted-foreground text-xs'>
              {t('Cache Hit Rate')}
            </span>
            <span className='text-sm font-semibold tabular-nums'>
              {cacheHitRate}%
            </span>
          </div>
        ) : undefined
      }
    >
      <div className='h-[300px]'>
        {themeReady && (
          <VChart
            key={chartKey}
            spec={{
              ...spec,
              theme: resolvedTheme === 'dark' ? 'dark' : 'light',
              background: 'transparent',
            }}
            option={VCHART_OPTION}
          />
        )}
      </div>
    </PanelWrapper>
  )
}
