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
import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import { TICKET_STATUS_CONFIG } from '../constants'
import type { Ticket, TicketScope } from '../types'
import { TicketStatusBadge } from './ticket-status-badge'

type TicketListProps = {
  scope: TicketScope
  tickets: Ticket[]
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  selectedId: number | null
  onSelect: (id: number) => void
  keyword: string
  onKeywordChange: (keyword: string) => void
  status: number
  onStatusChange: (status: number) => void
  /** Shared pagination control rendered below the list. */
  pagination: ReactNode
}

export function TicketList(props: TicketListProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='flex shrink-0 flex-col gap-2 border-b p-3'>
        <Input
          type='search'
          value={props.keyword}
          onChange={(event) => props.onKeywordChange(event.target.value)}
          placeholder={
            props.scope === 'admin'
              ? t('Search ID, title or username')
              : t('Search ID or title')
          }
          aria-label={t('Search tickets')}
        />
        <NativeSelect
          aria-label={t('Status')}
          className='w-full'
          value={String(props.status)}
          onChange={(event) => props.onStatusChange(Number(event.target.value))}
        >
          <NativeSelectOption value='0'>{t('All Status')}</NativeSelectOption>
          {Object.entries(TICKET_STATUS_CONFIG).map(([value, config]) => (
            <NativeSelectOption key={value} value={value}>
              {t(config.labelKey)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {props.isLoading && (
          <div className='space-y-2 p-3'>
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-16 w-full' />
          </div>
        )}
        {!props.isLoading && props.error && (
          <ErrorState
            title={t('We could not load tickets.')}
            description={props.error.message}
            onRetry={props.onRetry}
            className='m-3'
          />
        )}
        {!props.isLoading && !props.error && props.tickets.length === 0 && (
          <EmptyState
            icon={Inbox}
            title={t('No tickets yet')}
            className='m-3 min-h-40'
          />
        )}
        {!props.isLoading && !props.error && props.tickets.length > 0 && (
          <ul className='divide-y' aria-label={t('Tickets')}>
            {props.tickets.map((ticket) => {
              const selected = ticket.id === props.selectedId
              return (
                <li key={ticket.id}>
                  <button
                    type='button'
                    onClick={() => props.onSelect(ticket.id)}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'hover:bg-muted/60 focus-visible:ring-ring/50 flex w-full flex-col gap-1.5 px-3 py-3 text-start transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset',
                      selected && 'bg-muted'
                    )}
                  >
                    <span className='flex min-w-0 items-center gap-2'>
                      <span className='min-w-0 flex-1 truncate text-sm font-medium'>
                        {ticket.title}
                      </span>
                      <TicketStatusBadge status={ticket.status} />
                    </span>
                    <span className='text-muted-foreground flex min-w-0 items-center gap-2 text-xs'>
                      <span className='shrink-0'>#{ticket.id}</span>
                      {props.scope === 'admin' && (
                        <span className='min-w-0 truncate'>
                          {ticket.username}
                        </span>
                      )}
                      <span className='ms-auto shrink-0'>
                        {formatTimestampRelative(
                          ticket.updated_at,
                          'seconds',
                          locale
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className='shrink-0 border-t px-3 py-2'>{props.pagination}</div>
    </div>
  )
}
