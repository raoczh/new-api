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
  CopyIcon,
  DownloadIcon,
  HeartIcon,
  ImageOffIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
  XCircleIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { useImageStudioTask, useImageStudioTaskActions } from '../hooks/use-image-studio-tasks'
import { copyText, downloadImage } from '../lib/download'
import { readLocalRecords, removeLocalRecords } from '../lib/local-store'
import {
  describeElapsed,
  describeTaskParams,
  describeTaskTime,
  hasVisibleImages,
  isActiveTask,
  taskDownloadName,
  taskStatusLabelKey,
} from '../lib/task-view'
import type { ImageStudioTask } from '../types'

export interface ImageStudioTaskDetailProps {
  taskId: string | null
  locale?: string
  /** Used to drop local copies past the retention window. */
  retentionDays?: number
  onOpenChange: (open: boolean) => void
  onReuse: (task: ImageStudioTask) => void
}

/**
 * Detail panel for one record. It fetches the record by id instead of taking
 * the row from the grid, so a queued task keeps refreshing after the grid's
 * poll interval has backed off. When the server cannot answer, the copy this
 * browser cached is shown instead and the actions that need the server hide.
 */
export function ImageStudioTaskDetail(props: ImageStudioTaskDetailProps) {
  const { t } = useTranslation()
  const query = useImageStudioTask(props.taskId)
  const actions = useImageStudioTaskActions()
  const [activeIndex, setActiveIndex] = useState(0)
  const [localTask, setLocalTask] = useState<ImageStudioTask | null>(null)
  const [localLoading, setLocalLoading] = useState(false)
  const owner = useAuthStore((state) => state.auth.user)
  const ownerId = owner?.id ? String(owner.id) : ''

  useEffect(() => {
    setActiveIndex(0)
    setLocalTask(null)
  }, [props.taskId])

  useEffect(() => {
    const id = props.taskId
    if (!id || !query.isError || !ownerId) return
    let active = true
    setLocalLoading(true)
    void readLocalRecords(ownerId, props.retentionDays ?? 7)
      .then((records) => {
        if (active) setLocalTask(records.find((item) => item.id === id) ?? null)
      })
      .finally(() => {
        if (active) setLocalLoading(false)
      })
    return () => {
      active = false
    }
  }, [props.taskId, query.isError, ownerId, props.retentionDays])

  const task = query.data ?? localTask
  const offline = !query.data && localTask !== null

  const handleDownload = async (index: number) => {
    if (!task) return
    try {
      await downloadImage(task.images[index], taskDownloadName(task, index))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('The image could not be downloaded')
      )
    }
  }

  const handleCopyPrompt = async () => {
    if (!task) return
    try {
      await copyText(task.prompt)
      toast.success(t('Prompt copied'))
    } catch {
      toast.error(t('The prompt could not be copied'))
    }
  }

  const handleDelete = () => {
    if (!task) return
    actions.remove.mutate(task.id, {
      onSuccess: () => {
        void removeLocalRecords([task.id])
        toast.success(t('Record deleted'))
        props.onOpenChange(false)
      },
    })
  }

  const handleRemoveLocal = () => {
    if (!task) return
    void removeLocalRecords([task.id])
    setLocalTask(null)
    toast.success(t('Removed from this device'))
    props.onOpenChange(false)
  }

  const handleFavorite = () => {
    if (!task) return
    actions.batch.mutate({
      action: task.favorite ? 'unfavorite' : 'favorite',
      ids: [task.id],
    })
  }

  const handleCancel = () => {
    if (!task) return
    actions.cancel.mutate(task.id)
  }

  const image = task?.images[activeIndex]
  const busy = actions.remove.isPending || actions.batch.isPending || actions.cancel.isPending

  return (
    <Sheet open={Boolean(props.taskId)} onOpenChange={props.onOpenChange}>
      <SheetContent side='right' className='sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>{t('Generation details')}</SheetTitle>
          <SheetDescription>
            {task
              ? t('Created {{time}}', {
                  time: describeTaskTime(task.created_at, props.locale),
                })
              : t('Loading this record…')}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-y-auto px-4 pb-4'>
          {(query.isPending || (query.isError && localLoading)) && (
            <div className='flex flex-col gap-3'>
              <Skeleton className='aspect-square w-full rounded-xl' />
              <Skeleton className='h-4 w-2/3' />
              <Skeleton className='h-4 w-1/2' />
            </div>
          )}

          {query.isError && !offline && !localLoading && (
            <div className='text-muted-foreground flex flex-col items-center gap-2 py-16 text-center text-sm'>
              <XCircleIcon className='text-destructive size-6' aria-hidden='true' />
              <p>{t('This record could not be loaded. It may have expired.')}</p>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => void query.refetch()}
              >
                <RefreshCwIcon className='size-3.5' aria-hidden='true' />
                {t('Retry')}
              </Button>
            </div>
          )}

          {task && (
            <div className='flex flex-col gap-4'>
              {offline && (
                <p className='bg-muted/50 text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs'>
                  {t(
                    'Showing the copy saved on this device. The server could not be reached.'
                  )}
                </p>
              )}
              <div className='bg-muted/40 relative overflow-hidden rounded-xl border'>
                {image ? (
                  <img
                    src={image}
                    alt={task.prompt}
                    className='max-h-[60vh] w-full object-contain'
                  />
                ) : (
                  <div className='text-muted-foreground flex aspect-square flex-col items-center justify-center gap-2 px-6 text-center'>
                    {isActiveTask(task) ? (
                      <>
                        <Loader2Icon className='size-7 animate-spin' aria-hidden='true' />
                        <p className='text-sm'>{t(taskStatusLabelKey(task.status))}</p>
                        <p className='text-xs'>
                          {t(
                            'The queue is working on it. This panel updates automatically.'
                          )}
                        </p>
                      </>
                    ) : (
                      <>
                        <ImageOffIcon className='size-7' aria-hidden='true' />
                        <p className='text-sm'>
                          {task.error || t('No image was returned')}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {task.images.length > 1 && (
                <div className='flex flex-wrap gap-2'>
                  {task.images.map((url, index) => (
                    <button
                      key={url}
                      type='button'
                      onClick={() => setActiveIndex(index)}
                      className={cn(
                        'size-14 overflow-hidden rounded-md border transition-colors',
                        index === activeIndex
                          ? 'border-primary ring-primary/25 ring-2'
                          : 'border-border/60 hover:border-border'
                      )}
                      aria-label={t('Show image {{index}}', { index: index + 1 })}
                      aria-pressed={index === activeIndex}
                    >
                      <img
                        src={url}
                        alt=''
                        loading='lazy'
                        className='size-full object-cover'
                      />
                    </button>
                  ))}
                </div>
              )}

              {hasVisibleImages(task) && (
                <div className='flex flex-wrap gap-2'>
                  <Button
                    type='button'
                    size='sm'
                    onClick={() => void handleDownload(activeIndex)}
                  >
                    <DownloadIcon className='size-3.5' aria-hidden='true' />
                    {t('Download')}
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={handleCopyPrompt}
                  >
                    <CopyIcon className='size-3.5' aria-hidden='true' />
                    {t('Copy prompt')}
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => props.onReuse(task)}
                  >
                    <RefreshCwIcon className='size-3.5' aria-hidden='true' />
                    {t('Reuse these settings')}
                  </Button>
                </div>
              )}

              <div className='flex flex-col gap-2 rounded-lg border p-3 text-xs'>
                <DetailRow label={t('Status')}>
                  <Badge variant='outline' className='h-5 px-1.5 text-[10px]'>
                    {t(taskStatusLabelKey(task.status))}
                  </Badge>
                </DetailRow>
                <DetailRow label={t('Model')}>
                  <span className='font-mono'>{task.model}</span>
                </DetailRow>
                <DetailRow label={t('Group')}>{task.group || '-'}</DetailRow>
                <DetailRow label={t('Parameters')}>
                  {describeTaskParams(task) || '-'}
                </DetailRow>
                <DetailRow label={t('Duration')}>
                  {describeElapsed(task.elapsed_ms)}
                </DetailRow>
                <DetailRow label={t('Charged')}>
                  {formatQuotaWithCurrency(task.quota, {
                    digitsLarge: 4,
                    digitsSmall: 6,
                  })}
                </DetailRow>
                <DetailRow label={t('Expires')}>
                  {task.expires_at
                    ? describeTaskTime(task.expires_at, props.locale)
                    : '-'}
                </DetailRow>
              </div>

              <div className='rounded-lg border p-3'>
                <p className='text-muted-foreground mb-1 text-[11px]'>
                  {t('Prompt')}
                </p>
                <p className='text-sm leading-6 whitespace-pre-wrap'>
                  {task.prompt || t('No prompt')}
                </p>
              </div>

              {task.references.length > 0 && (
                <div className='flex flex-col gap-1.5'>
                  <p className='text-muted-foreground text-[11px]'>
                    {t('Reference images')}
                  </p>
                  <div className='flex flex-wrap gap-2'>
                    {task.references.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target='_blank'
                        rel='noreferrer'
                        className='size-16 overflow-hidden rounded-md border'
                      >
                        <img
                          src={url}
                          alt=''
                          loading='lazy'
                          className='size-full object-cover'
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {task.error && hasVisibleImages(task) && (
                <p className='text-destructive text-xs'>{task.error}</p>
              )}
            </div>
          )}
        </div>

        {task && (
          <div className='flex flex-wrap items-center gap-2 border-t px-4 py-3'>
            {offline ? (
              <Button
                type='button'
                size='sm'
                variant='outline'
                className='ml-auto'
                onClick={handleRemoveLocal}
              >
                <Trash2Icon className='size-3.5' aria-hidden='true' />
                {t('Remove from this device')}
              </Button>
            ) : (
              <>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={busy}
                  onClick={handleFavorite}
                  aria-pressed={task.favorite}
                >
                  <HeartIcon
                    className={cn('size-3.5', task.favorite && 'fill-current')}
                    aria-hidden='true'
                  />
                  {task.favorite ? t('Favorited') : t('Add to favorites')}
                </Button>
                {isActiveTask(task) && (
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={busy}
                    onClick={handleCancel}
                  >
                    <XCircleIcon className='size-3.5' aria-hidden='true' />
                    {t('Cancel generation')}
                  </Button>
                )}
                <Button
                  type='button'
                  size='sm'
                  variant='destructive'
                  className='ml-auto'
                  disabled={busy}
                  onClick={handleDelete}
                >
                  {actions.remove.isPending ? (
                    <Loader2Icon className='size-3.5 animate-spin' aria-hidden='true' />
                  ) : (
                    <Trash2Icon className='size-3.5' aria-hidden='true' />
                  )}
                  {t('Delete')}
                </Button>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <span className='text-muted-foreground shrink-0'>{props.label}</span>
      <span className='truncate text-right'>{props.children}</span>
    </div>
  )
}
