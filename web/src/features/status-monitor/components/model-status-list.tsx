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
import { Gauge, HeartPulse, Timer, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CardStaggerContainer, CardStaggerItem } from '@/components/page-transition'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { PanelWrapper } from '@/features/dashboard/components/ui/panel-wrapper'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
  getSuccessRateDotClass,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import type { PerfModelSummary } from '@/features/performance-metrics/types'
import { cn } from '@/lib/utils'

interface ModelStatusListProps {
  models: PerfModelSummary[]
  loading: boolean
}

function SuccessRateBar(props: { value: number }) {
  const clamped = Number.isFinite(props.value)
    ? Math.min(100, Math.max(0, props.value))
    : 0

  return (
    <div
      className='bg-muted h-1.5 w-full overflow-hidden rounded-full'
      role='img'
      aria-hidden='true'
    >
      <div
        className={cn('h-full rounded-full', getSuccessRateDotClass(props.value))}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

function MetricCell(props: {
  icon: LucideIcon
  label: string
  value: string
  loading: boolean
  tone: IconBadgeTone
  valueClassName?: string
}) {
  const Icon = props.icon

  return (
    <div className='bg-card flex items-center gap-3 rounded-lg border px-4 py-3'>
      <IconBadge tone={props.tone} size='sm'>
        <Icon />
      </IconBadge>
      <div className='flex min-w-0 flex-col'>
        <span className='text-muted-foreground truncate text-xs'>
          {props.label}
        </span>
        <span
          className={cn(
            'truncate text-lg font-semibold tabular-nums',
            props.valueClassName
          )}
        >
          {props.loading ? '—' : props.value}
        </span>
      </div>
    </div>
  )
}

export function ModelStatusList(props: ModelStatusListProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <PanelWrapper
        title={t('Model availability')}
        description={t('Recent request success rate per model')}
        loading
        height='h-72'
      />
    )
  }

  return (
    <PanelWrapper
      title={t('Model availability')}
      description={t('Recent request success rate per model')}
      empty={props.models.length === 0}
      emptyMessage={t(
        'No model samples in this window. Performance metrics may be disabled on this site.'
      )}
      height='h-72'
      contentClassName='p-0'
    >
      <div className='divide-border divide-y'>
        {props.models.map((model) => (
          <div
            key={model.model_name}
            className='flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5'
          >
            <span className='min-w-0 flex-1 truncate font-mono text-sm'>
              {model.model_name}
            </span>

            <span className='flex items-center gap-3 sm:w-56'>
              <SuccessRateBar value={model.success_rate} />
              <span
                className={cn(
                  'w-16 shrink-0 text-end text-sm font-semibold tabular-nums',
                  getSuccessRateTextClass(model.success_rate)
                )}
              >
                {formatUptimePct(model.success_rate)}
              </span>
            </span>

            <span className='text-muted-foreground flex shrink-0 items-center gap-4 text-xs tabular-nums sm:w-44 sm:justify-end'>
              <span className='flex items-center gap-1.5'>
                <Timer className='size-3.5' aria-hidden='true' />
                {formatLatency(model.avg_latency_ms)}
              </span>
              <span className='flex items-center gap-1.5'>
                <Gauge className='size-3.5' aria-hidden='true' />
                {formatThroughput(model.avg_tps)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </PanelWrapper>
  )
}

export function StatusMonitorSummary(props: {
  successRate: number
  avgLatencyMs: number
  avgTps: number
  loading: boolean
}) {
  const { t } = useTranslation()

  const cells = useMemo(
    () => [
      {
        key: 'success',
        icon: HeartPulse,
        label: t('Success rate'),
        value: formatUptimePct(props.successRate),
        tone: 'success' as IconBadgeTone,
        valueClassName: getSuccessRateTextClass(props.successRate),
      },
      {
        key: 'latency',
        icon: Timer,
        label: t('Average latency'),
        value: formatLatency(props.avgLatencyMs),
        tone: 'warning' as IconBadgeTone,
      },
      {
        key: 'throughput',
        icon: Gauge,
        label: t('Throughput'),
        value: formatThroughput(props.avgTps),
        tone: 'info' as IconBadgeTone,
      },
    ],
    [props.avgLatencyMs, props.avgTps, props.successRate, t]
  )

  return (
    <CardStaggerContainer className='grid gap-3 sm:grid-cols-3'>
      {cells.map((cell) => (
        <CardStaggerItem key={cell.key}>
          <MetricCell
            icon={cell.icon}
            label={cell.label}
            value={cell.value}
            loading={props.loading}
            tone={cell.tone}
            valueClassName={cell.valueClassName}
          />
        </CardStaggerItem>
      ))}
    </CardStaggerContainer>
  )
}
