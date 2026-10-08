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
import type { TFunction } from 'i18next'
import { z } from 'zod'

import {
  TICKET_CONTENT_MAX_LENGTH,
  TICKET_TITLE_MAX_LENGTH,
} from '../constants'

export function getTicketFormSchema(t: TFunction) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, t('Please enter a title'))
      .max(
        TICKET_TITLE_MAX_LENGTH,
        t('Title must be at most {{count}} characters', {
          count: TICKET_TITLE_MAX_LENGTH,
        })
      ),
    content: z
      .string()
      .trim()
      .min(1, t('Please describe your issue'))
      .max(
        TICKET_CONTENT_MAX_LENGTH,
        t('Content must be at most {{count}} characters', {
          count: TICKET_CONTENT_MAX_LENGTH,
        })
      ),
  })
}

export type TicketFormValues = z.infer<ReturnType<typeof getTicketFormSchema>>
