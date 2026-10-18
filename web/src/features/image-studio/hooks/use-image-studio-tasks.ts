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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { handleServerError } from '@/lib/handle-server-error'

import {
  batchImageStudioTasks,
  cancelImageStudioTask,
  deleteImageStudioTask,
  getImageStudioTask,
  listImageStudioTasks,
  submitImageStudioTask,
  type SubmitImageStudioTaskPayload,
} from '../api'
import {
  IMAGE_STUDIO_ACTIVE_POLL_MS,
  IMAGE_STUDIO_IDLE_POLL_MS,
  IMAGE_STUDIO_QUERY_KEYS,
} from '../constants'
import type { ImageStudioBatchAction, ImageStudioTaskListQuery } from '../types'
import { isActiveTask } from '../lib/task-view'

export interface UseImageStudioTasksOptions {
  query: ImageStudioTaskListQuery
  /** Whether generation records are worth polling at all. */
  enabled?: boolean
}

export function useImageStudioTasks(options: UseImageStudioTasksOptions) {
  const { query } = options
  const enabled = options.enabled ?? true

  const result = useQuery({
    queryKey: [...IMAGE_STUDIO_QUERY_KEYS.tasks, query],
    queryFn: ({ signal }) => listImageStudioTasks(query, signal),
    enabled,
    // While anything is still queued or running the grid has to catch the
    // transition, otherwise the user stares at a spinner that never clears.
    refetchInterval: (current) => {
      const items = current.state.data?.items ?? []
      return items.some(isActiveTask)
        ? IMAGE_STUDIO_ACTIVE_POLL_MS
        : IMAGE_STUDIO_IDLE_POLL_MS
    },
    placeholderData: (previous) => previous,
  })

  return result
}

export function useImageStudioTask(id: string | null) {
  return useQuery({
    queryKey: IMAGE_STUDIO_QUERY_KEYS.task(id ?? ''),
    queryFn: ({ signal }) => getImageStudioTask(id ?? '', signal),
    enabled: Boolean(id),
    refetchInterval: (current) => {
      const task = current.state.data
      return task && isActiveTask(task) ? IMAGE_STUDIO_ACTIVE_POLL_MS : false
    },
  })
}

/**
 * Mutations for a single record plus the batch endpoint. Every success path
 * invalidates the list so counts and the model filter stay truthful.
 */
export function useImageStudioTaskActions() {
  const queryClient = useQueryClient()
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: IMAGE_STUDIO_QUERY_KEYS.tasks,
    })
    void queryClient.invalidateQueries({
      queryKey: ['image-studio', 'task'],
    })
  }, [queryClient])

  const remove = useMutation({
    mutationFn: deleteImageStudioTask,
    onSuccess: invalidate,
    onError: (error) => handleServerError(error, 'Unable to delete this record'),
  })

  const cancel = useMutation({
    mutationFn: cancelImageStudioTask,
    onSuccess: invalidate,
    onError: (error) => handleServerError(error, 'Unable to cancel this record'),
  })

  const batch = useMutation({
    mutationFn: (input: { action: ImageStudioBatchAction; ids: string[] }) =>
      batchImageStudioTasks(input.action, input.ids),
    onSuccess: invalidate,
    onError: (error) => handleServerError(error, 'Unable to update the selection'),
  })

  return useMemo(
    () => ({ remove, cancel, batch, invalidate }),
    [remove, cancel, batch, invalidate]
  )
}

export function useImageStudioSubmit(onSettled?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SubmitImageStudioTaskPayload) =>
      submitImageStudioTask(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: IMAGE_STUDIO_QUERY_KEYS.tasks,
      })
    },
    onSettled: () => onSettled?.(),
  })
}
