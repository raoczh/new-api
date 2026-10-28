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
import type { ModelOption } from '@/components/model-group-selector'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'

import type { ImageStudioOptionGroup } from '../hooks/use-image-studio-options'
import type { ImageStudioModelOption } from '../types'

/** `value` embeds the group because one model can exist in several groups. */
function optionValue(group: string, model: string): string {
  return `${group}\u0000${model}`
}

export function parseModelOptionValue(value: string): {
  group: string
  model: string
} {
  const index = value.indexOf('\u0000')
  if (index < 0) return { group: '', model: value }
  return { group: value.slice(0, index), model: value.slice(index + 1) }
}

/**
 * The line under a model name: the fixed charge of a per-call model, or the
 * input and output token prices of a token-billed one. The group multiplier is
 * already applied by the server and is not shown on its own.
 *
 * `price_unit` comes from the billing expression and is authoritative. Older
 * servers only send `quota_type`, so a per-call model without a unit keeps the
 * historical per-image label.
 *
 * Token prices are USD per 1M tokens. Each one is omitted when the billing
 * expression never prices that category, and a model with no displayable price
 * returns an empty string so the row stays single-line.
 */
export function summarizeModelMeta(
  model: ImageStudioModelOption,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (model.price > 0) {
    const price = formatBillingCurrencyFromUSD(model.price, {
      digitsLarge: 4,
      digitsSmall: 6,
    })
    if (model.price_unit === 'request') {
      return `${price} / ${t('request')}`
    }
    if (model.price_unit === 'image' || model.quota_type === 1) {
      return t('{{price}} / image', { price })
    }
  }

  const tokenPrices = [
    ['Input {{price}} / 1M tokens', model.input_price],
    ['Output {{price}} / 1M tokens', model.output_price],
  ] as const
  const lines: string[] = []
  for (const [key, amount] of tokenPrices) {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      continue
    }
    lines.push(
      t(key, {
        price: formatBillingCurrencyFromUSD(amount, {
          digitsLarge: 4,
          digitsSmall: 6,
        }),
      })
    )
  }
  return lines.join(' · ')
}

/** Flatten groups into the selector's option list, preserving group order. */
export function buildModelOptions(
  groups: ImageStudioOptionGroup[],
  t: (key: string, options?: Record<string, unknown>) => string
): ModelOption[] {
  const options: ModelOption[] = []
  for (const group of groups) {
    for (const model of group.models) {
      options.push({
        label: model.model,
        value: optionValue(group.group, model.model),
        category: group.group,
        description: model.description,
        meta: summarizeModelMeta(model, t),
      })
    }
  }
  return options
}

export function buildGroupOptions(
  groups: ImageStudioOptionGroup[],
  t: (key: string, options?: Record<string, unknown>) => string
): { label: string; value: string; ratio: number; desc?: string }[] {
  return groups.map((group) => ({
    label: group.group,
    value: group.group,
    // Keep a number so the shared selector renders the ratio, not "auto".
    ratio: Number(group.ratio.toFixed(4)),
    desc: t('{{count}} image models', { count: group.models.length }),
  }))
}
