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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { cn } from '@/lib/utils'

import {
  ModelStatusList,
  StatusMonitorSummary,
} from './components/model-status-list'
import {
  DEFAULT_STATUS_MONITOR_WINDOW,
  STATUS_MONITOR_WINDOWS,
  type StatusMonitorWindow,
} from './constants'
import { useStatusMonitorMetrics } from './hooks/use-status-monitor-metrics'

export function StatusMonitor() {
  const { t } = useTranslation()
  const [hours, setHours] = useState<StatusMonitorWindow>(
    DEFAULT_STATUS_MONITOR_WINDOW
  )
  const metricsQuery = useStatusMonitorMetrics(hours)

  const models = useMemo(
    () => metricsQuery.data?.data.models ?? [],
    [metricsQuery.data]
  )
  const summary = metricsQuery.data?.data.summary

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Status Monitor')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <div
          className='bg-muted/60 inline-flex h-8 rounded-lg border p-0.5'
          role='group'
          aria-label={t('Time range')}
        >
          {STATUS_MONITOR_WINDOWS.map((option) => (
            <button
              key={option.value}
              type='button'
              onClick={() => setHours(option.value)}
              aria-pressed={hours === option.value}
              className={cn(
                'shrink-0 rounded-md px-3 text-xs font-medium',
                hours === option.value
                  ? 'text-foreground bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          <StatusMonitorSummary
            successRate={summary?.success_rate ?? Number.NaN}
            avgLatencyMs={summary?.avg_latency_ms ?? 0}
            avgTps={summary?.avg_tps ?? 0}
            loading={metricsQuery.isLoading}
          />
          <ModelStatusList models={models} loading={metricsQuery.isLoading} />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
