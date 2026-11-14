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
import { ChevronRight } from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { getLobeIcon } from '@/lib/lobe-icon'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useBillingTime } from '../hooks/use-billing-time'
import { pickChatGroup } from '../lib/chat-group'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import {
  getModelPriceFacts,
  type ModelPriceFactOptions,
} from '../lib/price-facts'
import type { PricingModel, TokenUnit } from '../types'
import { StartChatAction } from './start-chat-action'

export interface ModelListRowProps {
  model: PricingModel
  onClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  selectedGroup?: string
  /** The reader's groups; when given the row offers to chat with the model. */
  chatGroups?: string[]
}

const MAX_TAGS_IN_ROW = 3

// The chat button stays out of the way until the row is pointed at or reached
// with the keyboard, then slides in from the right with a slight overshoot. A
// device without hover shows it all the time.
const CHAT_REVEAL_CLASS_NAME =
  'grid shrink-0 grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity] duration-300 ease-out group-hover/model-row:grid-cols-[1fr] group-hover/model-row:opacity-100 group-focus-within/model-row:grid-cols-[1fr] group-focus-within/model-row:opacity-100 [@media(hover:none)]:grid-cols-[1fr] [@media(hover:none)]:opacity-100 motion-reduce:transition-none'

// A band of light crosses the button once it has slid in, and its icon tilts.
const CHAT_BUTTON_CLASS_NAME =
  "relative translate-x-3 overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/model-row:translate-x-0 group-focus-within/model-row:translate-x-0 [@media(hover:none)]:translate-x-0 focus-visible:ring-inset before:pointer-events-none before:absolute before:inset-y-0 before:-left-1/2 before:w-1/3 before:-skew-x-12 before:bg-white/35 before:transition-[left] before:delay-150 before:duration-700 before:ease-out before:content-[''] group-hover/model-row:before:left-[130%] [&_svg]:transition-transform [&_svg]:duration-300 group-hover/model-row:[&_svg]:-rotate-12 group-hover/model-row:[&_svg]:scale-110 motion-reduce:translate-x-0 motion-reduce:transition-none motion-reduce:before:hidden"

/**
 * One model of the vendor-grouped list: the name and what it is good for on the
 * left, its prices on the right, and the whole row opening the model details.
 */
export const ModelListRow = memo(function ModelListRow(
  props: ModelListRowProps
) {
  const { t, i18n } = useTranslation()
  const currency = useSystemConfigStore((state) => state.config.currency)
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const billingTime = useBillingTime(props.model.billing_expr)
  const options = useMemo<ModelPriceFactOptions>(
    () => ({
      now: billingTime === undefined ? undefined : new Date(billingTime),
      tokenUnit,
      showRechargePrice: false,
      priceRate: props.priceRate ?? 1,
      usdExchangeRate: props.usdExchangeRate ?? 1,
      groupRatioMultiplier: getDynamicDisplayGroupRatio(
        props.model,
        props.selectedGroup
      ),
      selectedGroup: props.selectedGroup,
      language: i18n.language,
    }),
    [
      props.model,
      props.selectedGroup,
      props.priceRate,
      props.usdExchangeRate,
      billingTime,
      tokenUnit,
      i18n.language,
    ]
  )
  const summary = useMemo(
    () => getDynamicPricingSummary(props.model, options),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, options, currency]
  )
  const facts = useMemo(
    () => getModelPriceFacts(props.model, summary, options, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, summary, options, t, currency]
  )

  const tags = parseTags(props.model.tags)
  const visibleTags = tags.slice(0, MAX_TAGS_IN_ROW)
  const iconKey = props.model.icon || props.model.vendor_icon
  const icon = iconKey ? getLobeIcon(iconKey, 22) : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'

  let price: ReactNode
  if (facts.kind === 'special-expression') {
    price = (
      <span className='text-warning text-xs'>
        {t('Special billing expression')}
      </span>
    )
  } else if (facts.kind === 'note') {
    price = (
      <span className='text-muted-foreground text-xs'>{t(facts.noteKey)}</span>
    )
  } else {
    price = (
      <span className='flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:justify-end'>
        {facts.facts.map((fact) => (
          <span key={fact.key} className='flex items-baseline gap-1'>
            {fact.label && (
              <span className='text-muted-foreground text-xs'>
                {fact.label}
              </span>
            )}
            <span className='font-mono text-sm font-semibold tabular-nums'>
              {fact.value}
            </span>
            <span className='text-muted-foreground text-xs whitespace-nowrap'>
              / {fact.unit}
            </span>
          </span>
        ))}
      </span>
    )
  }

  return (
    <li className='group/model-row flex items-center gap-1'>
      <button
        type='button'
        onClick={() => props.onClick(props.model.model_name || '')}
        className='hover:bg-muted/50 focus-visible:ring-ring/50 flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg px-2 py-2 text-left transition-colors outline-none focus-visible:ring-2 sm:flex-row sm:items-center sm:gap-4'
      >
        <span className='flex min-w-0 flex-1 items-center gap-3'>
          <span
            aria-hidden
            className='bg-muted/50 flex size-8 shrink-0 items-center justify-center rounded-md'
          >
            {icon || (
              <span className='text-muted-foreground text-xs font-bold'>
                {initial}
              </span>
            )}
          </span>
          <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
            <span className='truncate font-mono text-sm font-semibold'>
              {props.model.model_name}
            </span>
            {props.model.description && (
              <span className='text-muted-foreground line-clamp-1 text-xs'>
                {props.model.description}
              </span>
            )}
            {visibleTags.length > 0 && (
              <span className='text-muted-foreground truncate text-xs'>
                {visibleTags.join(' · ')}
                {tags.length > visibleTags.length &&
                  ` +${tags.length - visibleTags.length}`}
              </span>
            )}
          </span>
        </span>
        <span className='flex shrink-0 items-center gap-2'>
          {price}
          <ChevronRight
            aria-hidden
            className='text-muted-foreground size-4 shrink-0'
          />
        </span>
      </button>
      {props.chatGroups && (
        <span className={CHAT_REVEAL_CLASS_NAME}>
          <span className='min-w-0 overflow-hidden'>
            <StartChatAction
              modelName={props.model.model_name ?? ''}
              group={pickChatGroup(
                props.model.enable_groups,
                props.chatGroups,
                props.selectedGroup
              )}
              className={CHAT_BUTTON_CLASS_NAME}
            />
          </span>
        </span>
      )}
      <CopyButton
        value={props.model.model_name}
        tooltip={t('Copy model name')}
        className='size-7 shrink-0'
        iconClassName='size-3.5'
      />
    </li>
  )
})
