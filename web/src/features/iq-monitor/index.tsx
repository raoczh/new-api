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
import { Play, RefreshCw } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { PublicLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toIntlLocale } from '@/i18n/languages'
import { cn } from '@/lib/utils'

import { HistoryList } from './components/history-list'
import { ResultDetailDialog } from './components/result-detail-dialog'
import { ResultMeta } from './components/result-meta'
import { ResultPreview } from './components/result-preview'
import { VerdictBadge, VerdictReasonList } from './components/verdict-badge'
import { VERDICT_CONFIG } from './constants'
import {
  useDeleteIQProbeResult,
  useIQMonitorOverview,
  useRunIQProbe,
} from './hooks/use-iq-monitor'
import { formatProbeTime } from './lib/format'
import type { IQMonitorGroup, IQProbeResult, IQProbeVerdict } from './types'

const LEGEND: IQProbeVerdict[] = ['normal', 'suspect', 'invalid', 'failed']

type ModelCardProps = {
  model: IQMonitorGroup['models'][number]
  active: boolean
  locale: string | undefined
  onSelect: () => void
}

function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const latest = props.model.latest
  return (
    <button
      type='button'
      onClick={props.onSelect}
      aria-pressed={props.active}
      className={cn(
        'hover:bg-muted/50 focus-visible:ring-ring flex min-w-0 flex-col gap-2 rounded-lg border p-3 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none',
        props.active && 'border-primary bg-muted/40'
      )}
    >
      <span className='flex items-center justify-between gap-2'>
        <span className='truncate font-mono text-sm font-medium'>
          {props.model.model}
        </span>
        {latest ? (
          <VerdictBadge
            verdict={latest.verdict}
            reasons={latest.verdict_reasons}
          />
        ) : null}
      </span>
      <span className='text-muted-foreground text-xs tabular-nums'>
        {latest
          ? formatProbeTime(latest.created_at, props.locale)
          : t('Not probed yet')}
      </span>
    </button>
  )
}
export function IQMonitor() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const query = useIQMonitorOverview()
  const runProbe = useRunIQProbe()
  const deleteProbe = useDeleteIQProbeResult()
  const data = query.data?.data
  const groups = data?.groups ?? []
  const [groupTab, setGroupTab] = useState('')
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>(
    {}
  )
  const [detail, setDetail] = useState<IQProbeResult | null>(null)
  const [pendingDelete, setPendingDelete] = useState<IQProbeResult | null>(null)

  const group = groups.find((item) => item.group === groupTab) ?? groups[0]
  const modelName = group ? selectedModels[group.group] : undefined
  const current =
    group?.models.find((item) => item.model === modelName) ?? group?.models[0]
  const latest = current?.latest ?? null
  const canRun = Boolean(data?.can_run)
  const canDelete = Boolean(data?.can_delete)
  const runDisabled = Boolean(data?.running) || runProbe.isPending

  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) setDetail(null)
  }, [])

  const handleDeleteConfirm = () => {
    if (!pendingDelete) return
    const deletedId = pendingDelete.id
    deleteProbe.mutate(deletedId, {
      onSuccess: () => {
        setPendingDelete(null)
        setDetail((open) => (open?.id === deletedId ? null : open))
      },
    })
  }

  let autoLabel = t('Auto probe off')
  if (data?.auto_enabled) {
    autoLabel = t('Auto probe every {{minutes}} min', {
      minutes: data.interval_minutes,
    })
  }

  let content = null
  if (query.isLoading) {
    content = <LoadingState />
  } else if (query.isError) {
    content = <ErrorState onRetry={() => query.refetch()} />
  } else if (!group || !current) {
    content = (
      <EmptyState
        title={t('No group has joined IQ monitoring')}
        description={t(
          'Administrators can add model pools to groups under System Settings > Group Pricing.'
        )}
        bordered
      />
    )
  } else {
    content = (
      <div className='flex flex-col gap-5'>
        {group.description ? (
          <p className='text-muted-foreground text-sm'>{group.description}</p>
        ) : null}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {group.models.map((item) => (
            <ModelCard
              key={item.model}
              model={item}
              active={item.model === current.model}
              locale={locale}
              onSelect={() =>
                setSelectedModels((prev) => ({
                  ...prev,
                  [group.group]: item.model,
                }))
              }
            />
          ))}
        </div>
        <div className='grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]'>
          <section className='flex min-w-0 flex-col gap-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                <h2 className='truncate font-mono text-base font-semibold'>
                  {current.model}
                </h2>
                {latest ? (
                  <>
                    <VerdictBadge
                      verdict={latest.verdict}
                      reasons={latest.verdict_reasons}
                    />
                    <span className='text-muted-foreground text-sm'>
                      {latest.prompt_title}
                    </span>
                  </>
                ) : null}
              </div>
              <div className='flex items-center gap-2'>
                {latest ? (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setDetail(latest)}
                  >
                    {t('Details')}
                  </Button>
                ) : null}
                {canRun ? (
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={runDisabled}
                    onClick={() =>
                      runProbe.mutate({
                        group: group.group,
                        model: current.model,
                      })
                    }
                  >
                    <Play aria-hidden='true' />
                    {t('Probe this model')}
                  </Button>
                ) : null}
              </div>
            </div>
            <ResultPreview
              result={latest}
              className='h-[min(70vh,720px)] min-h-96'
            />
            {latest ? (
              <>
                <VerdictReasonList reasons={latest.verdict_reasons} />
                <ResultMeta result={latest} />
              </>
            ) : null}
          </section>
          <section className='flex min-w-0 flex-col gap-3'>
            <h2 className='text-base font-semibold'>
              {t('Last {{count}} probes', { count: current.history.length })}
            </h2>
            <HistoryList
              history={current.history}
              canDelete={canDelete}
              deletingId={
                deleteProbe.isPending ? deleteProbe.variables : undefined
              }
              onOpen={setDetail}
              onDelete={setPendingDelete}
            />
          </section>
        </div>
      </div>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <main className='mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 pt-24 pb-8 sm:px-6 lg:px-8'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex flex-col gap-1'>
            <h1 className='text-xl font-semibold'>{t('IQ Monitor')}</h1>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Models periodically generate an SVG animation page. Broken or much smaller outputs suggest degradation.'
              )}
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='bg-muted/60 text-muted-foreground inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium'>
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  data?.auto_enabled ? 'bg-success' : 'bg-muted-foreground/50',
                  data?.running && 'bg-warning animate-pulse'
                )}
                aria-hidden='true'
              />
              {data?.running ? t('Probing...') : autoLabel}
            </span>
            <Button
              variant='outline'
              size='sm'
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw
                className={cn(query.isFetching && 'animate-spin')}
                aria-hidden='true'
              />
              {t('Refresh')}
            </Button>
            {canRun && groups.length > 0 ? (
              <Button
                size='sm'
                disabled={runDisabled}
                onClick={() => runProbe.mutate({})}
              >
                <Play aria-hidden='true' />
                {t('Probe all groups')}
              </Button>
            ) : null}
          </div>
        </div>
        {groups.length > 0 ? (
          <div className='flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-center lg:justify-between'>
            <Tabs
              value={group?.group ?? ''}
              onValueChange={(value) => setGroupTab(String(value))}
            >
              <TabsList className='h-auto flex-wrap justify-start'>
                {groups.map((item) => (
                  <TabsTrigger key={item.group} value={item.group}>
                    {item.group}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <ul className='text-muted-foreground flex flex-wrap items-center gap-3 text-xs'>
              {LEGEND.map((verdict) => (
                <li key={verdict} className='flex items-center gap-1.5'>
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      VERDICT_CONFIG[verdict].dotClass
                    )}
                    aria-hidden='true'
                  />
                  {t(VERDICT_CONFIG[verdict].labelKey)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {content}
        <ResultDetailDialog
          result={detail}
          onOpenChange={handleDetailOpenChange}
        />
        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open && !deleteProbe.isPending) setPendingDelete(null)
          }}
          title={t('Delete this record?')}
          desc={t(
            'This probe record will be deleted permanently. This cannot be undone.'
          )}
          confirmText={t('Delete')}
          destructive
          isLoading={deleteProbe.isPending}
          handleConfirm={handleDeleteConfirm}
        />
      </main>
    </PublicLayout>
  )
}
