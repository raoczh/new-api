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
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ImagePlusIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { ImageStudioReference } from '../types'

export interface ImageStudioReferenceStripProps {
  references: ImageStudioReference[]
  maxReferences: number
  disabled?: boolean
  onAddFiles: (files: File[]) => void
  onRemove: (uid: string) => void
  onMove: (uid: string, direction: -1 | 1) => void
  onEditMask?: (uid: string) => void
}

export function ImageStudioReferenceStrip(
  props: ImageStudioReferenceStripProps
) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const full = props.references.length >= props.maxReferences

  return (
    <div className='flex flex-wrap items-start gap-2'>
      {props.references.map((reference, index) => (
        <div
          key={reference.uid}
          className='group/ref bg-muted/60 border-border/60 relative size-20 shrink-0 overflow-hidden rounded-xl border shadow-(--tc-shadow-sm)'
        >
          <img
            src={reference.url}
            alt={t('Reference image {{index}}', { index: index + 1 })}
            className='size-full object-cover'
          />
          {reference.uploading && (
            <div className='bg-background/60 absolute inset-0 flex items-center justify-center'>
              <Loader2Icon className='size-4 animate-spin' aria-hidden='true' />
            </div>
          )}
          {reference.error && (
            <div className='bg-destructive/10 text-destructive absolute inset-0 flex items-center justify-center p-1 text-center text-[9px] leading-tight'>
              {reference.error}
            </div>
          )}

          <div className='absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/45 p-0.5 opacity-0 transition-opacity group-hover/ref:opacity-100 focus-within:opacity-100'>
            <Button
              type='button'
              size='icon-sm'
              variant='ghost'
              className='text-white hover:bg-white/20 hover:text-white'
              aria-label={t('Move left')}
              disabled={index === 0 || props.disabled}
              onClick={() => props.onMove(reference.uid, -1)}
            >
              <ArrowLeftIcon className='size-3' aria-hidden='true' />
            </Button>
            {props.onEditMask && (
              <Button
                type='button'
                size='icon-sm'
                variant='ghost'
                className='text-white hover:bg-white/20 hover:text-white'
                aria-label={t('Paint a mask on this image')}
                disabled={
                  props.disabled ||
                  reference.uploading ||
                  Boolean(reference.error)
                }
                onClick={() => props.onEditMask?.(reference.uid)}
              >
                <PencilIcon className='size-3' aria-hidden='true' />
              </Button>
            )}
            <Button
              type='button'
              size='icon-sm'
              variant='ghost'
              className='text-white hover:bg-white/20 hover:text-white'
              aria-label={t('Move right')}
              disabled={index === props.references.length - 1 || props.disabled}
              onClick={() => props.onMove(reference.uid, 1)}
            >
              <ArrowRightIcon className='size-3' aria-hidden='true' />
            </Button>
            <Button
              type='button'
              size='icon-sm'
              variant='ghost'
              className='text-white hover:bg-white/20 hover:text-white'
              aria-label={t('Remove reference image')}
              disabled={props.disabled}
              onClick={() => props.onRemove(reference.uid)}
            >
              <Trash2Icon className='size-3' aria-hidden='true' />
            </Button>
          </div>
        </div>
      ))}

      {!full && (
        <button
          type='button'
          disabled={props.disabled}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary',
            'flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed transition-colors',
            'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <ImagePlusIcon className='size-4' aria-hidden='true' />
          <span className='text-[10px]'>{t('Reference')}</span>
          <span className='text-[9px] opacity-70'>
            {props.references.length}/{props.maxReferences}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type='file'
        accept='image/png,image/jpeg,image/webp,image/gif'
        multiple
        className='hidden'
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          if (files.length > 0) props.onAddFiles(files)
          // Reset so picking the same file twice still fires a change event.
          event.target.value = ''
        }}
      />
    </div>
  )
}
