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
import { expect, it } from 'vitest'

import type { User } from '../../types'
import {
  transformFormDataToPayload,
  transformUserToFormDefaults,
  userFormSchema,
} from '../user-form'

const baseForm = {
  username: 'scoped-user',
  display_name: 'Scoped user',
  group: 'default',
}

const baseUser: User = {
  id: 7,
  username: 'scoped-user',
  display_name: 'Scoped user',
  quota: 0,
  used_quota: 0,
  request_count: 0,
  group: 'default',
  status: 1,
  role: 1,
}

it('sends usable group lists that differ from the loaded ones', () => {
  const payload = transformFormDataToPayload(
    {
      ...baseForm,
      extra_usable_groups: ['vip'],
      hidden_usable_groups: ['legacy'],
    },
    7,
    undefined,
    { extra: [], hidden: [] }
  )

  expect(payload.extra_usable_groups).toEqual(['vip'])
  expect(payload.hidden_usable_groups).toEqual(['legacy'])
})

it('omits usable group lists that are unchanged', () => {
  const payload = transformFormDataToPayload(
    {
      ...baseForm,
      extra_usable_groups: ['vip'],
      hidden_usable_groups: ['legacy'],
    },
    7,
    undefined,
    { extra: ['vip'], hidden: ['legacy'] }
  )

  expect(payload).not.toHaveProperty('extra_usable_groups')
  expect(payload).not.toHaveProperty('hidden_usable_groups')
})

it('sends an empty list to clear one list and leaves the other alone', () => {
  const payload = transformFormDataToPayload(
    {
      ...baseForm,
      extra_usable_groups: [],
      hidden_usable_groups: ['legacy'],
    },
    7,
    undefined,
    { extra: ['vip'], hidden: ['legacy'] }
  )

  expect(payload.extra_usable_groups).toEqual([])
  expect(payload).not.toHaveProperty('hidden_usable_groups')
})

it('sends no usable group lists when the loaded values are unknown', () => {
  const payload = transformFormDataToPayload(
    {
      ...baseForm,
      extra_usable_groups: [],
      hidden_usable_groups: [],
    },
    7
  )

  expect(payload).not.toHaveProperty('extra_usable_groups')
  expect(payload).not.toHaveProperty('hidden_usable_groups')
})

it('does not send usable group lists when creating a user', () => {
  const payload = transformFormDataToPayload(
    {
      ...baseForm,
      password: 'password-123',
      extra_usable_groups: ['vip'],
      hidden_usable_groups: ['legacy'],
    },
    undefined,
    undefined,
    { extra: [], hidden: [] }
  )

  expect(payload).not.toHaveProperty('extra_usable_groups')
  expect(payload).not.toHaveProperty('hidden_usable_groups')
})

it('fills the form with the stored usable group lists', () => {
  const defaults = transformUserToFormDefaults({
    ...baseUser,
    extra_usable_groups: ['vip'],
    hidden_usable_groups: ['legacy'],
  })

  expect(defaults.extra_usable_groups).toEqual(['vip'])
  expect(defaults.hidden_usable_groups).toEqual(['legacy'])
})

it('defaults usable group lists to empty when the user has none', () => {
  const defaults = transformUserToFormDefaults(baseUser)

  expect(defaults.extra_usable_groups).toEqual([])
  expect(defaults.hidden_usable_groups).toEqual([])
})

it('rejects more usable groups than the server accepts', () => {
  const tooMany = Array.from({ length: 101 }, (_, i) => `group-${i}`)

  expect(
    userFormSchema.safeParse({ ...baseForm, extra_usable_groups: tooMany })
      .success
  ).toBe(false)
  expect(
    userFormSchema.safeParse({ ...baseForm, hidden_usable_groups: tooMany })
      .success
  ).toBe(false)
  expect(
    userFormSchema.safeParse({ ...baseForm, extra_usable_groups: ['vip'] })
      .success
  ).toBe(true)
})
