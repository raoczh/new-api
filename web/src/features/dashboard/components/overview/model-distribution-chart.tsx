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
import { Boxes } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { getDashboardChartColors } from '@/features/dashboard/lib'
import type { ModelDistributionItem } from '@/features/dashboard/types'
import { useChartTheme } from '@/lib/use-chart-theme'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { VCHART_OPTION } from '@/lib/vchart'

import { PanelWrapper } from '../ui/panel-wrapper'

interface ModelDistributionChartProps {
  data: ModelDistributionItem[] | undefined
  loading?: boolean
}

type MetricType = 'requests' | 'tokens' | 'cost'

const METRIC_OPTIONS: Array<{ value: MetricType; labelKey: string }> = [
  { value: 'requests', labelKey: 'Requests' },
  { value: 'tokens', labelKey: 'Tokens' },
  { value: 'cost', labelKey: 'Cost' },
]

const MAX_VISIBLE_MODELS = 8

function getMetricValue(item: ModelDistributionItem, metric: MetricType): number {
  if (metric === 'tokens') return item.total_tokens
  if (metric === 'cost') return item.actual_cost
  return item.request_count
}

export function ModelDistributionChart(props: ModelDistributionChartProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()
  const [metric, setMetric] = useState<MetricType>('requests')

  const chartData = useMemo(() => {
    const source = props.data ?? []
    if (source.length === 0) return []

    const result = source.slice(0, MAX_VISIBLE_MODELS).map((item) => ({
      name: item.model_name,
      value: getMetricValue(item, metric),
    }))

    const rest = source.slice(MAX_VISIBLE_MODELS)
    if (rest.length > 0) {
      result.push({
        name: t('Other'),
        value: rest.reduce(
          (total, item) => total + getMetricValue(item, metric),
          0
        ),
      })
    }

    return result
  }, [props.data, metric, t])

  const spec = useMemo(
    () => ({
      type: 'pie',
      data: [{ id: 'data', values: chartData }],
      valueField: 'value',
      categoryField: 'name',
      radius: 0.8,
      innerRadius: 0.5,
      padAngle: 0.02,
      label: {
        visible: false,
      },
      legends: {
        visible: true,
        orient: 'right',
        maxRow: 10,
        item: {
          shape: {
            style: {
              symbolType: 'circle',
            },
          },
        },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: { name?: string }) => datum?.name ?? '',
              value: (datum: { value?: number }) => {
                const value = datum?.value ?? 0
                if (metric === 'cost') return formatQuota(value)
                return formatCompactNumber(value)
              },
            },
          ],
        },
      },
      color: getDashboardChartColors(
        Math.max(chartData.length, MAX_VISIBLE_MODELS)
      ),
    }),
    [chartData, metric]
  )

  const chartKey = [
    'model-distribution',
    metric,
    String(chartData.length),
    resolvedTheme,
  ].join('-')

  const isEmpty = !props.data || props.data.length === 0

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <IconBadge tone='chart-3' size='sm'>
            <Boxes />
          </IconBadge>
          {t('Model Distribution')}
        </span>
      }
      description={t('Which models you use the most')}
      loading={props.loading}
      empty={isEmpty}
      emptyMessage={t('No model usage data')}
      height='h-[300px]'
      contentClassName='p-1.5 sm:p-2'
      headerActions={
        <div className='bg-muted/60 inline-flex h-7 overflow-x-auto rounded-lg border p-0.5 sm:h-8'>
          {METRIC_OPTIONS.map((option) => (
            <button
              key={option.value}
              type='button'
              onClick={() => setMetric(option.value)}
              aria-pressed={metric === option.value}
              className={
                metric === option.value
                  ? 'text-foreground shrink-0 rounded-md bg-background px-3 text-xs font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground shrink-0 rounded-md px-3 text-xs font-medium'
              }
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
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
