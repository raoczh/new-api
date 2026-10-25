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
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'

import { VERDICT_CONFIG, VERDICT_REASON_LABEL_KEYS } from '../constants'
import { parseVerdictReasons } from '../lib/html'
import type { IQProbeVerdict } from '../types'

type VerdictBadgeProps = {
  verdict: IQProbeVerdict
  reasons?: string
  size?: 'sm' | 'lg'
}

export function VerdictBadge(props: VerdictBadgeProps) {
  const { t } = useTranslation()
  const config = VERDICT_CONFIG[props.verdict] ?? VERDICT_CONFIG.failed
  const reasons = parseVerdictReasons(props.reasons ?? '')
    .map((reason) => t(VERDICT_REASON_LABEL_KEYS[reason] ?? reason))
    .join(t('、'))
  return (
    <StatusBadge
      label={t(config.labelKey)}
      variant={config.variant}
      size={props.size ?? 'sm'}
      copyable={false}
      className='bg-muted/60'
      title={reasons || undefined}
    />
  )
}

type VerdictReasonListProps = {
  reasons: string
}

export function VerdictReasonList(props: VerdictReasonListProps) {
  const { t } = useTranslation()
  const reasons = parseVerdictReasons(props.reasons)
  if (reasons.length === 0) return null
  return (
    <ul className='text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs'>
      {reasons.map((reason) => (
        <li key={reason}>{t(VERDICT_REASON_LABEL_KEYS[reason] ?? reason)}</li>
      ))}
    </ul>
  )
}
