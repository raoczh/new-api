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
import { Check, Layers, RotateCcw, Store } from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { FILTER_ALL } from '../constants'
import type { PricingModel, PricingVendor } from '../types'

type FilterOption = {
  value: string
  label: string
  count?: number
  suffix?: string
  icon?: ReactNode
}

export interface PricingFiltersProps {
  vendorFilter: string
  groupFilter: string
  onVendorChange: (value: string) => void
  onGroupChange: (value: string) => void
  vendors: PricingVendor[]
  groups: string[]
  groupRatios?: Record<string, number>
  models: PricingModel[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  className?: string
}

function formatGroupRatio(ratio: number | undefined): string | undefined {
  if (ratio == null) return undefined
  const formatted = Number.isInteger(ratio)
    ? ratio.toString()
    : ratio.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `x${formatted}`
}

function FilterChip(props: {
  option: FilterOption
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      onClick={props.onClick}
      aria-pressed={props.active}
      title={props.option.label}
      className={cn(
        'h-7 max-w-full gap-1.5 rounded-full border px-2.5 text-xs font-normal shadow-none transition-colors',
        props.active
          ? 'border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15 font-medium'
          : 'text-muted-foreground hover:border-primary/30 hover:text-foreground'
      )}
    >
      {props.active ? (
        <Check className='text-primary size-3 shrink-0' aria-hidden='true' />
      ) : null}
      {props.option.icon && (
        <span className='shrink-0'>{props.option.icon}</span>
      )}
      <span className='truncate'>{props.option.label}</span>
      {(props.option.suffix || props.option.count != null) && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
            props.active
              ? 'bg-primary/15 text-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {props.option.suffix ?? props.option.count}
        </span>
      )}
    </Button>
  )
}

function FilterRow(props: {
  icon: ReactNode
  label: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className='flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3'>
      <div className='text-muted-foreground flex shrink-0 items-center gap-1.5 pt-1.5 text-xs font-medium sm:w-14 sm:justify-end'>
        {props.icon}
        <span>{props.label}</span>
      </div>
      <div className='flex min-w-0 flex-wrap gap-1.5'>
        {props.options.map((option) => (
          <FilterChip
            key={option.value}
            option={option}
            active={props.value === option.value}
            onClick={() => props.onChange(option.value)}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Filter bar that sits right above the model list: the same provider and group
 * choices the page used to keep in a side column, laid out as chips so the
 * reader sees what is being filtered before scrolling into the list.
 */
export const PricingFilters = memo(function PricingFilters(
  props: PricingFiltersProps
) {
  const { t } = useTranslation()
  const vendorCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const model of props.models) {
      if (!model.vendor_name) continue
      counts.set(model.vendor_name, (counts.get(model.vendor_name) ?? 0) + 1)
    }
    return counts
  }, [props.models])

  const vendorOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('All Vendors'),
      count: props.models.length,
    },
    ...props.vendors
      .map((vendor) => ({
        value: vendor.name,
        label: vendor.name,
        count: vendorCounts.get(vendor.name) ?? 0,
        icon: vendor.icon ? getLobeIcon(vendor.icon, 14) : undefined,
      }))
      .filter((vendor) => vendor.count > 0),
  ]

  const groupOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('All Groups'),
    },
    ...props.groups.map((group) => ({
      value: group,
      label: group,
      suffix: formatGroupRatio(props.groupRatios?.[group]),
    })),
  ]

  return (
    <section
      aria-label={t('Filter')}
      className={cn('bg-card rounded-xl border p-3 sm:p-4', props.className)}
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <h2 className='text-foreground text-sm font-semibold'>
            {t('Filter')}
          </h2>
          {props.hasActiveFilters && (
            <Badge variant='secondary' className='h-5 px-1.5 text-[11px]'>
              {t('Filters active')}
            </Badge>
          )}
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={props.onClearFilters}
          disabled={!props.hasActiveFilters}
          className='h-7 gap-1.5 px-2 text-xs'
        >
          <RotateCcw className='size-3.5' />
          {t('Reset')}
        </Button>
      </div>

      <div className='mt-3 space-y-2.5'>
        <FilterRow
          icon={<Store className='size-3.5' aria-hidden='true' />}
          label={t('Vendors')}
          options={vendorOptions}
          value={props.vendorFilter}
          onChange={props.onVendorChange}
        />
        <FilterRow
          icon={<Layers className='size-3.5' aria-hidden='true' />}
          label={t('Groups')}
          options={groupOptions}
          value={props.groupFilter}
          onChange={props.onGroupChange}
        />
      </div>
    </section>
  )
})
