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
  PromotionEmailPreview,
  PromotionListParams,
  PromotionListResult,
  PromotionRecipientStats,
  PromotionTask,
  PromotionTaskStatusSnapshot,
} from './types'

export async function getPromotionRecipients(
  params: PromotionListParams
): Promise<ApiResponse<PromotionListResult>> {
  const query = new URLSearchParams()
  query.set('p', String(params.p ?? 1))
  query.set('page_size', String(params.page_size ?? 20))
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.status) query.set('status', params.status)
  if (params.reward_status) query.set('reward_status', params.reward_status)
  if (params.bound) query.set('bound', params.bound)
  const res = await api.get(`/api/open-source-promotion/?${query.toString()}`)
  return res.data
}

export async function getPromotionStats(): Promise<
  ApiResponse<PromotionRecipientStats>
> {
  const res = await api.get('/api/open-source-promotion/stats')
  return res.data
}

export async function getEmailPreview(): Promise<
  ApiResponse<{ previews: PromotionEmailPreview[] }>
> {
  const res = await api.get('/api/open-source-promotion/email-preview')
  return res.data
}

export async function getPromotionTaskStatus(): Promise<
  ApiResponse<PromotionTaskStatusSnapshot>
> {
  const res = await api.get('/api/open-source-promotion/task-status')
  return res.data
}

export async function blacklistRecipients(
  ids: number[]
): Promise<ApiResponse<{ affected: number }>> {
  const res = await api.post('/api/open-source-promotion/blacklist', { ids })
  return res.data
}

export async function unblacklistRecipients(
  ids: number[]
): Promise<ApiResponse<{ affected: number }>> {
  const res = await api.post('/api/open-source-promotion/unblacklist', { ids })
  return res.data
}

export async function sendRecipients(
  ids: number[]
): Promise<ApiResponse<{ task: PromotionTask; enqueued: boolean }>> {
  const res = await api.post('/api/open-source-promotion/send', { ids })
  return res.data
}

export async function sendAllRecipients(): Promise<
  ApiResponse<{ task: PromotionTask; enqueued: boolean; affected: number }>
> {
  const res = await api.post('/api/open-source-promotion/send-all')
  return res.data
}

export async function fetchPromotionAuthors(
  maxRepos?: number
): Promise<ApiResponse<{ task: PromotionTask; enqueued: boolean }>> {
  const res = await api.post('/api/open-source-promotion/fetch', {
    max_repos: maxRepos,
  })
  return res.data
}

export async function regrantRecipients(ids: number[]): Promise<
  ApiResponse<{ granted: number; skipped: number; failed: number }>
> {
  const res = await api.post('/api/open-source-promotion/regrant', { ids })
  return res.data
}

export async function deleteRecipient(
  id: number
): Promise<ApiResponse<{ affected: number }>> {
  const res = await api.delete(`/api/open-source-promotion/${id}`)
  return res.data
}
