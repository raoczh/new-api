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
import { useTranslation } from 'react-i18next'

import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { TicketMessage } from '../types'

type TicketMessageBubbleProps = {
  message: TicketMessage
  /** Sent from the viewer's side: aligned right with the primary color. */
  own: boolean
}

export function TicketMessageBubble(props: TicketMessageBubbleProps) {
  const { t } = useTranslation()
  const sender = props.message.is_admin
    ? t('Support')
    : props.message.username || t('User')

  return (
    <li
      className={cn(
        'flex flex-col gap-1',
        props.own ? 'items-end' : 'items-start'
      )}
    >
      <span className='text-muted-foreground px-1 text-xs'>
        {sender} · {formatTimestampToDate(props.message.created_at)}
      </span>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap sm:max-w-[75%]',
          props.own
            ? 'bg-primary text-primary-foreground rounded-ee-sm'
            : 'bg-card text-card-foreground rounded-es-sm border'
        )}
      >
        {props.message.content}
      </div>
    </li>
  )
}
