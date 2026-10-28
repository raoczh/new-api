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
import { z } from 'zod'

export const promotionRecipientSchema = z.object({
  id: z.number(),
  email: z.string(),
  github_login: z.string(),
  github_user_id: z.number(),
  author_name: z.string(),
  profile_url: z.string(),
  repository: z.string(),
  repository_url: z.string(),
  repository_description: z.string(),
  repository_stars: z.number(),
  repository_language: z.string(),
  source: z.string(),
  contribution: z.string(),
  status: z.string(),
  send_attempts: z.number(),
  last_sent_at: z.number(),
  last_error: z.string(),
  bound_user_id: z.number(),
  bound_at: z.number(),
  reward_quota: z.number(),
  rewarded_at: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
  bound_username: z.string(),
  existing_user: z.boolean(),
})

export type PromotionRecipient = z.infer<typeof promotionRecipientSchema>

export type PromotionRecipientStats = {
  total: number
  pending: number
  sent: number
  failed: number
  blacklisted: number
  bound: number
  rewarded: number
  rewarded_quota_total: number
  sent_today: number
}

export type PromotionEmailPreview = {
  language: string
  subject: string
  body: string
}

export type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}

export type PromotionListParams = {
  p?: number
  page_size?: number
  keyword?: string
  status?: string
  reward_status?: string
  bound?: string
}

export type PromotionListResult = {
  items: PromotionRecipient[]
  total: number
}

export type PromotionTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed'

// PromotionTaskState is the live progress a running task writes after every
// repository (harvest) or message (delivery).
export type PromotionTaskState = {
  total?: number
  processed?: number
  progress?: number
  cursor_page?: number
  cursor_repo_index?: number
  authors_seen?: number
  current_repository?: string
  sent?: number
  failed?: number
  skipped?: number
}

// PromotionTaskResult is the summary persisted when the task finishes.
export type PromotionTaskResult = {
  repositories?: number
  authors_found?: number
  inserted?: number
  skipped_duplicate?: number
  skipped_filtered?: number
  skipped_invalid_email?: number
  skipped_non_chinese_project?: number
  skipped_non_chinese_author?: number
  skipped_over_limit?: number
  repository_errors?: number
  rate_limited?: boolean
  cursor_reset?: boolean
  sent?: number
  failed?: number
  skipped?: number
  recovered?: number
  skipped_reason?: string
}

export type PromotionTask = {
  id: number
  task_id: string
  type: string
  status: PromotionTaskStatus
  state?: PromotionTaskState
  result?: PromotionTaskResult
  error?: string
  created_at: number
  updated_at: number
}

export type PromotionTaskStatusSnapshot = {
  fetch: PromotionTask | null
  email: PromotionTask | null
}
