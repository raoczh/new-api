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
import type { ApiKey } from '../types'
import type { ApiKeyFormValues } from './api-key-form'

/** Groups without a configured vendor are offered together under this id. */
export const UNASSIGNED_VENDOR_ID = 0

// The server rejects names longer than 50 bytes (controller/token.go).
const MAX_KEY_NAME_BYTES = 50

export type KeyVendor = {
  id: number
  name: string
  icon?: string
  description?: string
}

export type KeyVendorChoice = KeyVendor & {
  /** Group names of this vendor, in the administrator's display order. */
  groups: string[]
}

/**
 * Sort the user's groups under the vendor the administrator assigned to each,
 * keeping the configured display order for both vendors and their groups.
 */
export function groupKeyVendors(
  groups: Record<string, { vendor_id?: number }>,
  vendors: KeyVendor[],
  groupOrder: string[]
): KeyVendorChoice[] {
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]))
  const choices = new Map<number, KeyVendorChoice>()
  const ordered = groupOrder.filter((name) => name in groups)
  const names = [
    ...ordered,
    ...Object.keys(groups).filter((name) => !ordered.includes(name)),
  ]

  for (const name of names) {
    if (name === 'auto') continue
    const vendor = vendorById.get(groups[name].vendor_id ?? 0)
    const id = vendor?.id ?? UNASSIGNED_VENDOR_ID
    const choice = choices.get(id)
    if (choice) {
      choice.groups.push(name)
      continue
    }
    choices.set(id, {
      id,
      name: vendor?.name ?? '',
      icon: vendor?.icon,
      description: vendor?.description,
      groups: [name],
    })
  }

  const result = [...choices.values()]
  return [
    ...result.filter((choice) => choice.id !== UNASSIGNED_VENDOR_ID),
    ...result.filter((choice) => choice.id === UNASSIGNED_VENDOR_ID),
  ]
}

/**
 * The lines a vendor's key tries by default: the administrator's global Auto
 * order narrowed to that vendor. A vendor left out of the Auto order still
 * gets its first group, so every vendor can be used.
 */
export function resolveVendorAutoRoute(
  vendorGroups: string[],
  globalAutoGroups: string[],
  maxCount: number
): string[] {
  const available = new Set(vendorGroups)
  const route = globalAutoGroups
    .filter((group) => available.has(group))
    .slice(0, Math.max(1, maxCount))
  return route.length > 0 ? route : vendorGroups.slice(0, 1)
}

/**
 * Map an ordered list of lines to the stored key fields. One line is stored as
 * a plain group; several lines use Auto with that order and cross-group retry.
 */
export function routeToKeyGroups(
  route: string[]
): Pick<
  ApiKeyFormValues,
  'group' | 'auto_groups_mode' | 'auto_groups' | 'cross_group_retry'
> {
  if (route.length > 1) {
    return {
      group: 'auto',
      auto_groups_mode: 'custom',
      auto_groups: route,
      cross_group_retry: true,
    }
  }
  return {
    group: route[0] ?? '',
    auto_groups_mode: 'inherit',
    auto_groups: [],
    cross_group_retry: false,
  }
}

/**
 * The ordered lines a stored key uses, the inverse of routeToKeyGroups. An
 * Auto key without an order of its own follows the site-wide order; lines the
 * account can no longer use are left out of an Auto order. A key that follows
 * the account's group has no line of its own.
 */
export function keyToRoute(
  apiKey: Pick<ApiKey, 'group' | 'auto_groups'>,
  globalAutoGroups: string[],
  availableLines: string[]
): string[] {
  if (apiKey.group !== 'auto') return apiKey.group ? [apiKey.group] : []
  const own = apiKey.auto_groups ?? []
  return (own.length > 0 ? own : globalAutoGroups).filter((line) =>
    availableLines.includes(line)
  )
}

/** Default key name: the vendor followed by the first line. */
export function suggestKeyName(vendorName: string, group: string): string {
  const name = [vendorName, group].filter(Boolean).join('-')
  const encoder = new TextEncoder()
  const characters = [...name]
  while (encoder.encode(characters.join('')).length > MAX_KEY_NAME_BYTES) {
    characters.pop()
  }
  return characters.join('')
}
