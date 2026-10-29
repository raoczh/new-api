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
import { CheckIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { IMAGE_STUDIO_STYLE_PRESETS } from '../constants'

export interface ImageStudioStylePresetsProps {
  /** Current prompt, used to show which styles are already applied. */
  prompt: string
  disabled?: boolean
  onToggle: (preset: {
    id: string
    label: string
    text: string
    applied: boolean
  }) => void
}

/**
 * One-tap style chips. The preset text is appended rather than substituted so
 * a user-written subject always survives the click, and a second click removes
 * it again — otherwise the only way back is manual editing.
 *
 * The appended text is translated with the interface, so a Chinese UI yields a
 * Chinese prompt the user can read and refine instead of a hidden English tail.
 */
export function ImageStudioStylePresets(props: ImageStudioStylePresetsProps) {
  const { t } = useTranslation()

  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      {IMAGE_STUDIO_STYLE_PRESETS.map((preset) => {
        const text = t(preset.promptKey)
        const applied = props.prompt.includes(text)
        return (
          <button
            key={preset.id}
            type='button'
            disabled={props.disabled}
            aria-pressed={applied}
            onClick={() =>
              props.onToggle({
                id: preset.id,
                label: t(preset.labelKey),
                text,
                applied,
              })
            }
            title={applied ? t('Remove this style') : text}
            className={cn(
              'bg-muted/50 hover:bg-primary/5 hover:border-primary/40 hover:text-foreground',
              'text-muted-foreground flex h-7 items-center gap-1 rounded-full border border-transparent px-3 text-xs transition-all',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              applied &&
                'border-primary/50 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-medium'
            )}
          >
            {applied && <CheckIcon className='size-3' aria-hidden='true' />}
            {t(preset.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
