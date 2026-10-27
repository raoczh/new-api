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
import { getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { useTableState } from '@/hooks/use-table-state'
import { createServerError } from '@/lib/server-error-message'

import { getPromotionRecipients } from '../api'
import {
  ERROR_MESSAGES,
  PROMOTION_BOUND_FILTER_VALUES,
  PROMOTION_REWARD_FILTER_VALUES,
  getPromotionStatusOptions,
} from '../constants'
import { usePromotionColumns } from './promotion-columns'
import { PromotionBulkActions } from './promotion-bulk-actions'
import { usePromotion } from './promotion-provider'
import { PromotionStats } from './promotion-stats'

const route = getRouteApi('/_authenticated/open-source-promotion/')

export function PromotionTable() {
  const { t } = useTranslation()
  const columns = usePromotionColumns()
  const { refreshTrigger } = usePromotion()

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableState({
    initialSearch: route.useSearch(),
    pagination: { defaultPage: 1, defaultPageSize: 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'reward', searchKey: 'reward', type: 'string' },
      { columnId: 'registration', searchKey: 'registration', type: 'string' },
    ],
  })

  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const statusFilterValue = statusFilter[0] ?? ''
  const rewardFilter =
    (columnFilters.find((filter) => filter.id === 'reward')?.value as
      | string
      | undefined) ?? ''
  const boundFilter =
    (columnFilters.find((filter) => filter.id === 'registration')?.value as
      | string
      | undefined) ?? ''

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'open-source-promotion',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilterValue,
      rewardFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      const result = await getPromotionRecipients({
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        keyword: globalFilter,
        status: statusFilterValue,
        reward_status: rewardFilter,
        bound: boundFilter,
      })
      if (!result.success) {
        throw createServerError(result, t(ERROR_MESSAGES.LOAD_FAILED))
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const { table } = useDataTable({
    data: data?.items ?? [],
    columns,
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    columnFilters,
    globalFilter,
    pagination,
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total ?? 0,
    ensurePageInRange,
  })

  const statusOptions = useMemo(() => getPromotionStatusOptions(t), [t])

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No harvested authors yet')}
      emptyDescription={t(
        'Enable the open-source promotion in system settings and run a harvest, or trigger one from the button above.'
      )}
      skeletonKeyPrefix='open-source-promotion-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by email, GitHub account, or repository...'),
        searchDebounceMs: 500,
        filters: [
          {
            columnId: 'status',
            title: t('Delivery status'),
            options: statusOptions,
            singleSelect: true,
          },
          {
            columnId: 'reward',
            title: t('Bonus status'),
            options: PROMOTION_REWARD_FILTER_VALUES.map((value) => ({
              label: value === 'rewarded' ? t('Rewarded') : t('Not rewarded'),
              value,
            })),
            singleSelect: true,
          },
          {
            columnId: 'registration',
            title: t('Registration'),
            options: PROMOTION_BOUND_FILTER_VALUES.map((value) => ({
              label: value === 'bound' ? t('Bound') : t('Unbound'),
              value,
            })),
            singleSelect: true,
          },
        ],
      }}
      bulkActions={<PromotionBulkActions table={table} />}
      afterTable={<PromotionStats />}
    />
  )
}
