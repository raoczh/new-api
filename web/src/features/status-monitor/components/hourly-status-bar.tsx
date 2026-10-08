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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getSuccessRateDotClass } from '@/features/performance-metrics/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { cn } from '@/lib/utils'

import { formatHourRange, formatLatencySeconds } from '../lib/format'
import {
  buildHourlySlots,
  getRateHealth,
  GROUP_HEALTH_CONFIG,
} from '../lib/status'
import type { GroupStatus } from '../types'

interface HourlyStatusBarProps {
  group: GroupStatus
  hourlyStart: number
  className?: string
}

export function HourlyStatusBar(props: HourlyStatusBarProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const slots = useMemo(
    () => buildHourlySlots(props.hourlyStart, props.group.hourly),
    [props.group.hourly, props.hourlyStart]
  )

  return (
    <div
      role='img'
      aria-label={t('24-hour success rate timeline for {{group}}', {
        group: props.group.description || props.group.group,
      })}
      className={cn('flex h-5 items-stretch gap-[3px]', props.className)}
    >
      {slots.map((slot) => {
        const health = slot.point
          ? getRateHealth(slot.point.success_rate)
          : 'pending'
        const config = GROUP_HEALTH_CONFIG[health]
        return (
          <Tooltip key={slot.ts}>
            <TooltipTrigger
              render={
                <span
                  data-slot='hour-cell'
                  data-health={health}
                  className={cn(
                    'min-w-0 flex-1 rounded-[2px] transition-opacity hover:opacity-75',
                    slot.point
                      ? getSuccessRateDotClass(slot.point.success_rate)
                      : 'bg-muted-foreground/15'
                  )}
                />
              }
            />
            <TooltipContent side='top' className='flex flex-col gap-1 text-xs'>
              <span className='font-semibold tabular-nums'>
                {formatHourRange(slot.ts, locale)}
              </span>
              <span className='flex items-center gap-1.5 font-medium'>
                <span
                  className={cn('size-1.5 rounded-full', config.dotClass)}
                  aria-hidden='true'
                />
                {t(config.labelKey)}
              </span>
              {slot.point && (
                <>
                  <span>
                    {t('Source')}: {t('Request observation')}
                  </span>
                  <span>
                    {t('Success rate')}: {slot.point.success_rate.toFixed(2)}%
                  </span>
                  {slot.point.top_model && (
                    <span className='max-w-56 truncate'>
                      {t('Model')}: {slot.point.top_model}
                    </span>
                  )}
                  {slot.point.avg_ttft_ms > 0 && (
                    <span>
                      {t('Time to first token')}:{' '}
                      {formatLatencySeconds(slot.point.avg_ttft_ms)}
                    </span>
                  )}
                </>
              )}
              {!slot.point && <span>{t('No requests in this hour')}</span>}
              <span className='opacity-60'>{timezone}</span>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
