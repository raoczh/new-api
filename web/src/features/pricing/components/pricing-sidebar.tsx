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
import { ChevronDown, RotateCcw } from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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

type FilterSectionProps = {
  title: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

export interface PricingSidebarProps {
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
      variant={props.active ? 'secondary' : 'outline'}
      size='sm'
      onClick={props.onClick}
      aria-pressed={props.active}
      className='h-auto max-w-full gap-1.5 px-2 py-1 text-xs'
      title={props.option.label}
    >
      {props.option.icon && (
        <span className='shrink-0'>{props.option.icon}</span>
      )}
      <span className='truncate'>{props.option.label}</span>
      {(props.option.suffix || props.option.count != null) && (
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[12px]',
            props.active
              ? 'bg-background text-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {props.option.suffix ?? props.option.count}
        </span>
      )}
    </Button>
  )
}

function FilterSection(props: FilterSectionProps) {
  return (
    <Collapsible
      defaultOpen
      className='border-border/70 border-b pb-3 last:border-b-0'
    >
      <CollapsibleTrigger className='group flex w-full items-center justify-between py-2.5 text-left'>
        <span className='text-foreground text-sm font-semibold'>
          {props.title}
        </span>
        <ChevronDown className='text-muted-foreground size-4 transition-transform group-data-[panel-open]:rotate-180' />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className='flex flex-wrap gap-1.5'>
          {props.options.map((option) => (
            <FilterChip
              key={option.value}
              option={option}
              active={props.value === option.value}
              onClick={() => props.onChange(option.value)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export const PricingSidebar = memo(function PricingSidebar(
  props: PricingSidebarProps
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
    <aside className={cn('bg-card rounded-xl border p-3', props.className)}>
      <div className='mb-2.5 flex items-center justify-between gap-2'>
        <div>
          <h2 className='text-foreground text-sm font-bold'>{t('Filter')}</h2>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t('Refine models by provider and group.')}
          </p>
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

      {props.hasActiveFilters && (
        <Badge variant='secondary' className='mb-3'>
          {t('Filters active')}
        </Badge>
      )}

      <div className='space-y-1'>
        <FilterSection
          title={t('All Vendors')}
          value={props.vendorFilter}
          options={vendorOptions}
          onChange={props.onVendorChange}
        />
        <FilterSection
          title={t('Groups')}
          value={props.groupFilter}
          options={groupOptions}
          onChange={props.onGroupChange}
        />
      </div>
    </aside>
  )
})
