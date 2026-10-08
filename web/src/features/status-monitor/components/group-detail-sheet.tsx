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
import { useTranslation } from 'react-i18next'

import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { EmptyState } from '@/components/empty-state'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import { cn } from '@/lib/utils'

import type { GroupStatus } from '../types'
import { HourlyStatusBar } from './hourly-status-bar'

interface GroupDetailSheetProps {
  group: GroupStatus | null
  hourlyStart: number
  windowLabel: string
  onOpenChange: (open: boolean) => void
}

export function GroupDetailSheet(props: GroupDetailSheetProps) {
  const { t } = useTranslation()
  const group = props.group
  const summary = group?.summary

  const stats = [
    {
      key: 'success',
      label: t('Success rate'),
      value: formatUptimePct(summary?.success_rate ?? Number.NaN),
      className: getSuccessRateTextClass(summary?.success_rate ?? Number.NaN),
    },
    {
      key: 'ttft',
      label: t('Time to first token'),
      value: formatLatency(summary?.avg_ttft_ms ?? 0),
    },
    {
      key: 'latency',
      label: t('Average latency'),
      value: formatLatency(summary?.avg_latency_ms ?? 0),
    },
    {
      key: 'tps',
      label: t('Throughput'),
      value: formatThroughput(summary?.avg_tps ?? 0),
    },
  ]

  return (
    <Sheet open={group != null} onOpenChange={props.onOpenChange}>
      <SheetContent className={sideDrawerContentClassName('sm:max-w-2xl')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{group?.description || group?.group}</SheetTitle>
          <SheetDescription>
            {group?.group} · {props.windowLabel}
          </SheetDescription>
        </SheetHeader>
        {group && (
          <div className={sideDrawerFormClassName()}>
            <HourlyStatusBar group={group} hourlyStart={props.hourlyStart} />
            <dl className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
              {stats.map((stat) => (
                <div key={stat.key} className='rounded-lg border px-3 py-2'>
                  <dt className='text-muted-foreground text-xs'>
                    {stat.label}
                  </dt>
                  <dd
                    className={cn(
                      'text-base font-semibold tabular-nums',
                      stat.className
                    )}
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
            {group.models.length === 0 ? (
              <EmptyState
                title={t('No records')}
                description={t(
                  'No group samples in this window. Performance metrics may be disabled on this site.'
                )}
                bordered
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Model')}</TableHead>
                    <TableHead className='text-end'>
                      {t('Success rate')}
                    </TableHead>
                    <TableHead className='text-end'>
                      {t('Time to first token')}
                    </TableHead>
                    <TableHead className='text-end'>
                      {t('Average latency')}
                    </TableHead>
                    <TableHead className='text-end'>
                      {t('Throughput')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.models.map((model) => (
                    <TableRow key={model.model_name}>
                      <TableCell className='max-w-56 truncate font-mono text-xs'>
                        {model.model_name}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-end tabular-nums',
                          getSuccessRateTextClass(model.success_rate)
                        )}
                      >
                        {formatUptimePct(model.success_rate)}
                      </TableCell>
                      <TableCell className='text-end tabular-nums'>
                        {formatLatency(model.avg_ttft_ms)}
                      </TableCell>
                      <TableCell className='text-end tabular-nums'>
                        {formatLatency(model.avg_latency_ms)}
                      </TableCell>
                      <TableCell className='text-end tabular-nums'>
                        {formatThroughput(model.avg_tps)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
