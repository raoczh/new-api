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

import { formatLatency } from '@/features/performance-metrics/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { formatProbeTime } from '../lib/format'
import type { IQProbeResult } from '../types'

type ResultMetaProps = {
  result: IQProbeResult
}

/** Compact stats for one result; channels are deliberately never shown. */
export function ResultMeta(props: ResultMetaProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const result = props.result
  const stats = [
    {
      key: 'time',
      label: t('Time'),
      value: formatProbeTime(result.created_at, locale),
    },
    {
      key: 'latency',
      label: t('Duration'),
      value: formatLatency(result.latency_ms),
    },
    {
      key: 'output',
      label: t('Output tokens'),
      value: formatNumber(result.completion_tokens, locale),
    },
    {
      key: 'reasoning',
      label: t('Reasoning tokens'),
      value: formatNumber(result.reasoning_tokens, locale),
    },
    {
      key: 'size',
      label: t('HTML size'),
      value: `${formatNumber(Math.round(result.html_bytes / 102.4) / 10, locale)} KB`,
    },
    {
      key: 'source',
      label: t('Trigger'),
      value: result.source === 'manual' ? t('Manual') : t('Scheduled'),
    },
  ]
  // Results recorded before verification codes existed have none.
  if (result.code) {
    stats.push({
      key: 'code',
      label: t('IQ check code'),
      value: result.code,
    })
  }
  return (
    <dl className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
      {stats.map((stat) => (
        <div key={stat.key} className='rounded-lg border px-3 py-2'>
          <dt className='text-muted-foreground text-xs'>{stat.label}</dt>
          <dd className='text-sm font-semibold tabular-nums'>{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}
