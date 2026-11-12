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
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/lib/lobe-icon'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { groupModelsByVendor } from '../lib/vendor-groups'
import type { PricingModel, PricingVendor, TokenUnit } from '../types'
import { ModelListRow } from './model-list-row'

export interface VendorModelListProps {
  models: PricingModel[]
  vendors: PricingVendor[]
  onModelClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  selectedGroup?: string
}

/**
 * Every enabled model as a dense list, one section per vendor. Reading top to
 * bottom answers "who makes this, what is it for, and what does it cost"
 * without opening anything.
 */
export const VendorModelList = memo(function VendorModelList(
  props: VendorModelListProps
) {
  const { t } = useTranslation()
  const groups = useMemo(
    () => groupModelsByVendor(props.models, props.vendors),
    [props.models, props.vendors]
  )
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT

  if (groups.length === 0) {
    return null
  }

  return (
    <div className='flex flex-col gap-4'>
      {groups.map((group) => (
        <section
          key={group.id ?? 'unassigned'}
          aria-label={group.name ?? t('Other models')}
          className='bg-card overflow-hidden rounded-xl border'
        >
          <header className='flex flex-col gap-1 border-b px-4 py-3'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              {group.icon && (
                <span aria-hidden className='shrink-0'>
                  {getLobeIcon(group.icon, 20)}
                </span>
              )}
              <h2 className='truncate text-sm font-semibold'>
                {group.name ?? t('Other models')}
              </h2>
              <span className='text-muted-foreground text-xs tabular-nums'>
                {t('{{count}} models', { count: group.models.length })}
              </span>
            </div>
            {group.description && (
              <p className='text-muted-foreground line-clamp-2 text-xs'>
                {group.description}
              </p>
            )}
          </header>
          <ul className='divide-border/60 flex flex-col divide-y p-1'>
            {group.models.map((model) => (
              <ModelListRow
                key={model.id ?? model.model_name}
                model={model}
                tokenUnit={tokenUnit}
                priceRate={props.priceRate}
                usdExchangeRate={props.usdExchangeRate}
                selectedGroup={props.selectedGroup}
                onClick={props.onModelClick}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
})
