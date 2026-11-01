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
import { z } from 'zod'

import {
  type PermissionCatalog,
  type AdminPermissionMatrix,
  normalizeAdminPermissions,
} from '@/lib/admin-permissions'
import { quotaUnitsToDollars } from '@/lib/format'
import { ROLE } from '@/lib/roles'

import { DEFAULT_GROUP } from '../constants'
import type { UserFormData, User } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

export const userFormSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  display_name: z.string().optional(),
  password: z.string().optional(),
  role: z.number().optional(),
  quota_dollars: z.number().min(0).optional(),
  group: z.string().optional(),
  remark: z.string().optional(),
  max_concurrent_requests: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .optional(),
  requests_per_minute: z.number().int().min(0).max(1_000_000).optional(),
  extra_usable_groups: z.array(z.string()).max(100).optional(),
  hidden_usable_groups: z.array(z.string()).max(100).optional(),
  admin_permissions: z
    .record(z.string(), z.record(z.string(), z.boolean()))
    .optional(),
})

export type UserFormValues = z.infer<typeof userFormSchema>

// ============================================================================
// Form Defaults
// ============================================================================

export const USER_FORM_DEFAULT_VALUES: UserFormValues = {
  username: '',
  display_name: '',
  password: '',
  role: 1, // Default to common user
  quota_dollars: 0,
  group: DEFAULT_GROUP,
  remark: '',
  max_concurrent_requests: 0,
  requests_per_minute: 0,
  extra_usable_groups: [],
  hidden_usable_groups: [],
  // Filled against the backend catalog at render time; see UsersMutateDrawer.
  admin_permissions: {},
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/** Usable group overrides as the server returned them for the edited user. */
export type LoadedUsableGroups = { extra: string[]; hidden: string[] }

/**
 * Transform form data to API payload. Usable group lists are only sent when
 * they differ from `loadedGroups`; without it they are never sent, so a form
 * that failed to load cannot overwrite what the server stores.
 */
export function transformFormDataToPayload(
  data: UserFormValues,
  userId?: number,
  catalog?: PermissionCatalog,
  loadedGroups?: LoadedUsableGroups
): UserFormData & { id?: number } {
  const payload: UserFormData & { id?: number } = {
    username: data.username,
    display_name: data.display_name || data.username,
    password: data.password || undefined,
  }

  const role = userId === undefined ? data.role || 1 : (data.role ?? 0)

  // Only send the permission matrix when the target is an admin and the catalog
  // is available; without the catalog we cannot build a full matrix, so we omit
  // the field (the backend then leaves existing permissions untouched).
  if (role >= ROLE.ADMIN && catalog) {
    payload.admin_permissions = normalizeAdminPermissions(
      data.admin_permissions as AdminPermissionMatrix | undefined,
      catalog
    )
  }

  // For create: only send required fields
  if (userId === undefined) {
    payload.role = role
  } else {
    // For update: quota is adjusted atomically via /api/user/manage, not sent here
    payload.group = data.group
    payload.remark = data.remark || undefined
    payload.max_concurrent_requests = data.max_concurrent_requests ?? 0
    payload.requests_per_minute = data.requests_per_minute ?? 0
    if (loadedGroups) {
      const extra = data.extra_usable_groups ?? []
      const hidden = data.hidden_usable_groups ?? []
      if (JSON.stringify(extra) !== JSON.stringify(loadedGroups.extra)) {
        payload.extra_usable_groups = extra
      }
      if (JSON.stringify(hidden) !== JSON.stringify(loadedGroups.hidden)) {
        payload.hidden_usable_groups = hidden
      }
    }
    payload.id = userId
  }

  return payload
}

/**
 * Transform user data to form defaults. The admin permission matrix is passed
 * through as-is (the backend already returns a full matrix); it is filled against
 * the catalog at render time in UsersMutateDrawer.
 */
export function transformUserToFormDefaults(user: User): UserFormValues {
  return {
    username: user.username,
    display_name: user.display_name,
    password: '',
    role: user.role,
    quota_dollars: quotaUnitsToDollars(user.quota),
    group: user.group || DEFAULT_GROUP,
    remark: user.remark || '',
    max_concurrent_requests: user.max_concurrent_requests ?? 0,
    requests_per_minute: user.requests_per_minute ?? 0,
    extra_usable_groups: user.extra_usable_groups ?? [],
    hidden_usable_groups: user.hidden_usable_groups ?? [],
    admin_permissions: user.admin_permissions ?? {},
  }
}
