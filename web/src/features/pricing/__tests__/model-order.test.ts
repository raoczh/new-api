import { describe, expect, it } from 'vitest'

import { SORT_OPTIONS } from '../constants'
import { sortModels } from '../lib/filters'
import type { PricingModel } from '../types'

function model(name: string, groups: string[], price: number): PricingModel {
  return {
    id: 1,
    model_name: name,
    quota_type: 1,
    model_ratio: 1,
    model_price: price,
    completion_ratio: 1,
    enable_groups: groups,
  }
}

describe('pricing model group order', () => {
  const models = [
    model('zeta', ['premium'], 1),
    model('alpha', ['default'], 9),
    model('multi', ['premium', 'default'], 5),
    model('beta', ['default'], 2),
  ]

  it('orders configured groups first and preserves the selected name or price sort inside them', () => {
    expect(
      sortModels(models, SORT_OPTIONS.PRICE_LOW, ['default', 'premium']).map(
        (item) => item.model_name
      )
    ).toEqual(['beta', 'multi', 'alpha', 'zeta'])
    expect(
      sortModels(models, SORT_OPTIONS.PRICE_HIGH, ['default', 'premium']).map(
        (item) => item.model_name
      )
    ).toEqual(['alpha', 'multi', 'beta', 'zeta'])
    expect(
      sortModels(models, SORT_OPTIONS.NAME, ['default', 'premium']).map(
        (item) => item.model_name
      )
    ).toEqual(['alpha', 'beta', 'multi', 'zeta'])
  })
})
