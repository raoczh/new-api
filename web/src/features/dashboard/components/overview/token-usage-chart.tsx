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
import { getDashboardChartColors } from '@/features/dashboard/lib'
import type { HourlyTokenUsage } from '@/features/dashboard/types'
import { formatCompactNumber } from '@/lib/format'
import { formatChartTime } from '@/lib/time'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import { PanelWrapper } from '../ui/panel-wrapper'

interface TokenUsageChartProps {
  data: HourlyTokenUsage[] | undefined
  loading?: boolean
}

const TOKEN_SERIES_KEYS = [
  'Input Tokens',
  'Output Tokens',
  'Cache Creation',
  'Cache Read',
] as const

export function TokenUsageChart(props: TokenUsageChartProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()

  const chartData = useMemo(() => {
    const source = props.data ?? []
    if (source.length === 0) return []

    return source.flatMap((item) => [
      {
        time: item.created_at * 1000,
        type: t('Input Tokens'),
        value: Math.max(Number(item.input_tokens) || 0, 0),
      },
      {
        time: item.created_at * 1000,
        type: t('Output Tokens'),
        value: Math.max(Number(item.output_tokens) || 0, 0),
      },
      {
        time: item.created_at * 1000,
        type: t('Cache Creation'),
        value: Math.max(Number(item.cache_creation_tokens) || 0, 0),
      },
      {
        time: item.created_at * 1000,
        type: t('Cache Read'),
        value: Math.max(Number(item.cache_read_tokens) || 0, 0),
      },
    ])
  }, [props.data, t])

  // Cache reads over all cache tokens: the share of cache traffic that was
  // served from cache instead of being written to it.
  const cacheHitRate = useMemo(() => {
    const source = props.data ?? []
    if (source.length === 0) return null

    const totalCacheRead = source.reduce(
      (sum, item) => sum + (Number(item.cache_read_tokens) || 0),
      0
    )
    const totalCacheCreation = source.reduce(
      (sum, item) => sum + (Number(item.cache_creation_tokens) || 0),
      0
    )
    const totalCacheTokens = totalCacheRead + totalCacheCreation
    if (totalCacheTokens === 0) return null

    return ((totalCacheRead / totalCacheTokens) * 100).toFixed(1)
  }, [props.data])

  const spec = useMemo(
    () => ({
      type: 'line',
      data: [{ id: 'data', values: chartData }],
      xField: 'time',
      yField: 'value',
      seriesField: 'type',
      line: {
        style: {
          lineWidth: 2,
          lineCap: 'round',
        },
      },
      point: {
        visible: chartData.length <= 48,
        style: {
          size: 4,
        },
      },
      axes: [
        {
          orient: 'bottom',
          type: 'time',
          label: {
            formatMethod: (value: number) => formatChartTime(value, 3600),
          },
        },
        {
          orient: 'left',
          label: {
            formatMethod: (value: number) => formatCompactNumber(value),
          },
        },
      ],
      legends: {
        visible: true,
        orient: 'top',
        position: 'start',
        padding: { bottom: 12 },
      },
      tooltip: {
        mark: {
          title: {
            value: (datum: { time?: number }) =>
              formatChartTime(datum?.time ?? 0, 3600),
          },
          content: [
            {
              key: (datum: { type?: string }) => datum?.type ?? '',
              value: (datum: { value?: number }) =>
                formatCompactNumber(datum?.value ?? 0),
            },
          ],
        },
      },
      color: getDashboardChartColors(TOKEN_SERIES_KEYS.length),
    }),
    [chartData]
  )

  const chartKey = [
    'token-usage',
    String(chartData.length),
    resolvedTheme,
  ].join('-')

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
