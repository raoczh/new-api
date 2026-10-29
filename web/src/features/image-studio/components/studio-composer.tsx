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
import { Loader2Icon, SparklesIcon, Wand2Icon } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ModelGroupSelector } from '@/components/model-group-selector'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { IMAGE_STUDIO_MAX_PROMPT_LENGTH } from '../constants'
import type { UseImageStudioDraftResult } from '../hooks/use-image-studio-draft'
import {
  buildGroupOptions,
  buildModelOptions,
  parseModelOptionValue,
} from '../lib/model-option'
import { clampImageCount } from '../lib/params'
import { polishPrompt } from '../lib/polish'
import type {
  ImageStudioConfig,
  ImageStudioGroupOption,
  ImageStudioTaskParams,
} from '../types'
import { ImageStudioMaskEditor } from './mask-editor'
import { ImageStudioParameterRow } from './parameter-row'
import { ImageStudioReferenceStrip } from './reference-strip'
import { ImageStudioStylePresets } from './style-presets'

/**
 * Count code points, which matches the server's rune budget. `Intl.Segmenter`
 * would be nicer for emoji families, but the project targets ES2022 where it
 * is not in the type library.
 */
function countPromptCharacters(value: string): number {
  return [...value].length
}

export interface ImageStudioComposerProps {
  config: ImageStudioConfig
  groups: ImageStudioGroupOption[]
  selectedModel: string
  selectedGroup: string
  submitting: boolean
  /** Model configured in the user profile; an empty value hides the button. */
  polishModel?: string
  draft: UseImageStudioDraftResult
  onModelChange: (model: string, group: string) => void
  onGroupChange: (group: string) => void
  onSubmit: (payload: {
    model: string
    group: string
    prompt: string
    params: ImageStudioTaskParams
    referenceKeys: string[]
    maskKey?: string
  }) => void
}

/**
 * The generation card: prompt, references, parameters and the submit row.
 *
 * Every piece of state lives in the draft hook owned by the page, so "reuse
 * these settings" from a history record can seed the exact same card.
 */
