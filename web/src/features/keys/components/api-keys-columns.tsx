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
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useMediaQuery } from '@/hooks'
import { toIntlLocale } from '@/i18n/languages'
import { getUserGroups } from '@/lib/api'
import { getCurrencyDisplay } from '@/lib/currency'
import { getLobeIcon } from '@/lib/lobe-icon'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { API_KEY_STATUSES } from '../constants'
import type { ApiKey } from '../types'
import { ApiKeyGroupEditableCell } from './api-key-group-editable-cell'
import { ApiKeyQuotaCell } from './api-key-quota-cell'
import {
  ApiKeyActivityCell,
  ApiKeyTimestampCell,
} from './api-key-timestamp-cell'
import {
  ApiKeyCell,
  IpRestrictionsCell,
  ModelLimitsCell,
} from './api-keys-cells'
import { DataTableRowActions } from './data-table-row-actions'

type UserGroupData = {
  ratios: Record<string, number | string>
  /** Icon of the vendor the administrator assigned to each group. */
  vendorIcons: Record<string, string>
}

const EMPTY_GROUP_DATA: UserGroupData = {
  ratios: {},
  vendorIcons: {},
}

function useUserGroupData(): UserGroupData {
  const { data } = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
    staleTime: 0,
    select: (res): UserGroupData => {
      if (!res.success || !res.data) return EMPTY_GROUP_DATA
      const ratios: Record<string, number | string> = {}
      const vendorIcons: Record<string, string> = {}
      const iconByVendor = new Map(
        (res.vendors ?? []).map((vendor) => [vendor.id, vendor.icon ?? ''])
      )
      for (const [group, info] of Object.entries(res.data)) {
        if (typeof info.ratio === 'number' || typeof info.ratio === 'string') {
          ratios[group] = info.ratio
        }
        const icon = iconByVendor.get(info.vendor_id ?? 0)
        if (icon) vendorIcons[group] = icon
      }
      return { ratios, vendorIcons }
    },
  })

  return data ?? EMPTY_GROUP_DATA
}

export function useApiKeysColumns(now: number): ColumnDef<ApiKey>[] {
  const { t, i18n } = useTranslation()
  useSystemConfigStore((state) => state.config.currency)
  const { meta: currency } = getCurrencyDisplay()
  const quotaUnit = currency.kind === 'tokens' ? t('Tokens') : currency.symbol
  const { ratios: groupRatios, vendorIcons } = useUserGroupData()
  const shouldReduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const justNowLabel = t('Just now')
  return useMemo<ColumnDef<ApiKey>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label={t('Select all')}
            className='translate-y-[2px]'
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={t('Select row')}
            className='translate-y-[2px]'
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: 'name',
        header: t('Name'),
        cell: ({ row }) => {
          // A key made for one vendor shows that vendor, and a key with its
          // own line order shows the order it falls back through.
          const lines = row.original.auto_groups ?? []
          const route = lines.length > 0 ? lines : [row.original.group ?? '']
          const icons = new Set(route.map((line) => vendorIcons[line] ?? ''))
          const icon = icons.size === 1 ? [...icons][0] : ''
          return (
            <span className='flex min-w-0 items-center gap-2'>
              {icon && (
                <span aria-hidden='true' className='flex shrink-0'>
                  {getLobeIcon(icon, 18)}
                </span>
              )}
              <span className='flex min-w-0 flex-col'>
                <span className='truncate font-medium'>
                  {row.getValue('name')}
                </span>
                {lines.length > 1 && (
                  <span
                    className='text-muted-foreground truncate text-xs'
                    title={lines.join(' → ')}
                  >
                    {lines.join(' → ')}
                  </span>
                )}
              </span>
            </span>
          )
        },
        size: 180,
        meta: { mobileTitle: true },
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => {
          const statusConfig =
            API_KEY_STATUSES[row.getValue('status') as number]
          if (!statusConfig) return null
          return (
            <StatusBadge
              label={t(statusConfig.label)}
              variant={statusConfig.variant}
              copyable={false}
              className='-ml-1.5'
            />
          )
        },
        filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
        size: 120,
        meta: { mobileBadge: true },
      },
      {
        id: 'key',
        accessorKey: 'key',
        header: t('API Key'),
        cell: ({ row }) => <ApiKeyCell apiKey={row.original} />,
        enableSorting: false,
        size: 260,
      },
      {
        id: 'quota',
        accessorKey: 'remain_quota',
        header: `${t('Quota')} (${quotaUnit})`,
        cell: ({ row }) => <ApiKeyQuotaCell apiKey={row.original} now={now} />,
        size: 260,
        minSize: 260,
      },
      {
        accessorKey: 'group',
        header: t('Group'),
        cell: ({ row }) => {
          const apiKey = row.original
          const group = row.getValue('group') as string
          return (
            <ApiKeyGroupEditableCell
              apiKey={apiKey}
              ratio={groupRatios[group]}
              shouldReduceMotion={shouldReduceMotion}
            />
          )
        },
        size: 220,
        meta: { mobileHidden: true },
      },
      {
        id: 'model_limits',
        accessorKey: 'model_limits',
        header: t('Models'),
        cell: ({ row }) => <ModelLimitsCell apiKey={row.original} />,
        enableSorting: false,
        size: 160,
        meta: { mobileHidden: true },
      },
      {
        id: 'allow_ips',
        accessorKey: 'allow_ips',
        header: t('IP Restriction'),
        cell: ({ row }) => <IpRestrictionsCell apiKey={row.original} />,
        enableSorting: false,
        size: 160,
        meta: { mobileHidden: true },
      },
      {
        id: 'activity_time',
        accessorKey: 'created_time',
        header: t('Time'),
        cell: ({ row }) => (
          <ApiKeyActivityCell apiKey={row.original} now={now} />
        ),
        size: 220,
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'expired_time',
        header: t('Expires'),
        cell: ({ row }) => {
          const expiredTime = row.getValue('expired_time') as number
          if (expiredTime === -1) {
            return (
              <StatusBadge
                label={t('Never')}
                variant='neutral'
                copyable={false}
                className='-ml-1.5'
              />
            )
          }
          return (
            <ApiKeyTimestampCell
              timestamp={expiredTime}
              now={now}
              locale={locale}
              justNowLabel={justNowLabel}
              className={
                expiredTime * 1000 <= now
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }
            />
          )
        },
        size: 180,
        meta: { mobileHidden: true },
      },
      {
        id: 'actions',
        header: () => t('Actions'),
        cell: ({ row }) => <DataTableRowActions row={row} />,
        meta: { pinned: 'right' as const },
      },
    ],
    [
      t,
      quotaUnit,
      now,
      groupRatios,
      vendorIcons,
      shouldReduceMotion,
      locale,
      justNowLabel,
    ]
  )
}
