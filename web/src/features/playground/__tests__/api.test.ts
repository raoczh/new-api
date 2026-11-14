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
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getUserGroups, getUserModels } from '../api'
import { API_ENDPOINTS } from '../constants'

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get,
  },
}))

describe('getUserModels', () => {
  beforeEach(() => {
    get.mockReset()
  })

  test('asks the server for chat-capable models only', async () => {
    get.mockResolvedValue({ data: { success: true, data: ['gpt-5'] } })

    await getUserModels('default')

    expect(get).toHaveBeenCalledWith(API_ENDPOINTS.USER_MODELS, {
      params: { group: 'default', chat_only: true },
    })
  })

  test('maps the returned model names to selector options', async () => {
    get.mockResolvedValue({
      data: { success: true, data: ['gpt-5', 'claude-sonnet-5-5'] },
    })

    await expect(getUserModels('default')).resolves.toEqual([
      { label: 'gpt-5', value: 'gpt-5' },
      { label: 'claude-sonnet-5-5', value: 'claude-sonnet-5-5' },
    ])
  })

  test('returns an empty list when the payload has no model array', async () => {
    get.mockResolvedValue({ data: { success: true } })

    await expect(getUserModels('default')).resolves.toEqual([])
  })
})

describe('getUserGroups', () => {
  beforeEach(() => {
    get.mockReset()
  })

  test('lists groups in the configured display order, with unlisted groups last', async () => {
    get.mockResolvedValue({
      data: {
        success: true,
        // Object keys arrive alphabetically; the order comes from group_order.
        data: {
          alpha: { desc: 'Alpha', ratio: 1 },
          beta: { desc: 'Beta', ratio: 2 },
          gamma: { desc: 'Gamma', ratio: 0.5 },
        },
        group_order: ['gamma', 'removed-group', 'alpha'],
      },
    })

    await expect(getUserGroups()).resolves.toEqual([
      { label: 'gamma', value: 'gamma', ratio: 0.5, desc: 'Gamma' },
      { label: 'alpha', value: 'alpha', ratio: 1, desc: 'Alpha' },
      { label: 'beta', value: 'beta', ratio: 2, desc: 'Beta' },
    ])
  })

  test('keeps the returned order when the server sends no display order', async () => {
    get.mockResolvedValue({
      data: {
        success: true,
        data: {
          default: { desc: 'Default', ratio: 1 },
          vip: { desc: 'VIP', ratio: 2 },
        },
      },
    })

    const groups = await getUserGroups()

    expect(groups.map((group) => group.value)).toEqual(['default', 'vip'])
  })
})
