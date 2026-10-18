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

import type {
  ImageStudioModelOption,
  ImageStudioOptionGroup,
} from '../hooks/use-image-studio-options'

/** `value` embeds the group because one model can exist in several groups. */
function optionValue(group: string, model: string): string {
  return `${group}\u0000${model}`
}

export function parseModelOptionValue(
  value: string
): { group: string; model: string } {
  const index = value.indexOf('\u0000')
  if (index < 0) return { group: '', model: value }
  return { group: value.slice(0, index), model: value.slice(index + 1) }
}

/**
 * The ratio line under a model name: group multiplier plus, for per-call
 * models, the exact amount one image will cost in the current group.
 *
 * Token-billed models intentionally show no amount: the charge depends on the
 * number of output tokens, and inventing a fixed estimate would be misleading.
 */
export function summarizeModelMeta(
  model: ImageStudioModelOption,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const ratioText = t('Ratio: {{value}}', {
    value: formatRatio(model.group_ratio),
  })
  if (model.quota_type === 1 && model.price > 0) {
    const price = formatBillingCurrencyFromUSD(model.price, {
      digitsLarge: 4,
      digitsSmall: 6,
    })
    return `${ratioText} · ${t('{{price}} / image', { price })}`
  }
  return ratioText
}

export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return '-'
  // Trim float noise from multiplied ratios (1.3000000000000003).
  return String(Number(ratio.toFixed(4)))
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
