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
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { TruncatedCell } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { Checkbox } from '@/components/ui/checkbox'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import { PROMOTION_SOURCES, PROMOTION_STATUSES } from '../constants'
import type { PromotionRecipient } from '../types'
import { PromotionRowActions } from './promotion-row-actions'

export function usePromotionColumns(): ColumnDef<PromotionRecipient>[] {
  const { t } = useTranslation()

  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
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
      accessorKey: 'email',
      header: t('Email'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <TruncatedCell className='max-w-[220px] font-medium'>
          {row.original.email}
        </TruncatedCell>
      ),
      size: 220,
    },
    {
      accessorKey: 'github_login',
      header: t('GitHub account'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const recipient = row.original
        if (!recipient.github_login) {
          return <span className='text-muted-foreground'>-</span>
        }
        return (
          <a
            href={recipient.profile_url || `https://github.com/${recipient.github_login}`}
            target='_blank'
            rel='noreferrer'
            className='text-primary hover:underline'
          >
            {recipient.github_login}
          </a>
        )
      },
      size: 150,
    },
    {
      accessorKey: 'repository',
      header: t('Repository'),
      cell: ({ row }) => (
        <TruncatedCell
          className='max-w-[220px]'
          tooltipContent={`${row.original.repository}\n${row.original.contribution}`}
        >
          <a
            href={row.original.repository_url}
            target='_blank'
            rel='noreferrer'
            className='hover:underline'
          >
            {row.original.repository}
          </a>
        </TruncatedCell>
      ),
      size: 220,
    },
    {
      accessorKey: 'contribution',
      header: t('Contribution'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <TruncatedCell className='text-muted-foreground max-w-[280px]'>
          {row.original.contribution}
        </TruncatedCell>
      ),
      size: 280,
    },
    {
      accessorKey: 'status',
      header: t('Delivery status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const config = PROMOTION_STATUSES[row.original.status]
        if (!config) return null
        return (
          <StatusBadge
            label={t(config.labelKey)}
            variant={config.variant}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      filterFn: (row, _id, value) => {
        const values = value as string[]
        return values.length === 0 || values.includes(row.original.status)
      },
      size: 120,
    },
    {
      accessorKey: 'last_sent_at',
      header: t('Sent at'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <span className='text-muted-foreground text-sm'>
          {formatTimestampToDate(row.original.last_sent_at)}
        </span>
      ),
      size: 160,
    },
    {
      id: 'registration',
      header: t('Registration'),
      cell: ({ row }) => {
        const recipient = row.original
        if (recipient.bound_user_id > 0) {
          return (
            <StatusBadge
              label={recipient.bound_username || `#${recipient.bound_user_id}`}
              variant='success'
              copyable={false}
              className='-ml-1.5'
            />
          )
        }
        if (recipient.existing_user) {
          return (
            <StatusBadge
              label={t('Registered, not bound')}
              variant='warning'
              copyable={false}
              className='-ml-1.5'
            />
          )
        }
        return (
          <StatusBadge
            label={t('Not registered')}
            variant='neutral'
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 150,
    },
    {
      id: 'reward',
      header: t('Bonus'),
      cell: ({ row }) => {
        const recipient = row.original
        if (recipient.rewarded_at <= 0) {
          return <span className='text-muted-foreground'>-</span>
        }
        return (
          <div className='flex flex-col'>
            <span>{formatQuota(recipient.reward_quota)}</span>
            <span className='text-muted-foreground text-xs'>
              {formatTimestampToDate(recipient.rewarded_at)}
            </span>
          </div>
        )
      },
      size: 140,
    },
    {
      id: 'source',
      header: t('Source'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <span className='text-muted-foreground text-sm'>
          {t(PROMOTION_SOURCES[row.original.source] ?? 'Unknown')}
        </span>
      ),
      size: 140,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => <PromotionRowActions row={row.original} />,
      enableSorting: false,
      enableHiding: false,
      size: 60,
    },
  ]
}
