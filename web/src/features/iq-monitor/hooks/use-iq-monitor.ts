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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import {
  deleteIQProbeResult,
  getIQMonitorOverview,
  getIQProbeResult,
  runIQProbe,
} from '../api'
import {
  IQ_MONITOR_REFETCH_INTERVAL_MS,
  IQ_MONITOR_RUNNING_REFETCH_INTERVAL_MS,
} from '../constants'
import type { RunIQProbeRequest } from '../types'

const IQ_MONITOR_QUERY_KEY = ['iq-monitor'] as const

export function useIQMonitorOverview() {
  const user = useAuthStore((state) => state.auth.user)
  return useQuery({
    queryKey: [
      ...IQ_MONITOR_QUERY_KEY,
      'overview',
      user?.id ?? 0,
      user?.group ?? '',
    ],
    queryFn: async () => requireServerSuccess(await getIQMonitorOverview()),
    refetchInterval: (query) =>
      query.state.data?.data.running
        ? IQ_MONITOR_RUNNING_REFETCH_INTERVAL_MS
        : IQ_MONITOR_REFETCH_INTERVAL_MS,
    retry: false,
  })
}

/** Loads one result with its generated HTML; results never change once stored. */
export function useIQProbeResult(id: number | null | undefined) {
  const user = useAuthStore((state) => state.auth.user)
  return useQuery({
    queryKey: [...IQ_MONITOR_QUERY_KEY, 'result', id ?? 0, user?.id ?? 0],
    queryFn: async () => requireServerSuccess(await getIQProbeResult(id ?? 0)),
    enabled: Boolean(id),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
}

export function useRunIQProbe() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (request: RunIQProbeRequest) =>
      requireServerSuccess(await runIQProbe(request)),
    onSuccess: (response) => {
      toast.success(
        response.data.created
          ? t('IQ probe started. Results appear when generation finishes.')
          : t('An IQ probe is already running.')
      )
      return queryClient.invalidateQueries({
        queryKey: [...IQ_MONITOR_QUERY_KEY, 'overview'],
      })
    },
  })
}

/** Deletes one stored result; only super administrators pass can_delete. */
export function useDeleteIQProbeResult() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      requireServerSuccess(await deleteIQProbeResult(id)),
    onSuccess: async (_response, id) => {
      queryClient.removeQueries({
        queryKey: [...IQ_MONITOR_QUERY_KEY, 'result', id],
      })
      toast.success(t('Record deleted'))
      await queryClient.invalidateQueries({
        queryKey: [...IQ_MONITOR_QUERY_KEY, 'overview'],
      })
    },
  })
}
