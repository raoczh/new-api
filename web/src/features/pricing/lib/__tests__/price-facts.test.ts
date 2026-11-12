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
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'

import type { PricingModel } from '../../types'
import { getDynamicPricingSummary } from '../dynamic-price'
import { getModelPriceFacts, type ModelPriceFactOptions } from '../price-facts'

const t = i18next.t.bind(i18next)

function model(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'example-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 3,
    enable_groups: ['default'],
    group_ratio: { default: 1 },
    ...overrides,
  }
}

function options(
  overrides: Partial<ModelPriceFactOptions> = {}
): ModelPriceFactOptions {
  return { tokenUnit: 'M', language: 'en', ...overrides }
}

function factsOf(
  target: PricingModel,
  overrides: Partial<ModelPriceFactOptions> = {}
) {
  const priceOptions = options(overrides)
  return getModelPriceFacts(
    target,
    getDynamicPricingSummary(target, priceOptions),
    priceOptions,
    t
  )
}

describe('getModelPriceFacts', () => {
  it('lists the input and output price of a token model per million tokens', () => {
    const facts = factsOf(model())

    expect(facts).toEqual({
      kind: 'facts',
      facts: [
        { key: 'input', label: 'Input', value: '$2', unit: '1M' },
        { key: 'output', label: 'Output', value: '$6', unit: '1M' },
      ],
    })
  })

  it('adds the cache price only when the model has one', () => {
    const facts = factsOf(model({ cache_ratio: 0.1 }))

    expect(
      facts.kind === 'facts' && facts.facts.map((fact) => fact.key)
    ).toEqual(['input', 'output', 'cache'])
    expect(facts.kind === 'facts' && facts.facts[2]).toEqual({
      key: 'cache',
      label: 'Cached',
      value: '$0.2',
      unit: '1M',
    })
  })

  it('prices per thousand tokens when the reader asks for the smaller unit', () => {
    const facts = factsOf(model(), { tokenUnit: 'K' })

    expect(facts.kind === 'facts' && facts.facts[0]).toEqual({
      key: 'input',
      label: 'Input',
      value: '$0.002',
      unit: '1K',
    })
  })

  it('applies the selected group ratio', () => {
    const facts = factsOf(
      model({
        enable_groups: ['default', 'premium'],
        group_ratio: { default: 1, premium: 3 },
      }),
      { selectedGroup: 'premium' }
    )

    expect(facts.kind === 'facts' && facts.facts[0].value).toBe('$6')
  })

  it('shows one per-request price for a request-priced model', () => {
    const facts = factsOf(
      model({
        quota_type: 1,
        model_price: 0.5,
        model_ratio: 0,
        completion_ratio: 0,
      })
    )

    expect(facts).toEqual({
      kind: 'facts',
      facts: [{ key: 'request', label: null, value: '$0.5', unit: 'request' }],
    })
  })

  it('takes the price entries of a dynamically priced model', () => {
    const facts = factsOf(
      model({
        billing_mode: 'tiered_expr',
        billing_expr: 'tier("short", p * 4 + c * 8)',
      })
    )

    expect(facts).toEqual({
      kind: 'facts',
      facts: [
        { key: 'p', label: 'Input', value: '$4', unit: '1M' },
        { key: 'c', label: 'Output', value: '$8', unit: '1M' },
      ],
    })
  })

  it('shows the expression itself when it cannot be read as simple prices', () => {
    const facts = factsOf(
      model({ billing_mode: 'tiered_expr', billing_expr: 'p * input_len ^ 2' })
    )

    expect(facts).toEqual({
      kind: 'special-expression',
      expression: 'p * input_len ^ 2',
    })
  })

  it('says the price is not configured for usage-billed models without one', () => {
    const facts = factsOf(
      model({
        billing_usage_schema: {
          image_count: { type: 'number', unit: 'count' },
        },
      })
    )

    expect(facts).toEqual({
      kind: 'note',
      noteKey: 'Usage-based billing · price not configured',
    })
  })
})
