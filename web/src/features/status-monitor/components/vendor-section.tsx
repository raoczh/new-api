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
import { Boxes } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/lib/lobe-icon'

import type { VendorSection as VendorSectionData } from '../lib/status'
import type { GroupStatus } from '../types'
import { GroupStatusCard } from './group-status-card'

interface VendorSectionProps {
  section: VendorSectionData
  hourlyStart: number
  windowLabel: string
  onOpenDetails: (group: GroupStatus) => void
}

export function VendorSection(props: VendorSectionProps) {
  const { t } = useTranslation()
  const name = props.section.vendor?.name ?? t('Other vendors')
  const icon = props.section.vendor?.icon
    ? getLobeIcon(props.section.vendor.icon, 18)
    : null
  const headingId = `vendor-section-${props.section.vendorId}`

  return (
    <section
      aria-labelledby={headingId}
      className='flex flex-col gap-3 border-b pb-6 last:border-b-0 last:pb-0'
    >
      <div className='flex items-center gap-2.5'>
        <span className='bg-card flex size-8 items-center justify-center rounded-lg border'>
          {icon ?? (
            <Boxes
              className='text-muted-foreground size-4'
              aria-hidden='true'
            />
          )}
        </span>
        <h2 id={headingId} className='text-base font-semibold'>
          {name}
        </h2>
        <span className='text-muted-foreground text-xs'>
          {t('{{count}} groups', { count: props.section.groups.length })}
        </span>
      </div>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {props.section.groups.map((group) => (
          <GroupStatusCard
            key={group.group}
            group={group}
            hourlyStart={props.hourlyStart}
            windowLabel={props.windowLabel}
            vendor={props.section.vendor}
            onOpenDetails={props.onOpenDetails}
          />
        ))}
      </div>
    </section>
  )
}
