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

/** `self` is the user's own workspace, `admin` lists every user's tickets. */
export type TicketScope = 'self' | 'admin'

/** 1: waiting for an admin, 2: admin replied, 3: closed */
export type TicketStatus = 1 | 2 | 3

export type Ticket = {
  id: number
  user_id: number
  username: string
  title: string
  status: TicketStatus
  created_at: number
  updated_at: number
  closed_at: number
}

export type TicketMessage = {
  id: number
  ticket_id: number
  user_id: number
  username: string
  is_admin: boolean
  content: string
  created_at: number
}

export type TicketDetail = {
  ticket: Ticket
  messages: TicketMessage[]
}

export type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}

export type TicketListParams = {
  p: number
  page_size: number
  status?: number
  keyword?: string
}

export type TicketListData = {
  items: Ticket[]
  total: number
  page: number
  page_size: number
}
