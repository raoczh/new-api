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
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePagination, DataTableView } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getPaymentMethodName } from '@/features/wallet/lib/billing'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatTimestamp } from '@/lib/format'
import { getServerErrorMessage } from '@/lib/server-error-message'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { getUserRechargeHistory } from '../../api'
import type { UserRechargeRecord } from '../../types'

interface UserRechargeHistoryDialogProps {
  user: { id: number; username: string }
  onOpenChange: (open: boolean) => void
}

const emptyRecords: UserRechargeRecord[] = []

export function UserRechargeHistoryDialog(
  props: UserRechargeHistoryDialogProps
) {
  const translation = useTranslation()
  useSystemConfigStore((state) => state.config.currency)
  const locale = toIntlLocale(
    translation.i18n.resolvedLanguage || translation.i18n.language
  )
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const history = useQuery({
    queryKey: ['users', props.user.id, 'recharge-history', pagination],
    staleTime: 0,
    queryFn: ({ signal }) =>
      getUserRechargeHistory(
        props.user.id,
        pagination.pageIndex + 1,
        pagination.pageSize,
        signal
      ),
  })
  const currencyOptions = { locale, abbreviate: false }
  const columns: ColumnDef<UserRechargeRecord>[] = [
    {
      accessorKey: 'created_at',
      header: translation.t('Time'),
      cell: ({ row }) => formatTimestamp(row.original.created_at),
    },
    {
      accessorKey: 'source',
      header: translation.t('Source'),
      cell: ({ row }) => {
        const record = row.original
        if (record.source === 'redemption') {
          return translation.t('Redemption code recharge')
        }
        if (record.source === 'online') {
          return translation.t('Online recharge')
        }
        if (record.action === 'user.quota_add') {
          return translation.t('Manual credit')
        }
        if (record.action === 'user.quota_subtract') {
          return translation.t('Manual deduction')
        }
        return translation.t('Manual balance override')
      },
    },
    {
      accessorKey: 'status',
      header: translation.t('Status'),
      cell: ({ row }) => {
        const status = row.original.status
        if (status === 'success') {
          return (
            <StatusBadge
              label={translation.t('Success')}
              variant='success'
              copyable={false}
            />
          )
        }
        if (status === 'pending') {
          return (
            <StatusBadge
              label={translation.t('Pending')}
              variant='warning'
              copyable={false}
            />
          )
        }
        return (
          <StatusBadge
            label={status === 'expired' ? translation.t('Expired') : status}
            variant='neutral'
            copyable={false}
          />
        )
      },
    },
    {
      accessorKey: 'quota',
      header: translation.t('Recharge amount'),
      cell: ({ row }) => {
        const quota = row.original.quota
        if (quota === null) return translation.t('Unknown amount')
        return (
          <span
            className={
              Number(quota) < 0
                ? 'text-destructive tabular-nums'
                : 'tabular-nums'
            }
          >
            {formatQuotaWithCurrency(Number(quota), currencyOptions)}
          </span>
        )
      },
    },
    {
      accessorKey: 'reference',
      header: translation.t('Details'),
      cell: ({ row }) => {
        const record = row.original
        return (
          <div className='max-w-80 min-w-40 space-y-1 break-all whitespace-normal'>
            {record.reference && <div>{record.reference}</div>}
            {record.payment_method && (
              <div>
                {getPaymentMethodName(record.payment_method, translation.t)}
              </div>
            )}
            {record.operator && (
              <div>
                {translation.t('Operator')}: {record.operator}
              </div>
            )}
            {record.before !== undefined && record.after !== undefined && (
              <div className='text-muted-foreground text-xs'>
                {translation.t('Balance change: {{before}} to {{after}}', {
                  before: formatQuotaWithCurrency(
                    record.before,
                    currencyOptions
                  ),
                  after: formatQuotaWithCurrency(record.after, currencyOptions),
                })}
              </div>
            )}
          </div>
        )
      },
    },
  ]
  const table = useReactTable({
    data: history.data?.items ?? emptyRecords,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (record) => record.id,
    manualPagination: true,
    rowCount: history.data?.total ?? 0,
    state: { pagination },
    onPaginationChange: setPagination,
  })
  const summary = history.data?.summary

  return (
    <Dialog
      open
      onOpenChange={props.onOpenChange}
      title={translation.t('Recharge records')}
      description={translation.t('Recharge history for {{username}}', {
        username: props.user.username,
      })}
      contentClassName='sm:max-w-5xl'
      bodyClassName='space-y-4'
      footer={
        history.isSuccess && <DataTablePagination table={table} compact />
      }
    >
      {history.isPending && <LoadingState />}
      {history.isError && (
        <ErrorState
          title={translation.t('Failed to load billing history')}
          description={getServerErrorMessage(history.error)}
          onRetry={() => void history.refetch()}
        />
      )}
      {history.isSuccess && summary && (
        <>
          <dl className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
            {[
              {
                label: translation.t('Total credited'),
                quota: summary.credited_quota,
              },
              {
                label: translation.t('Total deducted'),
                quota: summary.debited_quota,
              },
              {
                label: translation.t('Net recharge total'),
                quota: summary.net_quota,
              },
            ].map((item) => (
              <div key={item.label} className='min-w-0 rounded-lg border p-3'>
                <dt className='text-muted-foreground text-sm'>{item.label}</dt>
                <dd className='text-lg font-semibold break-all tabular-nums'>
                  {formatQuotaWithCurrency(Number(item.quota), currencyOptions)}
                </dd>
              </div>
            ))}
          </dl>
          <p className='text-muted-foreground text-xs'>
            {translation.t(
              'Totals cover all successful records, not just this page. Manual deductions reduce the net total; unpaid orders and subscription purchases are excluded.'
            )}
          </p>
          {summary.unknown_count > 0 && (
            <Alert>
              <AlertDescription>
                {translation.t(
                  '{{count}} records have no recoverable amount and are excluded from totals.',
                  { count: summary.unknown_count }
                )}
              </AlertDescription>
            </Alert>
          )}
          <DataTableView
            table={table}
            tableClassName='min-w-[720px]'
            emptyTitle={translation.t('No billing records found')}
          />
        </>
      )}
    </Dialog>
  )
}
