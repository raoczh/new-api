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
import { ChevronRight, Gauge, Layers } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  formatUptimePct,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestampRelative } from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { formatLatencySeconds } from '../lib/format'
import { getGroupHealth, GROUP_HEALTH_CONFIG } from '../lib/status'
import type { GroupStatus, GroupStatusVendor } from '../types'
import { HourlyStatusBar } from './hourly-status-bar'

interface GroupStatusCardProps {
  group: GroupStatus
  hourlyStart: number
  windowLabel: string
  vendor?: GroupStatusVendor
  onOpenDetails: (group: GroupStatus) => void
}

export const GroupStatusCard = memo(function GroupStatusCard(
  props: GroupStatusCardProps
) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const config = GROUP_HEALTH_CONFIG[getGroupHealth(props.group)]
  const latest = props.group.hourly.at(-1)
  const icon = props.vendor?.icon ? getLobeIcon(props.vendor.icon, 24) : null
  const modelName = latest?.top_model || props.group.models[0]?.model_name
  const rate = props.group.summary?.success_rate ?? Number.NaN
  let summarySource = t('Request observation')
  if (props.group.summary_source === 'auto_probe') {
    summarySource = t('Automatic probe')
  }
  if (props.group.summary_source === 'manual_test') {
    summarySource = t('Manual test')
  }
  if (props.group.summary_source === 'mixed_tests') {
    summarySource = t('Automatic and manual tests')
  }
  let lastObserved = t('No records')
  if (props.group.last_seen_ts > 0) {
    lastObserved =
      Date.now() / 1000 - props.group.last_seen_ts < 60
        ? t('Just now')
        : formatTimestampRelative(props.group.last_seen_ts, 'seconds', locale)
  }

  return (
    <article className='bg-card hover:border-primary/40 flex min-h-72 min-w-0 flex-col gap-5 rounded-2xl border p-5 transition-colors'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-3'>
          <span
            className='bg-muted flex size-11 shrink-0 items-center justify-center rounded-xl'
            aria-hidden='true'
          >
            {icon ?? <Layers className='text-muted-foreground size-5' />}
          </span>
          <div className='min-w-0'>
            <h3
              className='truncate text-base font-semibold'
              title={props.group.description || props.group.group}
            >
              {props.group.description || props.group.group}
            </h3>
            <p
              className='text-muted-foreground truncate text-xs'
              title={modelName || props.group.group}
            >
              {modelName || props.group.group}
            </p>
          </div>
        </div>
        <span className={cn('shrink-0 text-xs font-medium', config.textClass)}>
          {t(config.labelKey)}
        </span>
      </div>
      <dl className='grid grid-cols-2 gap-3'>
        <div className='bg-muted/50 min-w-0 rounded-xl px-3 py-3'>
          <dt className='text-muted-foreground flex items-center gap-1.5 text-xs'>
            <Gauge className='size-3.5' aria-hidden='true' />
            {t('Latency short')}
          </dt>
          <dd
            className={cn(
              'mt-1 font-mono text-base font-semibold',
              config.textClass
            )}
          >
            {formatLatencySeconds(
              latest?.avg_ttft_ms || latest?.avg_latency_ms
            )}
          </dd>
        </div>
        <div className='bg-muted/50 min-w-0 rounded-xl px-3 py-3'>
          <dt className='text-muted-foreground flex items-center gap-1.5 text-xs'>
            <Layers className='size-3.5' aria-hidden='true' />
            {t('Group ratio')}
          </dt>
          <dd className='mt-1 font-mono text-base font-semibold'>
            {props.group.group_ratio == null
              ? '—'
              : `${formatNumber(props.group.group_ratio, locale)}x`}
          </dd>
        </div>
      </dl>
      <div className='flex items-center justify-between gap-2 border-b pb-3 text-xs'>
        <div className='text-muted-foreground space-y-1'>
          <p>
            {t('Availability')} · {props.windowLabel}
          </p>
          {props.group.summary && (
            <p className='text-[11px]'>
              {t('Source')}: {summarySource}
            </p>
          )}
        </div>
        <span
          className={cn(
            'font-mono text-lg font-semibold',
            getSuccessRateTextClass(rate)
          )}
        >
          {formatUptimePct(rate)}
        </span>
      </div>
      <div className='mt-auto space-y-2'>
        <div className='text-muted-foreground flex items-center justify-between gap-2 text-xs'>
          <span>{t('Last 24 hours')}</span>
          <span>{lastObserved}</span>
        </div>
        <HourlyStatusBar group={props.group} hourlyStart={props.hourlyStart} />
        <div className='text-muted-foreground flex items-center justify-between gap-2 text-xs'>
          <span>{t('Past')}</span>
          <span>{t('Now')}</span>
        </div>
      </div>
      <Button
        variant='ghost'
        size='sm'
        className='text-muted-foreground -mt-2 justify-between'
        onClick={() => props.onOpenDetails(props.group)}
      >
        {t('Show model breakdown')}
        <ChevronRight aria-hidden='true' />
      </Button>
    </article>
  )
})
