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
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import type { PricingModel, PricingVendor } from '../../types'
import { VendorModelList } from '../vendor-model-list'

function pricingModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'alpha',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 3,
    enable_groups: ['default'],
    group_ratio: { default: 1 },
    ...overrides,
  }
}

const VENDORS: PricingVendor[] = [
  { id: 1, name: 'First Vendor', description: 'Makes alpha and beta' },
  { id: 2, name: 'Second Vendor' },
]

const originalStorage = useSystemConfigStore.persist.getOptions().storage
beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size
    },
  })
  useSystemConfigStore.persist.setOptions({
    storage: createJSONStorage(() => localStorage),
  })
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'USD' },
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  vi.unstubAllGlobals()
  useSystemConfigStore.persist.setOptions({ storage: originalStorage })
})

describe('vendor model list', () => {
  it('groups models under their vendor with a count and the vendor blurb', () => {
    render(
      <VendorModelList
        models={[
          pricingModel({ id: 1, model_name: 'alpha', vendor_id: 1 }),
          pricingModel({ id: 2, model_name: 'beta', vendor_id: 1 }),
          pricingModel({ id: 3, model_name: 'gamma', vendor_id: 2 }),
        ]}
        vendors={VENDORS}
        onModelClick={() => {}}
      />
    )

    const first = screen.getByRole('region', { name: 'First Vendor' })
    expect(within(first).getByText('2 models')).toBeVisible()
    expect(within(first).getByText('Makes alpha and beta')).toBeVisible()
    expect(within(first).getByRole('button', { name: /alpha/ })).toBeVisible()
    expect(within(first).getByRole('button', { name: /beta/ })).toBeVisible()

    const second = screen.getByRole('region', { name: 'Second Vendor' })
    expect(within(second).getByText('1 models')).toBeVisible()
    expect(
      within(second).queryByRole('button', { name: /alpha/ })
    ).not.toBeInTheDocument()
  })

  it('shows what each model costs per unit next to its name', () => {
    render(
      <VendorModelList
        models={[pricingModel({ id: 1, model_name: 'alpha', vendor_id: 1 })]}
        vendors={VENDORS}
        onModelClick={() => {}}
      />
    )

    const row = screen.getByRole('button', { name: /alpha/ })
    expect(row).toHaveTextContent(/\$2\s*\/\s*1M/)
    expect(row).toHaveTextContent(/\$6\s*\/\s*1M/)
  })

  it('opens the details of the model whose row was used', () => {
    const onModelClick = vi.fn()
    render(
      <VendorModelList
        models={[
          pricingModel({ id: 1, model_name: 'alpha', vendor_id: 1 }),
          pricingModel({ id: 2, model_name: 'beta', vendor_id: 1 }),
        ]}
        vendors={VENDORS}
        onModelClick={onModelClick}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /beta/ }))

    expect(onModelClick).toHaveBeenCalledWith('beta')
  })

  it('offers a copy button per model without stealing the row click', () => {
    const onModelClick = vi.fn()
    render(
      <VendorModelList
        models={[pricingModel({ id: 1, model_name: 'alpha', vendor_id: 1 })]}
        vendors={VENDORS}
        onModelClick={onModelClick}
      />
    )

    const copy = screen.getAllByRole('button', { name: 'Copy model name' })
    expect(copy).toHaveLength(1)

    fireEvent.click(copy[0])

    expect(onModelClick).not.toHaveBeenCalled()
  })

  it('collects models without a vendor under a section of their own', () => {
    render(
      <VendorModelList
        models={[pricingModel({ id: 4, model_name: 'homeless' })]}
        vendors={VENDORS}
        onModelClick={() => {}}
      />
    )

    const other = screen.getByRole('region', { name: 'Other models' })
    expect(
      within(other).getByRole('button', { name: /homeless/ })
    ).toBeVisible()
  })

  it('renders nothing when there is no model to show', () => {
    const { container } = render(
      <VendorModelList models={[]} vendors={VENDORS} onModelClick={() => {}} />
    )

    expect(container).toBeEmptyDOMElement()
  })
})
