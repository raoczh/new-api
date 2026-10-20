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

import {
  formatUptimePct,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestampRelative } from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { STATUS_MONITOR_HOURLY_CELLS } from '../constants'
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
  const icon = props.vendor?.icon ? getLobeIcon(props.vendor.icon, 22) : null
  const rate = props.group.summary?.success_rate ?? Number.NaN
  let lastObserved = t('No records')
  if (props.group.last_seen_ts > 0) {
    lastObserved =
      Date.now() / 1000 - props.group.last_seen_ts < 60
        ? t('Just now')
        : formatTimestampRelative(props.group.last_seen_ts, 'seconds', locale)
  }

  return (
    <article
      role='button'
      tabIndex={0}
      aria-label={t('Show model breakdown for {{group}}', {
        group: props.group.description || props.group.group,
      })}
      onClick={() => props.onOpenDetails(props.group)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        props.onOpenDetails(props.group)
      }}
      className='bg-card hover:border-primary/40 focus-visible:ring-ring flex min-w-0 cursor-pointer flex-col gap-4 rounded-xl border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none'
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-3'>
          <span
            className='bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg'
            aria-hidden='true'
          >
            {icon ?? <Layers className='text-muted-foreground size-5' />}
          </span>
          <div className='min-w-0'>
            <h3
              className='truncate text-base font-semibold'
              title={props.group.group}
            >
              {props.group.group}
            </h3>
            <p
              className='text-muted-foreground truncate text-xs'
              title={props.group.description}
            >
              {props.group.description}
            </p>
          </div>
        </div>
        <span className={cn('shrink-0 text-xs font-medium', config.textClass)}>
          {t(config.labelKey)}
        </span>
      </div>
      <dl className='grid grid-cols-2 gap-2.5'>
        <div className='bg-muted/50 min-w-0 rounded-lg px-3 py-2.5'>
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
        <div className='bg-muted/50 min-w-0 rounded-lg px-3 py-2.5'>
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
        <div className='text-muted-foreground space-y-0.5'>
          <p>
            {t('Availability')} · {props.windowLabel}
          </p>
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
          <span>
            {t('Last {{hours}} hours', { hours: STATUS_MONITOR_HOURLY_CELLS })}
          </span>
          <span>{lastObserved}</span>
        </div>
        <HourlyStatusBar group={props.group} hourlyStart={props.hourlyStart} />
        <div className='text-muted-foreground flex items-center justify-between gap-2 text-[11px]'>
          <span>{t('Past')}</span>
          <span>{t('Now')}</span>
        </div>
      </div>
      <span className='text-muted-foreground -mx-2 -mb-1 flex items-center justify-between gap-2 px-2 py-1 text-xs font-medium'>
        {t('Show model breakdown')}
        <ChevronRight className='size-4' aria-hidden='true' />
      </span>
    </article>
  )
})
