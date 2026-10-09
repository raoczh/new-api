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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getDashboardChartColors } from '@/features/dashboard/lib'
import type { ModelDistributionItem } from '@/features/dashboard/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { useChartTheme } from '@/lib/use-chart-theme'
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
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { resolvedTheme, themeReady } = useChartTheme()
  const [metric, setMetric] = useState<MetricType>('requests')

  // One color per pie slice: the top models plus the shared "Other" slice.
  // Table rows reuse the slice color so they double as the pie legend.
  const sliceColors = useMemo(
    () => getDashboardChartColors(MAX_VISIBLE_MODELS + 1),
    []
  )

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
      radius: 0.85,
      innerRadius: 0.55,
      padAngle: 0.02,
      label: {
        visible: false,
      },
      legends: {
        visible: false,
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: { name?: string }) => datum?.name ?? '',
              value: (datum: { value?: number }) => {
                const value = datum?.value ?? 0
                if (metric === 'cost') return formatQuota(value)
                return formatCompactNumber(value, locale)
              },
            },
          ],
        },
      },
      color: {
        type: 'ordinal',
        domain: chartData.map((item) => item.name),
        range: sliceColors.slice(0, chartData.length),
      },
    }),
    [chartData, metric, locale, sliceColors]
  )

  const chartKey = [
    'model-distribution',
    metric,
    String(chartData.length),
    resolvedTheme,
  ].join('-')

  const isEmpty = !props.data || props.data.length === 0
  const rows = props.data ?? []

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
        <div
          role='group'
          aria-label={t('Pie chart metric')}
          className='bg-muted/60 inline-flex h-7 overflow-x-auto rounded-lg border p-0.5 sm:h-8'
        >
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
      <div className='grid gap-2 sm:h-[300px] sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'>
        <div className='h-[220px] min-w-0 sm:h-full'>
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
        <div className='max-h-[300px] min-w-0 overflow-y-auto sm:max-h-none'>
          <Table className='bg-transparent [&_td]:text-xs [&_th]:text-xs'>
            <TableHeader className='bg-transparent'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='text-muted-foreground h-8'>
                  {t('Model')}
                </TableHead>
                <TableHead className='text-muted-foreground h-8 text-right'>
                  {t('Requests')}
                </TableHead>
                <TableHead className='text-muted-foreground h-8 text-right'>
                  {t('Tokens')}
                </TableHead>
                <TableHead className='text-muted-foreground h-8 text-right'>
                  {t('Cost')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className='[&>tr]:h-8'>
              {rows.map((item, index) => (
                <TableRow
                  key={item.model_name}
                  className='border-border/40 hover:bg-transparent'
                >
                  <TableCell className='max-w-[10rem] py-1'>
                    <span className='flex min-w-0 items-center gap-2'>
                      <span
                        className='size-2 shrink-0 rounded-full'
                        style={{
                          backgroundColor:
                            sliceColors[Math.min(index, MAX_VISIBLE_MODELS)],
                        }}
                        aria-hidden='true'
                      />
                      <span className='truncate' title={item.model_name}>
                        {item.model_name}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className='py-1 text-right'>
                    {formatCompactNumber(item.request_count, locale)}
                  </TableCell>
                  <TableCell className='py-1 text-right'>
                    {formatCompactNumber(item.total_tokens, locale)}
                  </TableCell>
                  <TableCell className='py-1 text-right'>
                    {formatQuota(item.actual_cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </PanelWrapper>
  )
}
