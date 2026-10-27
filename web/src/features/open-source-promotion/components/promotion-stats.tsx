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
import { useTranslation } from 'react-i18next'

import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import { getPromotionStats } from '../api'
import { usePromotion } from './promotion-provider'

type StatCard = {
  key: string
  label: string
  value: string
  className?: string
}

export function PromotionStats() {
  const { t } = useTranslation()
  const { refreshTrigger } = usePromotion()

  const { data } = useQuery({
    queryKey: ['open-source-promotion-stats', refreshTrigger],
    queryFn: () => getPromotionStats(),
    staleTime: 30_000,
  })
  const stats = data?.data

  if (!stats) return null

  const cards: StatCard[] = [
    { key: 'total', label: t('Total'), value: String(stats.total) },
    { key: 'pending', label: t('Pending'), value: String(stats.pending) },
    { key: 'sent', label: t('Sent'), value: String(stats.sent) },
    { key: 'failed', label: t('Failed'), value: String(stats.failed) },
    {
      key: 'blacklisted',
      label: t('Blacklisted'),
      value: String(stats.blacklisted),
    },
    { key: 'bound', label: t('Bound users'), value: String(stats.bound) },
    {
      key: 'rewarded',
      label: t('Rewarded'),
      value: String(stats.rewarded),
    },
    {
      key: 'rewarded_quota_total',
      label: t('Total bonus'),
      value: formatQuota(stats.rewarded_quota_total),
      className: 'text-success',
    },
    {
      key: 'sent_today',
      label: t('Sent today'),
      value: String(stats.sent_today),
    },
  ]

  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9'>
      {cards.map((card) => (
        <div
          key={card.key}
          className='bg-muted/40 flex flex-col gap-1 rounded-lg border px-3 py-2'
        >
          <span className='text-muted-foreground truncate text-xs'>
            {card.label}
          </span>
          <span className={cn('text-base font-semibold', card.className)}>
            {card.value}
          </span>
        </div>
      ))}
    </div>
  )
}
