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
import { ImageOff } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { cn } from '@/lib/utils'

import { useIQProbeResult } from '../hooks/use-iq-monitor'
import { buildSandboxedDocument } from '../lib/html'
import type { IQProbeResult } from '../types'

type ResultPreviewProps = {
  result: IQProbeResult | null
  className?: string
}

/**
 * Renders a generated page in an iframe with only allow-scripts: the page gets
 * an opaque origin, so it cannot read cookies, storage, or the parent DOM.
 */
export function ResultPreview(props: ResultPreviewProps) {
  const { t } = useTranslation()
  const hasHTML = Boolean(props.result?.success && props.result.html_bytes > 0)
  const detail = useIQProbeResult(hasHTML ? props.result?.id : null)
  const html = detail.data?.data.html ?? ''
  const srcDoc = useMemo(
    () => (html ? buildSandboxedDocument(html) : ''),
    [html]
  )

  let content = null
  if (!props.result) {
    content = (
      <EmptyState
        icon={ImageOff}
        title={t('No IQ probe results yet')}
        description={t(
          'Results appear after the first scheduled or manual probe finishes.'
        )}
      />
    )
  } else if (!hasHTML) {
    content = (
      <EmptyState
        icon={ImageOff}
        title={t('No rendered output')}
        description={
          props.result.error_message || t('The model returned no HTML.')
        }
      />
    )
  } else if (detail.isLoading) {
    content = <LoadingState />
  } else if (detail.isError) {
    content = <ErrorState onRetry={() => detail.refetch()} />
  } else {
    content = (
      <iframe
        key={props.result.id}
        title={t('Rendered output of {{model}}', {
          model: props.result.model_name,
        })}
        srcDoc={srcDoc}
        sandbox='allow-scripts'
        referrerPolicy='no-referrer'
        className='size-full border-0 bg-white'
      />
    )
  }

  return (
    <div
      className={cn(
        'bg-muted/30 flex items-center justify-center overflow-hidden rounded-lg border',
        props.className
      )}
    >
      {content}
    </div>
  )
}
