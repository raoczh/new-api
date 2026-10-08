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
export type GroupHourPoint = {
  ts: number
  success_rate: number
  avg_ttft_ms: number
  top_model: string
}

export type GroupModelStat = {
  model_name: string
  success_rate: number
  avg_ttft_ms: number
  avg_latency_ms: number
  avg_tps: number
}

export type GroupSummary = {
  success_rate: number
  avg_ttft_ms: number
  avg_latency_ms: number
  avg_tps: number
}

export type GroupStatus = {
  group: string
  description: string
  vendor_id: number
  /** Window totals; null when the group has no samples in the window. */
  summary: GroupSummary | null
  last_seen_ts: number
  hourly: GroupHourPoint[]
  models: GroupModelStat[]
}

export type GroupStatusVendor = {
  id: number
  name: string
  icon?: string
}

export type GroupStatusResponse = {
  success: boolean
  message?: string
  data: {
    window_start: number
    window_end: number
    /** Start of the first of the fixed 24 hourly cells. */
    hourly_start: number
    vendors: GroupStatusVendor[]
    groups: GroupStatus[]
  }
}
