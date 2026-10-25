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
import { Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { formatLatency } from '@/features/performance-metrics/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { cn } from '@/lib/utils'

import { VERDICT_CONFIG } from '../constants'
import { formatProbeTime } from '../lib/format'
import type { IQProbeResult } from '../types'
import { VerdictBadge } from './verdict-badge'

type HistoryListProps = {
  history: IQProbeResult[]
  /** Only super administrators may delete stored results. */
  canDelete: boolean
  deletingId?: number
  onOpen: (result: IQProbeResult) => void
  onDelete: (result: IQProbeResult) => void
}

export function HistoryList(props: HistoryListProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  if (props.history.length === 0) {
    return <EmptyState title={t('No records')} bordered />
  }

  return (
    <div className='flex flex-col gap-3'>
      {/* Oldest to newest, matching the status monitor timeline. */}
      <div
        className='flex h-6 gap-0.5'
        role='img'
        aria-label={t('Verdict timeline of the last {{count}} probes', {
          count: props.history.length,
        })}
      >
        {[...props.history].reverse().map((item) => (
          <span
            key={item.id}
            className={cn(
              'h-full flex-1 rounded-[2px]',
              (VERDICT_CONFIG[item.verdict] ?? VERDICT_CONFIG.failed).dotClass
            )}
            aria-hidden='true'
          />
        ))}
      </div>
      <ul className='flex flex-col divide-y rounded-lg border'>
        {props.history.map((item) => (
          <li key={item.id} className='flex items-center'>
            <button
              type='button'
              onClick={() => props.onOpen(item)}
              className='hover:bg-muted/50 focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-start text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none'
            >
              <span className='text-muted-foreground w-24 shrink-0 text-xs tabular-nums'>
                {formatProbeTime(item.created_at, locale)}
              </span>
              <span className='min-w-0 flex-1 truncate'>
                {item.prompt_title}
              </span>
              <span className='text-muted-foreground hidden text-xs tabular-nums sm:inline'>
                {formatLatency(item.latency_ms)}
              </span>
              <VerdictBadge
                verdict={item.verdict}
                reasons={item.verdict_reasons}
              />
            </button>
            {props.canDelete ? (
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                className='text-muted-foreground hover:text-destructive me-1 shrink-0'
                aria-label={t('Delete record')}
                disabled={props.deletingId === item.id}
                onClick={() => props.onDelete(item)}
              >
                {props.deletingId === item.id ? (
                  <Loader2 className='animate-spin' aria-hidden='true' />
                ) : (
                  <Trash2 aria-hidden='true' />
                )}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
