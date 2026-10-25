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

import { Dialog } from '@/components/dialog'

import { useIQProbeResult } from '../hooks/use-iq-monitor'
import type { IQProbeResult } from '../types'
import { ResultMeta } from './result-meta'
import { ResultPreview } from './result-preview'
import { VerdictBadge, VerdictReasonList } from './verdict-badge'

type ResultDetailDialogProps = {
  result: IQProbeResult | null
  onOpenChange: (open: boolean) => void
}

export function ResultDetailDialog(props: ResultDetailDialogProps) {
  const { t } = useTranslation()
  const result = props.result
  // Shares the cache entry with ResultPreview, so the prompt costs no request.
  const detail = useIQProbeResult(result?.success ? result.id : null)
  const prompt = detail.data?.data.prompt

  return (
    <Dialog
      open={result != null}
      onOpenChange={props.onOpenChange}
      title={
        <span className='flex flex-wrap items-center gap-2'>
          {result?.model_name}
          {result && (
            <VerdictBadge
              verdict={result.verdict}
              reasons={result.verdict_reasons}
            />
          )}
        </span>
      }
      description={
        result ? `${result.group_name} · ${result.prompt_title}` : undefined
      }
      contentClassName='sm:max-w-5xl'
    >
      {result && (
        <div className='flex flex-col gap-4'>
          <ResultPreview result={result} className='h-[60vh] min-h-80' />
          <VerdictReasonList reasons={result.verdict_reasons} />
          <ResultMeta result={result} />
          {result.error_message && (
            <p className='text-destructive text-sm break-words'>
              {result.error_message}
            </p>
          )}
          {prompt && (
            <section className='flex flex-col gap-1'>
              <h3 className='text-sm font-medium'>{t('Prompt')}</h3>
              <p className='text-muted-foreground bg-muted/40 rounded-lg border p-3 text-sm whitespace-pre-wrap'>
                {prompt}
              </p>
            </section>
          )}
        </div>
      )}
    </Dialog>
  )
}
