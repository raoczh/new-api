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

it('maps per-user request limits into the update payload', () => {
  const payload = transformFormDataToPayload(
    {
      username: 'limited-user',
      display_name: 'Limited user',
      group: 'default',
      max_concurrent_requests: 3,
      requests_per_minute: 60,
    },
    42
  )

  expect(payload).toMatchObject({
    id: 42,
    max_concurrent_requests: 3,
    requests_per_minute: 60,
  })
})

it('sends zero for both limits when the form omits them', () => {
  const payload = transformFormDataToPayload(
    { username: 'unlimited-user', display_name: 'Unlimited user' },
    43
  )

  expect(payload.max_concurrent_requests).toBe(0)
  expect(payload.requests_per_minute).toBe(0)
})

it('does not send request limits when creating a user', () => {
  const payload = transformFormDataToPayload({
    username: 'new-user',
    display_name: 'New user',
    role: 1,
    max_concurrent_requests: 3,
    requests_per_minute: 60,
  })

  expect(payload).not.toHaveProperty('max_concurrent_requests')
  expect(payload).not.toHaveProperty('requests_per_minute')
})

it('restores stored limits and falls back to unlimited when absent', () => {
  const user = {
    id: 7,
    username: 'stored-user',
    display_name: 'Stored user',
    quota: 0,
    used_quota: 0,
    request_count: 0,
    group: 'default',
    status: 1,
    role: 1,
    max_concurrent_requests: 5,
    requests_per_minute: 120,
  } satisfies User

  expect(transformUserToFormDefaults(user)).toMatchObject({
    max_concurrent_requests: 5,
    requests_per_minute: 120,
  })
  expect(
    transformUserToFormDefaults({ ...user, max_concurrent_requests: undefined })
      .max_concurrent_requests
  ).toBe(0)
})

it.each([
  ['negative concurrency', { max_concurrent_requests: -1 }],
  ['fractional concurrency', { max_concurrent_requests: 1.5 }],
  ['rpm above the server bound', { requests_per_minute: 1_000_001 }],
])('rejects %s before submit', (_name, limits) => {
  const result = userFormSchema.safeParse({
    username: 'invalid-limits',
    ...limits,
  })

  expect(result.success).toBe(false)
})
