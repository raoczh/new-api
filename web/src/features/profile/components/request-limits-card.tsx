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
import { Gauge } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { TitledCard } from '@/components/ui/titled-card'
import { formatNumber } from '@/lib/format'

import type { UserProfile } from '../types'

type RequestLimitsCardProps = {
  profile: UserProfile
}

function LimitValue(props: {
  value: number | undefined
  unlimitedLabel: string
}) {
  if (!props.value || props.value <= 0) {
    return (
      <span className='text-muted-foreground text-sm font-medium'>
        {props.unlimitedLabel}
      </span>
    )
  }

  return (
    <span className='text-foreground text-sm font-semibold tabular-nums'>
      {formatNumber(props.value)}
    </span>
  )
}

export function RequestLimitsCard(props: RequestLimitsCardProps) {
  const { t } = useTranslation()
  const unlimitedLabel = t('Unlimited')
  const limits = [
    {
      label: t('Max concurrent requests'),
      value: props.profile.max_concurrent_requests,
    },
    {
      label: t('Requests per minute'),
      value: props.profile.requests_per_minute,
    },
  ]

  return (
    <TitledCard
      title={t('Request Limits')}
      description={t('Limits applied to your account by an administrator.')}
      icon={<Gauge className='h-4 w-4' />}
      iconTone='chart-2'
      disableHoverEffect
    >
      <dl className='divide-border/60 grid grid-cols-2 divide-x'>
        {limits.map((limit) => (
          <div
            key={limit.label}
            className='min-w-0 px-1 py-1 first:ps-0 last:pe-0'
          >
            <dt className='text-muted-foreground truncate text-xs'>
              {limit.label}
            </dt>
            <dd className='mt-1.5'>
              <LimitValue value={limit.value} unlimitedLabel={unlimitedLabel} />
            </dd>
          </div>
        ))}
      </dl>
    </TitledCard>
  )
}
