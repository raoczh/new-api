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
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { IMAGE_STUDIO_QUALITY_PRESETS } from '../constants'
import type { ImageStudioParamDraft } from '../lib/params'
import { ImageStudioSizePicker } from './size-picker'

interface Choice {
  label: string
  value: string
}

export interface ImageStudioParameterRowProps {
  draft: ImageStudioParamDraft
  maxImages: number
  disabled?: boolean
  /** Prompt styles live beside the aspect ratio in the reference design. */
  onChange: (patch: Partial<ImageStudioParamDraft>) => void
}

export function ImageStudioParameterRow(props: ImageStudioParameterRowProps) {
  const { t } = useTranslation()

  const qualityChoices = useMemo<Choice[]>(
    () =>
      IMAGE_STUDIO_QUALITY_PRESETS.map((preset) => ({
        label: t(preset.labelKey),
        value: preset.value,
      })),
    [t]
  )
  const formatChoices = useMemo<Choice[]>(
    () => [
      { label: 'PNG', value: 'png' },
      { label: 'JPEG', value: 'jpeg' },
      { label: 'WebP', value: 'webp' },
    ],
    [t]
  )

  const qualityLabel =
    qualityChoices.find((choice) => choice.value === props.draft.quality)?.label ??
    props.draft.quality
  const formatLabel =
    formatChoices.find((choice) => choice.value === props.draft.outputFormat)
      ?.label ?? props.draft.outputFormat.toUpperCase()

  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      <ImageStudioSizePicker
        value={props.draft.size}
        disabled={props.disabled}
        onChange={(size) => props.onChange({ size })}
      />
      <ParameterChip
        label={t('Quality')}
        value={qualityLabel}
        disabled={props.disabled}
        options={qualityChoices}
        onSelect={(value) => props.onChange({ quality: value })}
      />
      <ParameterChip
        label={t('Count')}
        value={String(props.draft.n)}
        disabled={props.disabled}
        options={Array.from({ length: Math.max(1, props.maxImages) }, (_, index) => ({
          label: t('{{count}} images', { count: index + 1 }),
          value: String(index + 1),
        }))}
        onSelect={(value) => props.onChange({ n: Number(value) })}
      />
      <ParameterChip
        label={t('Format')}
        value={formatLabel}
        disabled={props.disabled}
        options={formatChoices}
        onSelect={(value) => props.onChange({ outputFormat: value })}
      />

      <label
        className={cn(
          'border-border/70 flex h-7 cursor-pointer items-center gap-2 rounded-full border px-2.5 text-[11px]',
          props.disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span>{t('Transparent background')}</span>
        <Switch
          size='sm'
          checked={props.draft.transparent}
          disabled={props.disabled}
          onCheckedChange={(checked) =>
            props.onChange({ transparent: checked === true })
          }
          aria-label={t('Transparent background')}
        />
      </label>
    </div>
  )
}

interface ParameterChipProps {
  label: string
  value: string
  options: Choice[]
  disabled?: boolean
  onSelect: (value: string) => void
}

function ParameterChip(props: ParameterChipProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type='button'
            disabled={props.disabled}
            aria-label={`${props.label}: ${props.value}`}
            className={cn(
              'border-border/70 hover:bg-accent flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px]',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <span className='text-muted-foreground'>{props.label}</span>
            <span className='font-medium'>{props.value}</span>
            <ChevronDownIcon className='text-muted-foreground size-3' aria-hidden='true' />
          </button>
        }
      />
      <PopoverContent className='w-44 p-0' align='start' sideOffset={6}>
        <Command>
          <CommandList className='max-h-64'>
            <CommandEmpty>—</CommandEmpty>
            <CommandGroup>
              {props.options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => props.onSelect(option.value)}
                  className='flex items-center justify-between gap-2 text-xs'
                >
                  <span>{option.label}</span>
                  {option.value === props.value && (
                    <CheckIcon className='size-3.5' aria-hidden='true' />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
