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
// Mirrors the server-side checks in model/user_group_rename.go so the rename
// dialog can explain a rejected name before submitting it.
export const MAX_GROUP_NAME_LENGTH = 50

export type GroupNameError = {
  key: string
  params?: Record<string, string | number>
}

export function getGroupNameError(
  name: string,
  existingNames: string[]
): GroupNameError | null {
  if (!name) return { key: 'Enter a group name' }
  if (
    name === 'auto' ||
    name.includes(',') ||
    name.startsWith('+:') ||
    name.startsWith('-:') ||
    [...name].length > MAX_GROUP_NAME_LENGTH
  ) {
    return {
      key: 'Invalid group name {{name}}. Use at most {{max}} characters without commas, and do not use auto or start with +: or -:',
      params: { name, max: MAX_GROUP_NAME_LENGTH },
    }
  }
  if (existingNames.includes(name)) {
    return { key: 'Group name {{name}} is already in use', params: { name } }
  }
  return null
}
