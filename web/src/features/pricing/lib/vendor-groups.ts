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
import type { PricingModel, PricingVendor } from '../types'

export type VendorModelGroup = {
  /** Vendor id, or `null` for models that carry no vendor. */
  id: number | null
  /** Vendor display name, or `null` when the group holds models without one. */
  name: string | null
  icon?: string
  /** Vendor blurb, from the vendor record or the models themselves. */
  description?: string
  models: PricingModel[]
}

/**
 * Bucket models by the vendor offering them, so a flat list of models can be
 * read vendor by vendor. Group order follows the vendor list; models keep the
 * order they arrived in, which the caller has already sorted. Models without a
 * vendor form one trailing group.
 */
export function groupModelsByVendor(
  models: PricingModel[],
  vendors: PricingVendor[]
): VendorModelGroup[] {
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]))
  const groups = new Map<number | null, VendorModelGroup>()

  for (const model of models) {
    const id = model.vendor_id ?? null
    const vendor = id === null ? undefined : vendorById.get(id)
    let group = groups.get(id)
    if (!group) {
      group = {
        id,
        name: vendor?.name ?? model.vendor_name ?? null,
        icon: vendor?.icon ?? model.vendor_icon,
        description: undefined,
        models: [],
      }
      groups.set(id, group)
    }
    group.description ??=
      vendor?.description?.trim() ||
      model.vendor_description?.trim() ||
      undefined
    group.models.push(model)
  }

  // Vendors keep the order given by the caller; the unassigned bucket is last.
  const vendorRank = new Map(vendors.map((vendor, index) => [vendor.id, index]))
  const rankOf = (group: VendorModelGroup) =>
    group.id === null ? vendors.length : (vendorRank.get(group.id) ?? Infinity)
  return [...groups.values()].sort((a, b) => rankOf(a) - rankOf(b))
}
