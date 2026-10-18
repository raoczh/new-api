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

/** Server-provided workbench limits. Mirrors GetImageStudioConfig. */
export interface ImageStudioConfig {
  enabled: boolean
  image_concurrency: number
  video_concurrency: number
  retention_days: number
  max_images_per_request: number
  max_reference_images: number
  upload_max_mb: number
  queue_max_wait_minutes: number
  image_models: string[]
  smtp_configured: boolean
}

/** One model under a group, with the ratio and per-call price it will bill. */
export interface ImageStudioModelOption {
  model: string
  description?: string
  quota_type: number
  group_ratio: number
  model_ratio: number
  price: number
}

/** A billing group plus the image models it exposes. */
export interface ImageStudioGroupOption {
  group: string
  desc: string
  ratio: number
  models: ImageStudioModelOption[]
}

export type ImageStudioTaskStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  /** Never got a concurrency slot within QueueMaxWaitMinutes. */
  | 'expired'

/** Provider parameters as snapshotted at submission time. */
export interface ImageStudioTaskParams {
  n?: number
  size?: string
  quality?: string
  background?: string
  output_format?: string
  response_format?: string
  style?: string
  [key: string]: unknown
}

/** A stored generation record. Images are already resolved to URLs. */
export interface ImageStudioTask {
  id: string
  kind: string
  status: ImageStudioTaskStatus
  model: string
  group: string
  prompt: string
  params: ImageStudioTaskParams | null
  images: string[]
  references: string[]
  mask?: string
  error: string
  quota: number
  favorite: boolean
  elapsed_ms: number
  created_at: number
  finished_at: number
  expires_at: number
}

export interface ImageStudioTaskList {
  items: ImageStudioTask[]
  total: number
  page: number
  page_size: number
  models: string[]
  retention_days: number
}

export interface ImageStudioTaskListQuery {
  page: number
  page_size: number
  kind?: string
  model?: string
  status?: string
  keyword?: string
  favorite?: boolean
}

/** Response of POST /api/image-studio/tasks. */
export interface ImageStudioSubmitResult {
  task: ImageStudioTask
  image_count: number
  queue_position: number
  queue_depth: number
  concurrency: number
  retention_days: number
}

export interface ImageStudioUploadResult {
  key: string
  url: string
}

export type ImageStudioBatchAction = 'favorite' | 'unfavorite' | 'delete'

/** Local (IndexedDB) record kept so history survives a server outage or purge. */
export interface LocalImageStudioRecord {
  /** Same value as `task.id`; the object store key. */
  id: string
  /** Account id, so two users sharing a browser never see each other's records. */
  owner: string
  saved_at: number
  /** Bumped when the stored shape changes, so stale rows can be ignored. */
  version: number
  task: ImageStudioTask
}

/** One uploaded (or pasted/dropped) reference image, before submission. */
export interface ImageStudioReference {
  /** Local identifier for list keys and reordering. */
  uid: string
  /** Server-side key; empty while uploading or when the upload failed. */
  key: string
  /** Preview URL. Object URLs for freshly picked files, absolute URL for reused ones. */
  url: string
  uploading: boolean
  error?: string
}
