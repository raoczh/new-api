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
import type { TFunction } from 'i18next'

import type { PricingModel, PriceType } from '../types'
import {
  getDynamicPriceUnitLabelKey,
  isUnconfiguredTaskUsageModel,
  type DynamicPriceOptions,
  type DynamicPricingSummary,
} from './dynamic-price'
import { isTokenBasedModel } from './model-helpers'
import { formatPrice, formatRequestPrice } from './price'
import { taskPriceLabel, taskUsageUnitLabel } from './task-price-display'

/**
 * One price a reader cares about, already formatted for display.
 */
export type ModelPriceFact = {
  key: string
  /** What is being paid for, e.g. `Input`. `null` when the unit says it. */
  label: string | null
  /** Formatted amount, including a range when providers differ. */
  value: string
  /** Priced unit, e.g. `1M tokens` or `request`. */
  unit: string
}

export type ModelPriceFacts =
  | { kind: 'facts'; facts: ModelPriceFact[] }
  /** The expression is beyond a simple price; show it as written. */
  | { kind: 'special-expression'; expression: string }
  /** Nothing to price yet. `noteKey` is an i18n key. */
  | { kind: 'note'; noteKey: string }

export type ModelPriceFactOptions = DynamicPriceOptions & {
  /** Group whose ratio is applied when no group is selected. */
  selectedGroup?: string
  /** UI language, used to resolve schema-provided labels. */
  language: string
}

/** How many price variants a compact line shows before it becomes noise. */
const COMPACT_PRICE_LIMIT = 2

/**
 * Derive the prices a compact row should show for a model. This is the
 * one-line counterpart of the detailed price blocks on the model card and the
 * comparison table: same formatters and same source of truth, fewer numbers.
 */
export function getModelPriceFacts(
  model: PricingModel,
  summary: DynamicPricingSummary | null,
  options: ModelPriceFactOptions,
  t: TFunction
): ModelPriceFacts {
  const tokenUnitLabel = options.tokenUnit === 'K' ? '1K' : '1M'
  const showRechargePrice = options.showRechargePrice ?? false
  const priceRate = options.priceRate ?? 1
  const usdExchangeRate = options.usdExchangeRate ?? 1

  if (summary) {
    if (summary.isSpecialExpression) {
      return { kind: 'special-expression', expression: summary.rawExpression }
    }
    const entries = [
      ...summary.primaryEntries.slice(
        0,
        summary.providerCount ? COMPACT_PRICE_LIMIT : undefined
      ),
      ...summary.secondaryEntries.filter(
        (entry) => entry.field === 'cacheReadPrice' && entry.unit === 'token'
      ),
    ]
    if (entries.length === 0) {
      return {
        kind: 'note',
        noteKey: summary.hasUnconfiguredProviders
          ? 'Usage-based billing · price not configured'
          : 'Dynamic Pricing',
      }
    }
    return {
      kind: 'facts',
      facts: entries.map((entry) => {
        const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
        return {
          key: entry.key,
          label:
            entry.labelKind === 'schema'
              ? taskPriceLabel(
                  entry.description,
                  entry.shortLabel,
                  options.language
                )
              : t(entry.shortLabel),
          value: entry.formattedRange ?? entry.formatted,
          unit: taskUsageUnitLabel(
            entry,
            options.language,
            unitLabelKey ? t(unitLabelKey) : tokenUnitLabel
          ),
        }
      }),
    }
  }

  if (isUnconfiguredTaskUsageModel(model)) {
    return {
      kind: 'note',
      noteKey: 'Usage-based billing · price not configured',
    }
  }

  if (isTokenBasedModel(model)) {
    const priceTypes: { type: PriceType; label: string }[] = [
      { type: 'input', label: t('Input') },
      { type: 'output', label: t('Output') },
      ...(model.cache_ratio != null
        ? [{ type: 'cache' as const, label: t('Cached') }]
        : []),
    ]
    return {
      kind: 'facts',
      facts: priceTypes.map(({ type, label }) => ({
        key: type,
        label,
        value: formatPrice(
          model,
          type,
          options.tokenUnit,
          showRechargePrice,
          priceRate,
          usdExchangeRate,
          options.selectedGroup
        ),
        unit: tokenUnitLabel,
      })),
    }
  }

  return {
    kind: 'facts',
    facts: [
      {
        key: 'request',
        label: null,
        value: formatRequestPrice(
          model,
          showRechargePrice,
          priceRate,
          usdExchangeRate,
          options.selectedGroup
        ),
        unit: t('request'),
      },
    ],
  }
}
