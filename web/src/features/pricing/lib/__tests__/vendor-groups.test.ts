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
import { describe, expect, it } from 'vitest'

import type { PricingModel, PricingVendor } from '../../types'
import { groupModelsByVendor } from '../vendor-groups'

function model(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'example-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    ...overrides,
  }
}

function vendor(overrides: Partial<PricingVendor>): PricingVendor {
  return { id: 1, name: 'example-vendor', ...overrides }
}

describe('groupModelsByVendor', () => {
  it('files each model under the vendor that offers it', () => {
    const groups = groupModelsByVendor(
      [
        model({ id: 1, model_name: 'alpha', vendor_id: 2 }),
        model({ id: 2, model_name: 'beta', vendor_id: 1 }),
        model({ id: 3, model_name: 'gamma', vendor_id: 1 }),
      ],
      [vendor({ id: 1, name: 'First' }), vendor({ id: 2, name: 'Second' })]
    )

    expect(groups.map((group) => group.name)).toEqual(['First', 'Second'])
    expect(groups[0].models.map((item) => item.model_name)).toEqual([
      'beta',
      'gamma',
    ])
    expect(groups[1].models.map((item) => item.model_name)).toEqual(['alpha'])
  })

  it('keeps the order models arrived in inside a group', () => {
    const groups = groupModelsByVendor(
      [
        model({ id: 1, model_name: 'third', vendor_id: 1 }),
        model({ id: 2, model_name: 'first', vendor_id: 1 }),
        model({ id: 3, model_name: 'second', vendor_id: 1 }),
      ],
      [vendor({ id: 1 })]
    )

    expect(groups[0].models.map((item) => item.model_name)).toEqual([
      'third',
      'first',
      'second',
    ])
  })

  it('orders groups by the vendor list, not by the model list', () => {
    const groups = groupModelsByVendor(
      [model({ id: 1, vendor_id: 9 }), model({ id: 2, vendor_id: 3 })],
      [vendor({ id: 3, name: 'Third' }), vendor({ id: 9, name: 'Ninth' })]
    )

    expect(groups.map((group) => group.name)).toEqual(['Third', 'Ninth'])
  })

  it('collects models without a vendor in one trailing group', () => {
    const groups = groupModelsByVendor(
      [
        model({ id: 1, model_name: 'homeless', vendor_name: undefined }),
        model({ id: 2, vendor_id: 1 }),
        model({ id: 3, model_name: 'named', vendor_name: 'Legacy' }),
      ],
      [vendor({ id: 1, name: 'First' })]
    )

    expect(groups.map((group) => group.name)).toEqual(['First', null])
    expect(groups[1].id).toBeNull()
    expect(groups[1].models.map((item) => item.model_name)).toEqual([
      'homeless',
      'named',
    ])
  })

  it('takes the vendor blurb from the vendor record, falling back to the model', () => {
    const groups = groupModelsByVendor(
      [
        model({ id: 1, vendor_id: 1, vendor_description: 'from the model' }),
        model({ id: 2, vendor_id: 2, vendor_description: 'from the model' }),
      ],
      [
        vendor({ id: 1, name: 'With blurb', description: 'from the vendor' }),
        vendor({ id: 2, name: 'Without blurb' }),
      ]
    )

    expect(groups[0].description).toBe('from the vendor')
    expect(groups[1].description).toBe('from the model')
  })

  it('returns no groups when there are no models', () => {
    expect(groupModelsByVendor([], [vendor({ id: 1 })])).toEqual([])
  })
})