export function ImageStudioComposer(props: ImageStudioComposerProps) {
  const { t } = useTranslation()
  const [polishing, setPolishing] = useState(false)
  const [maskTarget, setMaskTarget] = useState<string | null>(null)
  const { draft, config } = props

  const modelOptions = buildModelOptions(
    props.groups.map((group) => ({ ...group, models: group.models })),
    t
  )
  const groupOptions = buildGroupOptions(
    props.groups.map((group) => ({ ...group, models: group.models })),
    t
  )
  const selectedValue = `${props.selectedGroup}\u0000${props.selectedModel}`

  const promptLength = useMemo(
    () => countPromptCharacters(draft.prompt),
    [draft.prompt]
  )
  const overLimit = promptLength > IMAGE_STUDIO_MAX_PROMPT_LENGTH
  const imageCount = clampImageCount(
    draft.params.n,
    config.max_images_per_request
  )
  const maskTargetReference = draft.references.find(
    (reference) => reference.uid === maskTarget
  )
  const blocked =
    props.submitting ||
    !props.selectedModel ||
    !draft.prompt.trim() ||
    draft.uploading ||
    overLimit

  const handleSubmit = () => {
    if (blocked) return
    props.onSubmit({
      model: props.selectedModel,
      group: props.selectedGroup,
      prompt: draft.prompt.trim(),
      params: {
        n: imageCount,
        size: draft.params.size,
        quality: draft.params.quality,
        output_format: draft.params.outputFormat,
        ...(draft.params.transparent ? { background: 'transparent' } : {}),
      },
      referenceKeys: draft.readyReferences.map((reference) => reference.key),
      maskKey: draft.mask?.key,
    })
  }

  const handlePolish = async () => {
    const model = props.polishModel
    if (!model || !draft.prompt.trim() || polishing) return
    setPolishing(true)
    try {
      const improved = await polishPrompt({
        model,
        group: props.selectedGroup,
        prompt: draft.prompt.trim(),
      })
      draft.setPrompt(improved)
      toast.success(t('Prompt polished'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('The prompt could not be polished. Please try again.')
      )
    } finally {
      setPolishing(false)
    }
  }

  const handleToggleStyle = (preset: {
    label: string
    text: string
    applied: boolean
  }) => {
    const current = draft.prompt.trim()
    if (preset.applied) {
      draft.setPrompt(removePromptSegment(current, preset.text))
      toast.success(t('Style “{{style}}” removed', { style: preset.label }))
      return
    }
    const next = current ? `${current}, ${preset.text}` : preset.text
    draft.setPrompt(next.slice(0, IMAGE_STUDIO_MAX_PROMPT_LENGTH))
    toast.success(t('Style “{{style}}” applied', { style: preset.label }))
  }

  return (
    <section className='flex flex-col gap-4'>
      <header className='flex items-start gap-3'>
        <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-[image:var(--tc-gradient)] text-white shadow-[0_10px_24px_-12px_var(--tc-gradient-from)]'>
          <SparklesIcon className='size-5' aria-hidden='true' />
        </span>
        <div className='flex min-w-0 flex-col gap-1'>
          <h1 className='text-xl font-semibold tracking-tight'>
            {t('AI Image')}
          </h1>
          <p className='text-muted-foreground text-xs leading-relaxed'>
            {t(
              'Describe what you want to see. Add a reference image to keep a subject, or paint a mask to redraw only one area.'
            )}
          </p>
        </div>
      </header>

      <div className='bg-card/90 border-border/60 flex flex-col overflow-hidden rounded-3xl border shadow-(--tc-shadow-md) backdrop-blur'>
        {/* The prompt sits in its own inset well so it reads as the primary
            input, with the settings grouped underneath. */}
        <div className='bg-muted/40 focus-within:border-primary/40 focus-within:bg-background focus-within:ring-primary/10 m-2 flex flex-col gap-2 rounded-2xl border border-transparent p-3 transition-colors focus-within:ring-4'>
          <Textarea
            value={draft.prompt}
            onChange={(event) => draft.setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) return
              if (event.nativeEvent.isComposing) return
              event.preventDefault()
              handleSubmit()
            }}
            placeholder={t(
              'A cozy reading nook by a rainy window, warm lamp light, plants, soft bokeh…'
            )}
            className='min-h-32 resize-none border-0 bg-transparent px-1 py-1 text-sm leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent'
            maxLength={IMAGE_STUDIO_MAX_PROMPT_LENGTH + 200}
            disabled={props.submitting}
            aria-label={t('Prompt')}
            aria-invalid={overLimit}
          />

          {draft.referenceError && (
            <p className='text-destructive text-[11px]'>
              {draft.referenceError}
            </p>
          )}
          {overLimit && (
            <p className='text-destructive text-[11px]'>
              {t('The prompt is longer than {{max}} characters.', {
                max: IMAGE_STUDIO_MAX_PROMPT_LENGTH,
              })}
            </p>
          )}

          <div className='text-muted-foreground flex items-center gap-2 text-[10px]'>
            <span className='hidden min-w-0 truncate sm:inline'>
              {t('Enter to generate · Shift + Enter for a new line')}
            </span>
            <span
              className={cn(
                'ml-auto tabular-nums',
                overLimit && 'text-destructive'
              )}
              aria-live='polite'
            >
              {promptLength} / {IMAGE_STUDIO_MAX_PROMPT_LENGTH}
            </span>
            {props.polishModel && (
              <Button
                type='button'
                variant='outline'
                size='xs'
                className='rounded-full'
                onClick={() => void handlePolish()}
                disabled={props.submitting || polishing || !draft.prompt.trim()}
                title={t('Rewrite the prompt with {{model}}', {
                  model: props.polishModel,
                })}
              >
                {polishing ? (
                  <Loader2Icon className='animate-spin' aria-hidden='true' />
                ) : (
                  <SparklesIcon className='text-primary' aria-hidden='true' />
                )}
                {t('Polish')}
              </Button>
            )}
          </div>
        </div>

        <div className='flex flex-col gap-4 px-4 pt-2 pb-4'>
          <ComposerSection title={t('Reference images')}>
            <ImageStudioReferenceStrip
              references={draft.references}
              maxReferences={config.max_reference_images}
              disabled={props.submitting}
              onAddFiles={draft.addFiles}
              onRemove={draft.removeReference}
              onMove={draft.moveReference}
              onEditMask={setMaskTarget}
            />
          </ComposerSection>

          {draft.mask && (
            <div className='border-primary/30 bg-primary/5 flex items-center gap-2 rounded-xl border p-1.5'>
              <img
                src={draft.mask.url}
                alt={t('Mask preview')}
                className='size-10 rounded object-cover'
              />
              <div className='min-w-0 flex-1'>
                <p className='text-xs font-medium'>{t('Mask applied')}</p>
                <p className='text-muted-foreground text-[10px]'>
                  {t('Only the painted area will be regenerated.')}
                </p>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='xs'
                onClick={() => draft.setMask(null)}
                disabled={props.submitting}
              >
                {t('Remove mask')}
              </Button>
            </div>
          )}

          <ComposerSection title={t('Style')}>
            <ImageStudioStylePresets
              prompt={draft.prompt}
              disabled={props.submitting}
              onToggle={handleToggleStyle}
            />
          </ComposerSection>

          <ComposerSection title={t('Parameters')}>
            <ImageStudioParameterRow
              draft={draft.params}
              maxImages={config.max_images_per_request}
              disabled={props.submitting}
              onChange={draft.patchParams}
            />
          </ComposerSection>
        </div>

        <div className='border-border/60 bg-muted/20 flex flex-col gap-3 border-t px-4 py-3'>
          <ModelGroupSelector
            selectedModel={selectedValue}
            models={modelOptions}
            onModelChange={(value) => {
              const parsed = parseModelOptionValue(value)
              props.onModelChange(parsed.model, parsed.group)
            }}
            selectedGroup={props.selectedGroup}
            groups={groupOptions}
            onGroupChange={props.onGroupChange}
            // The editor only generates with the selected group's models, so
            // opening the panel on every group would bury them under the rest.
            openGroupFilter={props.selectedGroup}
            disabled={props.submitting}
            className='max-w-full'
          />

          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='shrink-0 rounded-xl'
              onClick={draft.reset}
              disabled={props.submitting}
              aria-label={t('Reset')}
              title={t('Reset')}
            >
              <Wand2Icon aria-hidden='true' />
            </Button>
            <Button
              type='button'
              variant='gradient'
              className='h-11 flex-1 rounded-xl text-sm font-semibold'
              onClick={handleSubmit}
              disabled={blocked}
            >
              {props.submitting ? (
                <Loader2Icon className='animate-spin' aria-hidden='true' />
              ) : (
                <SparklesIcon aria-hidden='true' />
              )}
              {t('Generate {{count}}', { count: imageCount })}
            </Button>
          </div>

          {/* The editor column is narrow, so the billing note sits under the
              actions instead of competing with them for one line. */}
          <p className='text-muted-foreground text-center text-[10px]'>
            {t('Billed per output token · records kept {{days}} days', {
              days: config.retention_days,
            })}
          </p>
        </div>
      </div>

      <ImageStudioMaskEditor
        open={Boolean(maskTargetReference)}
        imageUrl={maskTargetReference?.url ?? ''}
        disabled={props.submitting}
        onOpenChange={(open) => {
          if (!open) setMaskTarget(null)
        }}
        onUploaded={(mask) => {
          draft.setMask({ key: mask.key, url: mask.url, uploading: false })
          setMaskTarget(null)
        }}
      />
    </section>
  )
}

interface ComposerSectionProps {
  title: string
  children: ReactNode
}

/** Labelled group inside the composer card: references, style, parameters. */
function ComposerSection(props: ComposerSectionProps) {
  return (
    <div className='flex flex-col gap-2'>
      <h2 className='text-muted-foreground text-[11px] font-medium tracking-wider uppercase'>
        {props.title}
      </h2>
      {props.children}
    </div>
  )
}

/**
 * Drop a style fragment from the prompt without touching the user's own words.
 * Handles the three shapes the append can produce: the fragment alone, a
 * trailing ", fragment", and a fragment followed by more text.
 */
function removePromptSegment(prompt: string, segment: string): string {
  const trimmed = prompt.trim()
  if (!segment) return trimmed
  if (trimmed === segment) return ''
  if (trimmed.endsWith(`, ${segment}`)) {
    return trimmed.slice(0, trimmed.length - segment.length - 2).trimEnd()
  }
  const index = trimmed.indexOf(segment)
  if (index < 0) return trimmed
  return `${trimmed.slice(0, index)}${trimmed.slice(index + segment.length)}`
    .replaceAll(/,\s*,/g, ',')
    .replaceAll(/^,\s*|,\s*$/g, '')
    .trim()
}
