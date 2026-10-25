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
import type { StatusVariant } from '@/components/status-badge'

import type { IQProbeVerdict } from './types'

/** Poll while idle; the page polls faster while a run is in progress. */
export const IQ_MONITOR_REFETCH_INTERVAL_MS = 60 * 1000
export const IQ_MONITOR_RUNNING_REFETCH_INTERVAL_MS = 5 * 1000

export const VERDICT_CONFIG: Record<
  IQProbeVerdict,
  { labelKey: string; variant: StatusVariant; dotClass: string }
> = {
  normal: { labelKey: 'Normal', variant: 'success', dotClass: 'bg-success' },
  suspect: {
    labelKey: 'Suspected degradation',
    variant: 'warning',
    dotClass: 'bg-warning',
  },
  invalid: {
    labelKey: 'Invalid output',
    variant: 'danger',
    dotClass: 'bg-destructive',
  },
  failed: {
    labelKey: 'Request failed',
    variant: 'neutral',
    dotClass: 'bg-neutral',
  },
}

/** Reason codes produced by judgeIQProbe on the backend. */
export const VERDICT_REASON_LABEL_KEYS: Record<string, string> = {
  no_svg: 'No SVG in the output',
  truncated: 'Output is truncated',
  code_missing: 'Verification code missing from the page',
  no_animation: 'No animation detected',
  html_drop: 'HTML size far below recent results',
  output_drop: 'Output tokens far below recent results',
  reasoning_drop: 'Reasoning tokens far below recent results',
}
