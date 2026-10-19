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
import { requireServerSuccess } from '@/lib/server-error-message'

import { IMAGE_STUDIO_ENDPOINTS, taskEndpoint } from './constants'
import type {
  ImageStudioBatchAction,
  ImageStudioConfig,
  ImageStudioGroupOption,
  ImageStudioSubmitResult,
  ImageStudioTask,
  ImageStudioTaskList,
  ImageStudioTaskListQuery,
  ImageStudioTaskParams,
  ImageStudioUploadResult,
} from './types'

interface ServerEnvelope<T> {
  success: boolean
  message?: string
  data?: T
}

function unwrap<T>(response: ServerEnvelope<T>, fallback: string): T {
  requireServerSuccess(response)
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || fallback)
  }
  return response.data
}

export async function getImageStudioConfig(): Promise<ImageStudioConfig> {
  const res = await api.get(IMAGE_STUDIO_ENDPOINTS.CONFIG)
  return unwrap<ImageStudioConfig>(
    res.data,
    'Unable to load the drawing settings'
  )
}

export async function getImageStudioModels(): Promise<
  ImageStudioGroupOption[]
> {
  const res = await api.get(IMAGE_STUDIO_ENDPOINTS.MODELS)
  const data = unwrap<{ groups: ImageStudioGroupOption[] }>(
    res.data,
    'Unable to load the available image models'
  )
  return Array.isArray(data.groups) ? data.groups : []
}

export interface SubmitImageStudioTaskPayload {
  model: string
  group: string
  prompt: string
  params: ImageStudioTaskParams
  referenceKeys: string[]
  maskKey?: string
}

export async function submitImageStudioTask(
  payload: SubmitImageStudioTaskPayload
): Promise<ImageStudioSubmitResult> {
  const res = await api.post(IMAGE_STUDIO_ENDPOINTS.TASKS, {
    model: payload.model,
    group: payload.group,
    prompt: payload.prompt,
    params: payload.params,
    reference_keys: payload.referenceKeys,
    mask_key: payload.maskKey ?? '',
  })
  return unwrap<ImageStudioSubmitResult>(res.data, 'Submission failed')
}

export async function uploadImageStudioFile(
  file: File,
  signal?: AbortSignal
): Promise<ImageStudioUploadResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post(IMAGE_STUDIO_ENDPOINTS.UPLOADS, form, { signal })
  return unwrap<ImageStudioUploadResult>(res.data, 'Upload failed')
}

export async function listImageStudioTasks(
  query: ImageStudioTaskListQuery,
  signal?: AbortSignal
): Promise<ImageStudioTaskList> {
  const params: Record<string, string | number> = {
    page: query.page,
    page_size: query.page_size,
  }
  if (query.kind) params.kind = query.kind
  if (query.model) params.model = query.model
  if (query.status) params.status = query.status
  if (query.keyword) params.keyword = query.keyword
  if (query.favorite) params.favorite = 'true'

  const res = await api.get(IMAGE_STUDIO_ENDPOINTS.TASKS, { params, signal })
  return unwrap<ImageStudioTaskList>(res.data, 'Unable to load the records')
}

export async function getImageStudioTask(
  id: string,
  signal?: AbortSignal
): Promise<ImageStudioTask> {
  const res = await api.get(taskEndpoint(id), {
    signal,
    disableDuplicate: true,
  })
  // The single-task endpoint returns the task view itself in `data`; only the
  // submit endpoint wraps it in `{ task }`.
  return unwrap<ImageStudioTask>(res.data, 'Unable to load this record')
}

export async function deleteImageStudioTask(id: string): Promise<void> {
  const res = await api.delete(taskEndpoint(id))
  requireServerSuccess(res.data)
}

export async function cancelImageStudioTask(id: string): Promise<void> {
  const res = await api.post(`${taskEndpoint(id)}/cancel`, {})
  requireServerSuccess(res.data)
}

export async function batchImageStudioTasks(
  action: ImageStudioBatchAction,
  ids: string[]
): Promise<void> {
  const res = await api.post(IMAGE_STUDIO_ENDPOINTS.TASK_BATCH, { action, ids })
  requireServerSuccess(res.data)
}

export interface UpdateImageStudioPreferencesPayload {
  imageTaskEmailNotify?: boolean
  promptPolishModel?: string
}

export async function updateImageStudioPreferences(
  payload: UpdateImageStudioPreferencesPayload
): Promise<{ image_task_email_notify: boolean; prompt_polish_model: string }> {
  const body: Record<string, unknown> = {}
  if (payload.imageTaskEmailNotify !== undefined) {
    body.image_task_email_notify = payload.imageTaskEmailNotify
  }
  if (payload.promptPolishModel !== undefined) {
    body.prompt_polish_model = payload.promptPolishModel
  }
  const res = await api.put('/api/user/settings/image-studio', body)
  return unwrap(res.data, 'Unable to save the settings')
}
