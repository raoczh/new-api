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
  IQMonitorOverview,
  IQProbeResult,
  RunIQProbeRequest,
} from './types'

export async function getIQMonitorOverview(): Promise<
  ApiResponse<IQMonitorOverview>
> {
  const res = await api.get<ApiResponse<IQMonitorOverview>>('/api/iq-monitor')
  return res.data
}

export async function getIQProbeResult(
  id: number
): Promise<ApiResponse<IQProbeResult>> {
  const res = await api.get<ApiResponse<IQProbeResult>>(
    `/api/iq-monitor/results/${id}`
  )
  return res.data
}

export async function runIQProbe(
  request: RunIQProbeRequest
): Promise<ApiResponse<{ task_id: string; created: boolean }>> {
  const res = await api.post<
    ApiResponse<{ task_id: string; created: boolean }>
  >('/api/iq-monitor/run', request)
  return res.data
}

export async function deleteIQProbeResult(
  id: number
): Promise<ApiResponse<{ id: number }>> {
  const res = await api.delete<ApiResponse<{ id: number }>>(
    `/api/iq-monitor/results/${id}`
  )
  return res.data
}
