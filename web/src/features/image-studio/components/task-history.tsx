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
  CheckSquareIcon,
  HeartIcon,
  ImageOffIcon,
  ImagePlusIcon,
  Loader2Icon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { IMAGE_STUDIO_PAGE_SIZE } from '../constants'
import {
  useImageStudioTasks,
  useImageStudioTaskActions,
} from '../hooks/use-image-studio-tasks'
import {
  readLocalRecords,
  removeLocalRecords,
  saveLocalRecords,
} from '../lib/local-store'
import type { ImageStudioTask, ImageStudioTaskListQuery } from '../types'
import { ImageStudioTaskCard } from './task-card'
import { ImageStudioTaskDetail } from './task-detail'

/**
 * Card grid that follows the width of the column it sits in, not the viewport:
 * in the two-column workbench the gallery is roughly half the page, so
 * viewport breakpoints would keep it at two columns on a wide screen.
 */
const HISTORY_GRID_CLASSES =
  'grid grid-cols-2 gap-4 @min-[34rem]/history:grid-cols-3 @min-[52rem]/history:grid-cols-4 @min-[70rem]/history:grid-cols-5'

export interface ImageStudioHistoryProps {
  locale?: string
  /** Server retention window, shown in the empty state. */
  retentionDays: number
  onReuse: (task: ImageStudioTask) => void
}

/**
 * "生成记录" section: filter bar, batch operations and the record grid.
 *
 * The model filter is built from the models the server saw in this account's
 * records rather than from the pricing table, so it stays useful even after a
 * model is removed from the catalogue.
 */
