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
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { Progress } from '@/components/ui/progress'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative, formatTimestampToDate } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getPromotionTaskStatus } from '../api'
import type {
  PromotionTask,
  PromotionTaskResult,
  PromotionTaskState,
  PromotionTaskStatus,
} from '../types'
import { usePromotion } from './promotion-provider'

const ACTIVE_POLL_INTERVAL_MS = 5000

const STATUS_VARIANT: Record<PromotionTaskStatus, StatusVariant> = {
  pending: 'warning',
  running: 'info',
  succeeded: 'success',
  failed: 'danger',
}

const PROGRESS_CLASS: Record<PromotionTaskStatus, string> = {
  pending: '[&_[data-slot=progress-indicator]]:bg-amber-500',
  running: '[&_[data-slot=progress-indicator]]:bg-sky-500',
  succeeded: '[&_[data-slot=progress-indicator]]:bg-emerald-500',
  failed: '[&_[data-slot=progress-indicator]]:bg-destructive',
}

function isTaskActive(task: PromotionTask | null): boolean {
  return task?.status === 'pending' || task?.status === 'running'
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null
}

type PromotionTaskCardProps = {
  kind: 'fetch' | 'email'
  task: PromotionTask | null
}

function PromotionTaskCard(props: PromotionTaskCardProps) {
  const { t, i18n } = useTranslation()
  const task = props.task
  const active = isTaskActive(task)
  const state: PromotionTaskState = task?.state ?? {}
  const result: PromotionTaskResult = task?.result ?? {}

  const title =
    props.kind === 'fetch' ? t('Author harvest') : t('Invitation emails')
  const progress = asNumber(state.progress)
  const processed = asNumber(state.processed) ?? 0
  const total = asNumber(state.total) ?? 0
  const currentRepository = state.current_repository?.trim()

  const stats =
    props.kind === 'fetch'
      ? [
          {
            label: t('Authors found'),
            value: asNumber(result.authors_found ?? state.authors_seen),
          },
          { label: t('Repositories'), value: asNumber(result.repositories) },
          { label: t('Inserted'), value: asNumber(result.inserted) },
          {
            label: t('Skipped'),
            value:
              result.skipped_duplicate == null &&
              result.skipped_filtered == null
                ? null
                : (result.skipped_duplicate ?? 0) +
                  (result.skipped_filtered ?? 0),
          },
        ]
      : [
          { label: t('Sent'), value: asNumber(result.sent ?? state.sent) },
          {
            label: t('Failed'),
            value: asNumber(result.failed ?? state.failed),
          },
          {
            label: t('Skipped'),
            value: asNumber(result.skipped ?? state.skipped),
          },
        ]
  const visibleStats = stats.filter(
    (stat): stat is { label: string; value: number } => stat.value != null
  )

  const statsNode =
    visibleStats.length > 0
      ? visibleStats.map((stat) => (
          <span key={stat.label} className='text-muted-foreground'>
            {stat.label}{' '}
            <span className='text-foreground font-medium tabular-nums'>
              {stat.value}
            </span>
          </span>
        ))
      : null

  // The reasons behind the skip number. Without them a large total reads as a
  // failed run instead of the expected outcome of the configured filters.
  const skipReasons: string[] = []
  if (props.kind === 'fetch') {
    const reasons: [number | undefined, string][] = [
      [result.skipped_invalid_email, t('Invalid or machine address')],
      [result.skipped_non_chinese_project, t('Non-Chinese project')],
      [result.skipped_non_chinese_author, t('Non-Chinese author')],
      [result.skipped_over_limit, t('Over author limit')],
      [result.skipped_duplicate, t('Duplicate')],
      [result.repository_errors, t('Repository errors')],
    ]
    for (const [value, label] of reasons) {
      if ((value ?? 0) > 0) {
        skipReasons.push(`${label} ${value}`)
      }
    }
  }

  const skipReasonsNode =
    skipReasons.length > 0 ? (
      <span className='text-muted-foreground'>{skipReasons.join(' · ')}</span>
    ) : null

  let body: ReactNode
  if (!task || task.status === 'pending') {
    body = (
      <p className='text-muted-foreground text-xs'>
        {task ? t('Waiting to start') : t('No task has run yet')}
      </p>
    )
  } else if (active) {
    body = (
      <div className='space-y-1.5'>
        <Progress
          value={progress ?? 0}
          className={cn('gap-2', PROGRESS_CLASS[task.status])}
        />
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
          <span className='text-muted-foreground tabular-nums'>
            {t('Processed')} {processed}/{total}
          </span>
          {props.kind === 'fetch' && currentRepository ? (
            <span className='text-muted-foreground min-w-0 truncate'>
              {t('Current repository')}{' '}
              <span className='text-foreground font-mono'>
                {currentRepository}
              </span>
            </span>
          ) : null}
          {statsNode}
        </div>
      </div>
    )
  } else {
    body = (
      <div className='space-y-1'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
          {statsNode ?? (
            <span className='text-muted-foreground'>
              {t('No task has run yet')}
            </span>
          )}
          {props.kind === 'fetch' && result.rate_limited ? (
            <StatusBadge label={t('Rate limited')} variant='warning' />
          ) : null}
          {props.kind === 'email' &&
          result.skipped_reason === 'daily_limit_reached' ? (
            <span className='text-muted-foreground'>
              {t('Daily send limit reached')}
            </span>
          ) : null}
          {props.kind === 'email' &&
          result.skipped_reason === 'auto_send_disabled' ? (
            <span className='text-muted-foreground'>
              {t('Automatic sending is disabled')}
            </span>
          ) : null}
        </div>
        {skipReasonsNode ? (
          <div className='text-xs'>{skipReasonsNode}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div className='bg-card min-w-0 space-y-2 rounded-lg border p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='truncate text-sm font-medium'>{title}</span>
          <StatusBadge
            label={task ? t(task.status) : t('Idle')}
            variant={task ? STATUS_VARIANT[task.status] : 'neutral'}
            pulse={task?.status === 'running'}
          />
        </div>
        {task ? (
          <span
            className='text-muted-foreground shrink-0 text-xs'
            title={formatTimestampToDate(task.updated_at)}
          >
            {formatTimestampRelative(
              task.updated_at,
              'seconds',
              toIntlLocale(i18n.language)
            )}
          </span>
        ) : null}
      </div>
      {body}
      {task?.error ? (
        <p className='text-destructive line-clamp-2 text-xs' title={task.error}>
          {task.error}
        </p>
      ) : null}
    </div>
  )
}

// PromotionTaskMonitor shows whether a harvest or a delivery run is in
// progress and how far it has got. It polls only while a task is active.
export function PromotionTaskMonitor() {
  const { t } = useTranslation()
  const { refreshTrigger, triggerRefresh } = usePromotion()

  const statusQuery = useQuery({
    queryKey: ['open-source-promotion-task-status', refreshTrigger],
    queryFn: async () => requireServerSuccess(await getPromotionTaskStatus()),
    staleTime: 0,
    // Keep the last snapshot on screen while a refreshed key loads, so the
    // cards never collapse and push the table around.
    placeholderData: (previousData) => previousData,
    refetchInterval: (query) => {
      const snapshot = query.state.data?.data
      if (!snapshot) return false
      return isTaskActive(snapshot.fetch) || isTaskActive(snapshot.email)
        ? ACTIVE_POLL_INTERVAL_MS
        : false
    },
  })

  const snapshot = statusQuery.data?.data
  const hasActiveTask =
    isTaskActive(snapshot?.fetch ?? null) ||
    isTaskActive(snapshot?.email ?? null)
  const previousActive = useRef(false)

  // A finished run changes the recipient list and the statistics, so refresh
  // them once the monitor sees the transition.
  useEffect(() => {
    if (previousActive.current && !hasActiveTask) {
      triggerRefresh()
    }
    previousActive.current = hasActiveTask
  }, [hasActiveTask, triggerRefresh])

  if (statusQuery.isLoading) {
    return null
  }

  if (!snapshot) {
    return (
      <div className='text-muted-foreground shrink-0 rounded-lg border border-dashed px-3 py-2 text-xs'>
        {t('Failed to load the task status')}
      </div>
    )
  }

  return (
    <section
      className='grid shrink-0 gap-2 sm:grid-cols-2'
      aria-live='polite'
      aria-busy={hasActiveTask}
    >
      <PromotionTaskCard kind='fetch' task={snapshot.fetch} />
      <PromotionTaskCard kind='email' task={snapshot.email} />
    </section>
  )
}
