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
import { api } from '@/lib/api'

import type {
  ApiResponse,
  Ticket,
  TicketDetail,
  TicketListData,
  TicketListParams,
  TicketMessage,
  TicketScope,
} from './types'

const BASE_PATH: Record<TicketScope, string> = {
  self: '/api/ticket/self',
  admin: '/api/ticket/admin',
}

export async function getTickets(
  scope: TicketScope,
  params: TicketListParams
): Promise<ApiResponse<TicketListData>> {
  const query = new URLSearchParams()
  query.set('p', String(params.p))
  query.set('page_size', String(params.page_size))
  if (params.status) query.set('status', String(params.status))
  if (params.keyword) query.set('keyword', params.keyword)
  const res = await api.get(`${BASE_PATH[scope]}?${query.toString()}`)
  return res.data
}

export async function getTicket(
  scope: TicketScope,
  id: number
): Promise<ApiResponse<TicketDetail>> {
  const res = await api.get(`${BASE_PATH[scope]}/${id}`)
  return res.data
}

export async function createTicket(data: {
  title: string
  content: string
}): Promise<ApiResponse<Ticket>> {
  const res = await api.post(BASE_PATH.self, data)
  return res.data
}

export async function replyTicket(
  scope: TicketScope,
  id: number,
  content: string
): Promise<ApiResponse<TicketMessage>> {
  const res = await api.post(`${BASE_PATH[scope]}/${id}/reply`, { content })
  return res.data
}

export async function closeTicket(
  scope: TicketScope,
  id: number
): Promise<ApiResponse> {
  const res = await api.post(`${BASE_PATH[scope]}/${id}/close`)
  return res.data
}
