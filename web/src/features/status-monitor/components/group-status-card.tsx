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
import { ChevronRight } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import { formatLatencySeconds } from '../lib/format'
import { getGroupHealth, GROUP_HEALTH_CONFIG } from '../lib/status'
import type { GroupStatus } from '../types'
import { HourlyStatusBar } from './hourly-status-bar'

interface GroupStatusCardProps {
  group: GroupStatus
  hourlyStart: number
  onOpenDetails: (group: GroupStatus) => void
}

export const GroupStatusCard = memo(function GroupStatusCard(
  props: GroupStatusCardProps
) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const health = getGroupHealth(props.group)
  const config = GROUP_HEALTH_CONFIG[health]
  const latest = props.group.hourly.at(-1)
  const title = props.group.group
  const subtitle = props.group.description &&
    props.group.description !== props.group.group
    ? props.group.description
    : undefined

  let lastObserved = t('No records')
  if (props.group.last_seen_ts > 0) {
    lastObserved =
      Date.now() / 1000 - props.group.last_seen_ts < 60
        ? t('Just now')
        : formatTimestampRelative(props.group.last_seen_ts, 'seconds', locale)
  }

  return (
    <article className='bg-card hover:border-primary/40 flex flex-col gap-4 rounded-xl border p-4 transition-colors'>
      <button
        type='button'
        onClick={() => props.onOpenDetails(props.group)}
        aria-label={t('Show model breakdown')}
        className='focus-visible:ring-ring/50 -m-1 flex items-start justify-between gap-2 rounded-md p-1 text-start outline-none focus-visible:ring-[3px]'
      >
        <span className='flex min-w-0 flex-col'>
          <span className='truncate text-sm font-semibold'>{title}</span>
          {subtitle && (
            <span className='text-muted-foreground truncate text-xs'>
              {subtitle}
            </span>
          )}
        </span>
        <ChevronRight
          className='text-muted-foreground mt-0.5 size-4 shrink-0'
          aria-hidden='true'
        />
      </button>

      <span
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          config.textClass
        )}
      >
        <span
          className={cn('size-1.5 rounded-full', config.dotClass)}
          aria-hidden='true'
        />
        {t(config.labelKey)}
      </span>

      <HourlyStatusBar group={props.group} hourlyStart={props.hourlyStart} />

      <dl className='flex flex-col gap-2 text-xs'>
        <div className='flex items-center justify-between gap-2'>
          <dt className='text-muted-foreground'>{t('Time to first token')}</dt>
          <dd
            className={cn(
              'font-semibold tabular-nums',
              latest && config.textClass
            )}
          >
            {formatLatencySeconds(latest?.avg_ttft_ms)}
          </dd>
        </div>
        <div className='flex items-center justify-between gap-2 border-t pt-2'>
          <dt className='text-muted-foreground'>{t('Last observed')}</dt>
          <dd className='text-muted-foreground tabular-nums'>{lastObserved}</dd>
        </div>
      </dl>
    </article>
  )
})
