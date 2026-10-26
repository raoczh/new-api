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

import { SYSTEM_SETTINGS_VIEW } from '../config/system-settings.config'
import type { NavGroup, SidebarView } from '../types'

/**
 * Registered nested sidebar views.
 *
 * Each entry describes a contextual sidebar that replaces the root
 * navigation when the user enters that workspace (Vercel-style
 * "drill-in" pattern). Add new entries here to register a new view.
 *
 * Match priority is array order; the first matching `pathPattern` wins.
 */
const SIDEBAR_VIEWS: readonly SidebarView[] = [SYSTEM_SETTINGS_VIEW]

/**
 * Resolve the active nested view for the given path.
 *
 * @returns Matching {@link SidebarView}, or `null` when the root
 *          navigation should be displayed.
 */
export function resolveSidebarView(pathname: string): SidebarView | null {
  return SIDEBAR_VIEWS.find((view) => view.pathPattern.test(pathname)) ?? null
}

/**
 * Hide navigation items whose `requiredRole` exceeds the given role.
 *
 * Nested views are not passed through `useSidebarConfig`, but they can still
 * contain role-gated entries (e.g. super-admin-only pages), so the same
 * role check used for the root navigation must be applied here.
 */
export function filterNavGroupsByRole(
  navGroups: NavGroup[],
  role: number
): NavGroup[] {
  return navGroups
    .map((group) => {
      const items = group.items.filter(
        (item) => item.requiredRole === undefined || role >= item.requiredRole
      )
      return items.length === group.items.length ? group : { ...group, items }
    })
    .filter((group) => group.items.length > 0)
}
