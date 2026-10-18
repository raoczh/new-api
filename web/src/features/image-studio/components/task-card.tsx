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
import { HeartIcon, ImageOffIcon, Loader2Icon, XCircleIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import { IMAGE_STUDIO_STATUS } from '../constants'
import {
  describeTaskParams,
  describeTaskTime,
  hasVisibleImages,
  taskStatusLabelKey,
} from '../lib/task-view'
import type { ImageStudioTask } from '../types'

export interface ImageStudioTaskCardProps {
  task: ImageStudioTask
  locale?: string
  selected: boolean
  selectionMode: boolean
  onSelectChange: (id: string, selected: boolean) => void
  onOpen: (task: ImageStudioTask) => void
  onToggleFavorite: (task: ImageStudioTask) => void
}

export function ImageStudioTaskCard(props: ImageStudioTaskCardProps) {
  const { t } = useTranslation()
  const { task } = props
  const cover = task.images[0]
  const active =
    task.status === IMAGE_STUDIO_STATUS.QUEUED ||
    task.status === IMAGE_STUDIO_STATUS.RUNNING

  return (
    <div
      className={cn(
        'group/card bg-card relative flex flex-col overflow-hidden rounded-xl border transition-colors',
        props.selected
          ? 'border-primary/60 ring-primary/20 ring-2'
          : 'border-border/60 hover:border-border'
      )}
    >
      <button
        type='button'
        className='relative aspect-square w-full overflow-hidden bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
        onClick={() => props.onOpen(task)}
        aria-label={t('Open details for {{prompt}}', {
          prompt: task.prompt.slice(0, 40),
        })}
      >
        {hasVisibleImages(task) && cover ? (
          <img
            src={cover}
            alt={task.prompt}
            loading='lazy'
            decoding='async'
            className='size-full object-cover transition-transform duration-300 group-hover/card:scale-[1.02]'
          />
        ) : (
          <div className='text-muted-foreground flex size-full flex-col items-center justify-center gap-2 px-4 text-center'>
            {active ? (
              <>
                <Loader2Icon className='size-6 animate-spin' aria-hidden='true' />
                <span className='text-xs'>{t(taskStatusLabelKey(task.status))}</span>
              </>
            ) : (
              <>
                {task.status === IMAGE_STUDIO_STATUS.FAILED ? (
                  <XCircleIcon className='text-destructive size-6' aria-hidden='true' />
                ) : (
                  <ImageOffIcon className='size-6' aria-hidden='true' />
                )}
                <span className='line-clamp-2 text-xs'>
                  {task.error || t('No image was returned')}
                </span>
              </>
            )}
          </div>
        )}

        {task.favorite && (
          <span className='bg-background/85 text-destructive absolute top-2 left-2 rounded-full p-1 shadow-sm'>
            <HeartIcon className='size-3.5 fill-current' aria-hidden='true' />
          </span>
        )}
        {active && (
          <span className='bg-background/85 text-foreground absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm'>
            <Loader2Icon className='size-3 animate-spin' aria-hidden='true' />
            {t(taskStatusLabelKey(task.status))}
          </span>
        )}
      </button>

      {(props.selectionMode || props.selected) && (
        <div className='bg-background/90 absolute top-2 left-2 rounded-md p-1.5 shadow-sm'>
          <Checkbox
            checked={props.selected}
            onCheckedChange={(checked) =>
              props.onSelectChange(task.id, checked === true)
            }
            aria-label={t('Select this record')}
          />
        </div>
      )}

      <div className='flex min-w-0 flex-col gap-1 p-2.5'>
        <p className='line-clamp-2 min-h-8 text-xs leading-4' title={task.prompt}>
          {task.prompt || t('No prompt')}
        </p>
        <div className='text-muted-foreground flex items-center gap-1.5 text-[10px]'>
          <span className='truncate font-mono'>{task.model}</span>
          <span aria-hidden='true'>·</span>
          <span className='shrink-0'>{describeTaskTime(task.created_at, props.locale)}</span>
        </div>
        {!active && (
          <div className='text-muted-foreground flex items-center justify-between gap-2 text-[10px]'>
            <span className='truncate'>{describeTaskParams(task)}</span>
            {task.images.length > 1 && (
              <Badge variant='outline' className='h-4 shrink-0 px-1.5 text-[9px]'>
                {t('{{count}} images', { count: task.images.length })}
              </Badge>
            )}
          </div>
        )}
      </div>

      <button
        type='button'
        className={cn(
          'absolute right-2 bottom-2 rounded-full p-1.5 shadow-sm transition-colors',
          'bg-background/85 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          task.favorite ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'
        )}
        aria-label={task.favorite ? t('Remove from favorites') : t('Add to favorites')}
        aria-pressed={task.favorite}
        onClick={(event) => {
          event.stopPropagation()
          props.onToggleFavorite(task)
        }}
      >
        <HeartIcon
          className={cn('size-3.5', task.favorite && 'fill-current')}
          aria-hidden='true'
        />
      </button>
    </div>
  )
}
