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
export type IQProbeVerdict = 'normal' | 'suspect' | 'invalid' | 'failed'

export type IQProbeResult = {
  id: number
  group_name: string
  model_name: string
  /** One-time verification code the generated page had to contain. */
  code: string
  /** Drawn animal, scene and style, e.g. "狐狸 · 太空站 · 像素风". */
  prompt_title: string
  /** Only returned by the detail endpoint. */
  prompt?: string
  source: 'auto' | 'manual'
  success: boolean
  verdict: IQProbeVerdict
  /** Comma-separated reason codes, see VERDICT_REASON_LABEL_KEYS. */
  verdict_reasons: string
  error_message: string
  /** Only returned by the detail endpoint. */
  html?: string
  html_bytes: number
  latency_ms: number
  prompt_tokens: number
  completion_tokens: number
  reasoning_tokens: number
  created_at: number
}

export type IQMonitorModel = {
  model: string
  latest: IQProbeResult | null
  history: IQProbeResult[]
}

export type IQMonitorGroup = {
  group: string
  description: string
  models: IQMonitorModel[]
}

export type IQMonitorOverview = {
  auto_enabled: boolean
  interval_minutes: number
  running: boolean
  can_run: boolean
  /** Only super administrators may delete stored probe results. */
  can_delete: boolean
  groups: IQMonitorGroup[]
}

export type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export type RunIQProbeRequest = {
  group?: string
  model?: string
}
