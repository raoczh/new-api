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
import { RefreshCw, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { PublicLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toIntlLocale } from '@/i18n/languages'
import { cn } from '@/lib/utils'

import { GroupDetailSheet } from './components/group-detail-sheet'
import { VendorSection } from './components/vendor-section'
import {
  DEFAULT_STATUS_MONITOR_WINDOW,
  STATUS_MONITOR_WINDOWS,
  type StatusMonitorWindow,
} from './constants'
import { useGroupStatus } from './hooks/use-group-status'
import {
  GROUP_HEALTH_CONFIG,
  groupByVendor,
  matchesGroupSearch,
  type GroupHealth,
} from './lib/status'
import type { GroupStatus } from './types'

const ALL_VENDORS = 'all'
const LEGEND: GroupHealth[] = ['operational', 'degraded', 'outage', 'pending']

export function StatusMonitor() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [hours, setHours] = useState<StatusMonitorWindow>(
    DEFAULT_STATUS_MONITOR_WINDOW
  )
  const [vendorTab, setVendorTab] = useState(ALL_VENDORS)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<GroupStatus | null>(null)
  const query = useGroupStatus(hours)
  const data = query.data?.data

  const sections = useMemo(
    () => groupByVendor(data?.groups ?? [], data?.vendors ?? []),
    [data]
  )
  const visibleSections = useMemo(
    () =>
      sections
        .filter(
          (section) =>
            vendorTab === ALL_VENDORS || String(section.vendorId) === vendorTab
        )
        .map((section) => ({
          ...section,
          groups: section.groups.filter((group) =>
            matchesGroupSearch(group, search)
          ),
        }))
        .filter((section) => section.groups.length > 0),
    [search, sections, vendorTab]
  )
  const visibleGroupCount = visibleSections.reduce(
    (sum, section) => sum + section.groups.length,
    0
  )
  const windowLabel = t(
    STATUS_MONITOR_WINDOWS.find((option) => option.value === hours)?.labelKey ??
      'Last 24 hours'
  )
  const updatedAt = query.dataUpdatedAt
    ? new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(query.dataUpdatedAt)
    : '—'
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) setSelected(null)
  }, [])

  let content = null
  if (query.isLoading) {
    content = <LoadingState />
  } else if (query.isError) {
    content = <ErrorState onRetry={() => query.refetch()} />
  } else if (visibleSections.length === 0) {
    content = (
      <EmptyState
        title={t('No records')}
        description={t(
          'No group samples in this window. Performance metrics may be disabled on this site.'
        )}
        bordered
      />
    )
  } else {
    content = visibleSections.map((section) => (
      <VendorSection
        key={section.vendorId}
        section={section}
        hourlyStart={data?.hourly_start ?? 0}
        windowLabel={windowLabel}
        onOpenDetails={setSelected}
      />
    ))
  }

  return (
    <PublicLayout showMainContainer={false}>
      <main className='mx-auto flex w-full max-w-[1920px] flex-col gap-5 px-4 pt-24 pb-8 sm:px-6 lg:px-8'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h1 className='text-xl font-semibold'>{t('Status Monitor')}</h1>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-muted-foreground hidden items-center gap-1.5 text-xs tabular-nums sm:flex'>
              <span
                className='size-1.5 rounded-full bg-emerald-500'
                aria-hidden='true'
              />
              {t('Updated at')} {updatedAt}
            </span>
            <div
              className='bg-muted/60 inline-flex h-8 rounded-lg border p-0.5'
              role='group'
              aria-label={t('Time range')}
            >
              {STATUS_MONITOR_WINDOWS.map((option) => (
                <Button
                  key={option.value}
                  type='button'
                  onClick={() => setHours(option.value)}
                  aria-pressed={hours === option.value}
                  variant='ghost'
                  className={cn(
                    'h-auto shrink-0 rounded-md px-3 text-xs font-medium',
                    hours === option.value
                      ? 'text-foreground bg-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t(option.labelKey)}
                </Button>
              ))}
            </div>
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
              {t('Refresh status')}
            </Button>
          </div>
        </div>
        <section>
          <div className='flex flex-col gap-5'>
            <div className='flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-center lg:justify-between'>
              <Tabs
                value={vendorTab}
                onValueChange={(v) => setVendorTab(String(v))}
              >
                <TabsList className='h-auto flex-wrap justify-start'>
                  <TabsTrigger value={ALL_VENDORS}>
                    {t('All vendors')}
                  </TabsTrigger>
                  {sections.map((section) => (
                    <TabsTrigger
                      key={section.vendorId}
                      value={String(section.vendorId)}
                    >
                      {section.vendor?.name ?? t('Other vendors')}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <InputGroup className='lg:max-w-xs'>
                <InputGroupAddon>
                  <Search aria-hidden='true' />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label={t('Search groups...')}
                  placeholder={t('Search groups...')}
                />
              </InputGroup>
            </div>
            <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs'>
              <span>
                {t('{{vendors}} vendors · {{groups}} groups', {
                  vendors: visibleSections.length,
                  groups: visibleGroupCount,
                })}
              </span>
              <ul className='flex items-center gap-3'>
                {LEGEND.map((health) => (
                  <li key={health} className='flex items-center gap-1.5'>
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        GROUP_HEALTH_CONFIG[health].dotClass
                      )}
                      aria-hidden='true'
                    />
                    {t(GROUP_HEALTH_CONFIG[health].labelKey)}
                  </li>
                ))}
              </ul>
            </div>
            {content}
          </div>
          <GroupDetailSheet
            group={
              data?.groups.find((group) => group.group === selected?.group) ??
              null
            }
            hourlyStart={data?.hourly_start ?? 0}
            windowLabel={windowLabel}
            onOpenChange={handleOpenChange}
          />
        </section>
      </main>
    </PublicLayout>
  )
}
