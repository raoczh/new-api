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
import { ImageOffIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { Main } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import { useAuthStore } from '@/stores/auth-store'

import type { SubmitImageStudioTaskPayload } from './api'
import { ImageStudioComposer } from './components/studio-composer'
import { ImageStudioHistory } from './components/task-history'
import { useImageStudioDraft } from './hooks/use-image-studio-draft'
import {
  useImageStudioConfig,
  useImageStudioModels,
} from './hooks/use-image-studio-options'
import { useImageStudioSubmit } from './hooks/use-image-studio-tasks'
import type { ImageStudioTask } from './types'

/**
 * AI 绘图 workbench.
 *
 * Submissions are queued server side, so the page has no long-lived request of
 * its own: the composer posts once, the history grid polls the record list, and
 * the detail panel polls the single record it shows.
 */
export function ImageStudioPage() {
  const { t, i18n } = useTranslation()
  const configQuery = useImageStudioConfig()
  const modelsQuery = useImageStudioModels()
  const config = configQuery.data
  const user = useAuthStore((state) => state.auth.user)

  const [selection, setSelection] = useState({ group: '', model: '' })
  const topRef = useRef<HTMLDivElement | null>(null)

  const draft = useImageStudioDraft({
    maxReferences: config?.max_reference_images ?? 4,
    uploadMaxMB: config?.upload_max_mb ?? 10,
  })

  // Adopt the server's suggestion until the user picks something themselves.
  useEffect(() => {
    if (selection.model || !modelsQuery.defaultSelection.model) return
    setSelection(modelsQuery.defaultSelection)
  }, [modelsQuery.defaultSelection, selection.model])

  const submit = useImageStudioSubmit(() => {
    // References and the mask are consumed by the request; keeping them would
    // silently resend the same files with the next prompt.
    draft.setMask(null)
  })

  const handleSubmit = useCallback(
    (payload: SubmitImageStudioTaskPayload) => {
      submit.mutate(payload, {
        onSuccess: (result) => {
          const depth = result.queue_position > 0 ? result.queue_position : 0
          toast.success(
            depth > 0
              ? t(
                  'Queued in position {{position}}. It starts automatically when a slot frees up.',
                  { position: depth }
                )
              : t('Drawing {{count}} image(s) now…', {
                  count: result.image_count,
                })
          )
          topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : t('The request could not be submitted. Please try again.')
          )
        },
      })
    },
    [submit, t]
  )

  const handleReuse = useCallback(
    (task: ImageStudioTask) => {
      draft.applyPreset({
        prompt: task.prompt,
        params: task.params,
        referenceUrls: task.references,
      })
      setSelection((previous) => ({
        group: task.group || previous.group,
        model: task.model || previous.model,
      }))
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      toast.success(t('Settings loaded into the editor'))
    },
    [draft, t]
  )

  const polishModel = readPromptPolishModel(user?.setting)

  if (configQuery.isPending) {
    return (
      <Main>
        <div className='mx-auto flex w-full max-w-5xl flex-col gap-4 p-4'>
          <Skeleton className='h-6 w-40' />
          <Skeleton className='h-56 w-full rounded-2xl' />
          <Skeleton className='h-40 w-full rounded-xl' />
        </div>
      </Main>
    )
  }

  if (configQuery.isError || !config) {
    return (
      <Main>
        <EmptyState
          icon={ImageOffIcon}
          title={t('Image Studio is unavailable')}
          description={t(
            'The drawing service could not be reached. Please refresh the page or contact the administrator.'
          )}
          bordered
        />
      </Main>
    )
  }

  if (!config.enabled) {
    return (
      <Main>
        <EmptyState
          icon={ImageOffIcon}
          title={t('Image Studio is turned off')}
          description={t(
            'The administrator has disabled the drawing workbench. Please try again later.'
          )}
          bordered
        />
      </Main>
    )
  }

  return (
    <Main className='relative isolate'>
      {/* Ambient glow behind the workbench; purely decorative. */}
      <div
        className='pointer-events-none absolute inset-0 -z-10 overflow-hidden'
        aria-hidden='true'
      >
        <div className='bg-primary/10 absolute -top-32 -left-24 size-[28rem] rounded-full blur-3xl' />
        <div className='bg-chart-2/10 absolute top-1/3 -right-32 size-[32rem] rounded-full blur-3xl' />
      </div>
      {/* Below xl the editor and the gallery stack into one scrolling column;
          above it they become two independent columns so a long history never
          pushes the prompt out of reach. The gallery is its own container so
          its card grid follows the column width, not the viewport. */}
      <div className='mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-6 overflow-y-auto p-3 sm:p-5 xl:grid xl:grid-cols-[minmax(23rem,27rem)_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)] xl:gap-8 xl:overflow-hidden xl:px-6'>
        <div className='flex min-h-0 flex-col xl:overflow-y-auto xl:pr-1 xl:pb-1'>
          <div ref={topRef} className='flex flex-col'>
            <ImageStudioComposer
              config={config}
              groups={modelsQuery.groups}
              selectedModel={selection.model}
              selectedGroup={selection.group}
              submitting={submit.isPending}
              polishModel={polishModel}
              draft={draft}
              onModelChange={(model, group) => setSelection({ model, group })}
              onGroupChange={(group) =>
                // A model is offered per group, so a group switch must land on a
                // model that group actually serves instead of keeping a stale pair.
                setSelection((previous) => {
                  const models =
                    modelsQuery.groups.find((item) => item.group === group)
                      ?.models ?? []
                  const kept = models.some(
                    (item) => item.model === previous.model
                  )
                  return {
                    group,
                    model: kept ? previous.model : (models[0]?.model ?? ''),
                  }
                })
              }
              onSubmit={handleSubmit}
            />
          </div>
        </div>

        <div className='@container/history flex min-h-0 flex-col xl:overflow-y-auto xl:pb-1 xl:pl-1'>
          <ImageStudioHistory
            locale={toIntlLocale(i18n.resolvedLanguage || i18n.language)}
            retentionDays={config.retention_days}
            onReuse={handleReuse}
          />
        </div>
      </div>
    </Main>
  )
}

/**
 * The polish model lives in the user's own profile. Stored settings are a JSON
 * blob that the auth payload may hand over either parsed or as a string, so
 * both shapes are accepted and anything unreadable falls back to "unset".
 */
function readPromptPolishModel(
  setting: Record<string, unknown> | string | undefined
): string | undefined {
  if (!setting) return undefined
  let parsed: Record<string, unknown>
  if (typeof setting === 'string') {
    try {
      const value: unknown = JSON.parse(setting)
      if (!value || typeof value !== 'object') return undefined
      parsed = value as Record<string, unknown>
    } catch {
      return undefined
    }
  } else {
    parsed = setting
  }
  const model = parsed.prompt_polish_model
  return typeof model === 'string' && model.trim() ? model.trim() : undefined
}
