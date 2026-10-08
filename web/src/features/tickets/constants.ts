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
import type { StatusVariant } from '@/components/status-badge'

import type { TicketStatus } from './types'

export const TICKET_STATUS = {
  OPEN: 1,
  REPLIED: 2,
  CLOSED: 3,
} as const satisfies Record<string, TicketStatus>

/** `labelKey` values are i18n keys and must be rendered through `t()`. */
export const TICKET_STATUS_CONFIG: Record<
  TicketStatus,
  { labelKey: string; variant: StatusVariant }
> = {
  1: { labelKey: 'Awaiting reply', variant: 'warning' },
  2: { labelKey: 'Replied', variant: 'info' },
  3: { labelKey: 'Closed', variant: 'neutral' },
}

export const TICKET_TITLE_MAX_LENGTH = 100
export const TICKET_CONTENT_MAX_LENGTH = 5000
export const TICKET_PAGE_SIZE = 20