export function ImageStudioHistory(props: ImageStudioHistoryProps) {
  const { t } = useTranslation()
  const [model, setModel] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const actions = useImageStudioTaskActions()

  const query = useMemo<ImageStudioTaskListQuery>(
    () => ({
      page,
      page_size: IMAGE_STUDIO_PAGE_SIZE,
      model: model || undefined,
      keyword: appliedKeyword || undefined,
      favorite: favoriteOnly || undefined,
    }),
    [page, model, appliedKeyword, favoriteOnly]
  )

  const list = useImageStudioTasks({ query })
  const owner = useAuthStore((state) => state.auth.user)
  const ownerId = owner?.id ? String(owner.id) : ''
  /**
   * Server unreachable: show what this browser kept instead of an error wall.
   * The cache is keyed by the exact query so a stale page never stands in for
   * a different filter, and it holds only this account's records.
   */
  const [localFallback, setLocalFallback] = useState<{
    queryKey: string
    items: ImageStudioTask[]
  } | null>(null)
  const [localStatus, setLocalStatus] = useState<'idle' | 'reading' | 'done'>(
    'idle'
  )

  const queryKey = JSON.stringify(query)
  const localItems =
    localFallback && localFallback.queryKey === queryKey
      ? localFallback.items
      : null

  useEffect(() => {
    if (!ownerId || !list.data?.items.length) return
    void saveLocalRecords(ownerId, list.data.items)
  }, [ownerId, list.data])

  useEffect(() => {
    if (!list.isError || !ownerId) return
    let active = true
    setLocalStatus('reading')
    void readLocalRecords(ownerId, props.retentionDays)
      .then((records) => {
        if (!active) return
        setLocalFallback({ queryKey, items: records })
      })
      .finally(() => {
        if (active) setLocalStatus('done')
      })
    return () => {
      active = false
    }
  }, [list.isError, ownerId, queryKey, props.retentionDays])

  const serverItems = list.data?.items
  const items = useMemo(() => {
    if (!localItems) return serverItems ?? []
    return localItems.filter((task) => {
      if (query.model && task.model !== query.model) return false
      if (query.favorite && !task.favorite) return false
      if (!query.keyword) return true
      return task.prompt.toLowerCase().includes(query.keyword.toLowerCase())
    })
  }, [localItems, serverItems, query.model, query.favorite, query.keyword])
  const models = useMemo(() => {
    if (!localItems) return list.data?.models ?? []
    return [...new Set(localItems.map((task) => task.model).filter(Boolean))]
  }, [localItems, list.data])
  const total = localItems ? items.length : (list.data?.total ?? 0)
  const pageCount = localItems
    ? 1
    : Math.max(1, Math.ceil(total / IMAGE_STUDIO_PAGE_SIZE))
  const selectedTasks = items.filter((task) => selected.has(task.id))
  const offline = localItems !== null

  let emptyHint = t(
    'Write a prompt to generate your first image. Every result is kept here for {{days}} days.',
    { days: props.retentionDays }
  )
  if (appliedKeyword || model || favoriteOnly) {
    emptyHint = t('No record matches these filters. Try clearing them.')
  } else if (offline) {
    emptyHint = t(
      'This device has no saved record for this page yet. They will appear after the server can be reached again.'
    )
  }

  const resetPage = () => {
    setPage(1)
    setSelected(new Set())
  }

  const handleSelectChange = (id: string, checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleBatch = (action: 'favorite' | 'unfavorite' | 'delete') => {
    const ids = [...selected]
    if (ids.length === 0) return
    actions.batch.mutate(
      { action, ids },
      {
        onSuccess: () => {
          setSelected(new Set())
          setSelectionMode(false)
          if (action === 'delete') void removeLocalRecords(ids)
          toast.success(
            action === 'delete'
              ? t('Deleted {{count}} records', { count: ids.length })
              : t('Updated {{count}} records', { count: ids.length })
          )
        },
      }
    )
  }

  const handleToggleFavorite = (task: ImageStudioTask) => {
    actions.batch.mutate({
      action: task.favorite ? 'unfavorite' : 'favorite',
      ids: [task.id],
    })
  }

  return (
    <section className='flex flex-col gap-4'>
      <div className='bg-background/80 sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 px-1 py-1 backdrop-blur'>
        <h2 className='flex items-baseline gap-2 text-base font-semibold tracking-tight'>
          {t('Generation history')}
          <span className='bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums'>
            {t('{{count}} total', { count: total })}
          </span>
        </h2>

        <div className='ml-auto flex flex-wrap items-center gap-1.5'>
          <div className='relative'>
            <SearchIcon
              className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2'
              aria-hidden='true'
            />
            <Input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value)
                if (event.target.value === '') {
                  setAppliedKeyword('')
                  resetPage()
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                setAppliedKeyword(keyword.trim())
                resetPage()
              }}
              placeholder={t('Search descriptions')}
              aria-label={t('Search descriptions')}
              className='h-8 w-44 rounded-full pl-7 text-xs'
            />
            {keyword && (
              <button
                type='button'
                className='text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2'
                aria-label={t('Clear search')}
                onClick={() => {
                  setKeyword('')
                  setAppliedKeyword('')
                  resetPage()
                }}
              >
                <XIcon className='size-3.5' aria-hidden='true' />
              </button>
            )}
          </div>

          <NativeSelect
            size='sm'
            value={model}
            aria-label={t('Filter by model')}
            className='w-36'
            onChange={(event) => {
              setModel(event.target.value)
              resetPage()
            }}
          >
            <NativeSelectOption value=''>{t('All models')}</NativeSelectOption>
            {models.map((name) => (
              <NativeSelectOption key={name} value={name}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <Button
            type='button'
            size='sm'
            variant={favoriteOnly ? 'secondary' : 'outline'}
            aria-pressed={favoriteOnly}
            onClick={() => {
              setFavoriteOnly((previous) => !previous)
              resetPage()
            }}
          >
            <HeartIcon
              className={cn('size-3.5', favoriteOnly && 'fill-current')}
              aria-hidden='true'
            />
            {t('Favorites')}
          </Button>

          <Button
            type='button'
            size='sm'
            variant={selectionMode ? 'secondary' : 'outline'}
            aria-pressed={selectionMode}
            disabled={offline}
            title={
              offline
                ? t(
                    'Batch actions need the server. They come back once it can be reached.'
                  )
                : undefined
            }
            onClick={() => {
              setSelectionMode((previous) => !previous)
              setSelected(new Set())
            }}
          >
            <CheckSquareIcon className='size-3.5' aria-hidden='true' />
            {t('Select')}
          </Button>
        </div>
      </div>

      {offline && (
        <div className='bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs'>
          <ImageOffIcon className='size-3.5 shrink-0' aria-hidden='true' />
          <p className='text-muted-foreground flex-1'>
            {t(
              'Showing the records saved on this device. The server could not be reached.'
            )}
          </p>
          <Button
            type='button'
            size='xs'
            variant='outline'
            onClick={() => void list.refetch()}
          >
            {t('Retry')}
          </Button>
        </div>
      )}

      {selectionMode && !offline && (
        <div className='bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5'>
          <span className='text-xs'>
            {t('{{count}} selected', { count: selectedTasks.length })}
          </span>
          <Button
            type='button'
            size='xs'
            variant='outline'
            disabled={selected.size === 0 || actions.batch.isPending}
            onClick={() =>
              setSelected(
                items.length === selected.size
                  ? new Set()
                  : new Set(items.map((task) => task.id))
              )
            }
          >
            {items.length === selected.size
              ? t('Clear selection')
              : t('Select this page')}
          </Button>
          <Button
            type='button'
            size='xs'
            variant='outline'
            disabled={selected.size === 0 || actions.batch.isPending}
            onClick={() => handleBatch('favorite')}
          >
            <HeartIcon className='size-3' aria-hidden='true' />
            {t('Favorite')}
          </Button>
          <Button
            type='button'
            size='xs'
            variant='outline'
            disabled={selected.size === 0 || actions.batch.isPending}
            onClick={() => handleBatch('unfavorite')}
          >
            {t('Unfavorite')}
          </Button>
          <Button
            type='button'
            size='xs'
            variant='destructive'
            disabled={selected.size === 0 || actions.batch.isPending}
            onClick={() => setConfirmDelete(true)}
          >
            {actions.batch.isPending ? (
              <Loader2Icon className='size-3 animate-spin' aria-hidden='true' />
            ) : (
              <Trash2Icon className='size-3' aria-hidden='true' />
            )}
            {t('Delete')}
          </Button>
        </div>
      )}

      {list.isError && !offline && localStatus === 'done' && (
        <div className='text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm'>
          <ImageOffIcon className='size-6' aria-hidden='true' />
          <p>
            {t('The records could not be loaded. Please refresh the page.')}
          </p>
          <p className='max-w-sm text-xs'>
            {t('No copy of these records was saved on this device.')}
          </p>
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={() => void list.refetch()}
          >
            {t('Retry')}
          </Button>
        </div>
      )}

      {(list.isPending || (list.isError && localStatus === 'reading')) && (
        <div className={HISTORY_GRID_CLASSES}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className='aspect-[4/5] rounded-2xl' />
          ))}
        </div>
      )}

      {!list.isPending &&
        (offline || !list.isError) &&
        localStatus !== 'reading' &&
        items.length === 0 && (
          <div className='text-muted-foreground from-primary/5 via-chart-2/5 flex flex-col items-center gap-2 rounded-3xl border border-dashed bg-linear-to-br to-transparent px-4 py-20 text-center'>
            <span className='bg-background flex size-14 items-center justify-center rounded-2xl border shadow-(--tc-shadow-md)'>
              <ImagePlusIcon
                className='text-primary size-6'
                aria-hidden='true'
              />
            </span>
            <p className='text-foreground mt-1 text-sm font-semibold'>
              {t('No records yet')}
            </p>
            <p className='max-w-sm text-xs'>{emptyHint}</p>
          </div>
        )}

      {items.length > 0 && (
        <div className={HISTORY_GRID_CLASSES}>
          {items.map((task) => (
            <ImageStudioTaskCard
              key={task.id}
              task={task}
              locale={props.locale}
              selected={selected.has(task.id)}
              selectionMode={selectionMode}
              onSelectChange={handleSelectChange}
              onOpen={(value) => setDetailId(value.id)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      {pageCount > 1 && !offline && (
        <div className='flex items-center justify-center gap-2 pt-1'>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={page <= 1}
            onClick={() => {
              setPage((previous) => Math.max(1, previous - 1))
              setSelected(new Set())
            }}
          >
            {t('Previous page')}
          </Button>
          <span className='text-muted-foreground text-xs'>
            {t('Page {{page}} of {{total}}', { page, total: pageCount })}
          </span>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={page >= pageCount}
            onClick={() => {
              setPage((previous) => previous + 1)
              setSelected(new Set())
            }}
          >
            {t('Next page')}
          </Button>
        </div>
      )}

      <ImageStudioTaskDetail
        taskId={detailId}
        locale={props.locale}
        retentionDays={props.retentionDays}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
        onReuse={props.onReuse}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Delete {{count}} records?', { count: selected.size })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'The generated images will be removed from the server right away. This cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false)
                handleBatch('delete')
              }}
            >
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
