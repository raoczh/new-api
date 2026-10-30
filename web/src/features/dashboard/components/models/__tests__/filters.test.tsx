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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, expect, it, test, vi } from 'vitest'

import { getFlowQuotaDates, getUserQuotaDates } from '@/features/dashboard/api'
import { DEFAULT_DASHBOARD_CHART_PREFERENCES } from '@/features/dashboard/constants'
import {
  buildDefaultDashboardFilters,
  buildQueryParams,
  detectDashboardQuickRange,
  getDashboardQuickRange,
} from '@/features/dashboard/lib/filters'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { ModelsFilter } from '../models-filter-dialog'

const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterAll(() => {
  if (getAnimationsDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'getAnimations',
      getAnimationsDescriptor
    )
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
  }
})

afterEach(() => {
  vi.useRealTimers()
  useAuthStore.getState().auth.reset()
})

test('resolves and detects today, yesterday and rolling quick ranges', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 8, 12, 0, 0))

  const today = getDashboardQuickRange('today')
  expect(today.start).toEqual(new Date(2026, 8, 8, 0, 0, 0))
  expect(today.end).toEqual(new Date(2026, 8, 8, 12, 0, 0))
  expect(today.granularity).toBe('hour')
  expect(
    detectDashboardQuickRange({
      start_timestamp: today.start,
      end_timestamp: today.end,
    })
  ).toBe('today')

  const yesterday = getDashboardQuickRange('yesterday')
  expect(yesterday.start).toEqual(new Date(2026, 8, 7, 0, 0, 0))
  expect(yesterday.end).toEqual(new Date(2026, 8, 7, 23, 59, 59, 999))
  expect(yesterday.granularity).toBe('hour')
  expect(
    detectDashboardQuickRange({
      start_timestamp: yesterday.start,
      end_timestamp: yesterday.end,
    })
  ).toBe('yesterday')

  const week = getDashboardQuickRange('7d')
  expect(week.granularity).toBe('day')
  expect(
    detectDashboardQuickRange({
      start_timestamp: week.start,
      end_timestamp: week.end,
    })
  ).toBe('7d')

  expect(
    detectDashboardQuickRange({
      start_timestamp: new Date(2026, 8, 8, 3, 0, 0),
      end_timestamp: new Date(2026, 8, 8, 5, 0, 0),
    })
  ).toBeNull()
})

test('forwards the admin group, channel and token filters', () => {
  expect(
    buildQueryParams(
      { start_timestamp: 1000, end_timestamp: 2000 },
      {
        group: 'vip',
        channel_id: '7',
        token_id: '11',
      }
    )
  ).toMatchObject({
    group: 'vip',
    channel_id: '7',
    token_id: '11',
  })
})

it.each([1, 10, 100])(
  'lets role %i type a model and forwards it to standard and flow requests',
  async (role) => {
    useAuthStore.getState().auth.setUser({ id: 1, username: 'alice', role })
    const user = userEvent.setup()
    const onFilterChange = vi.fn()
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { success: true, data: [] } })
    render(
      <ModelsFilter
        preferences={DEFAULT_DASHBOARD_CHART_PREFERENCES}
        currentFilters={buildDefaultDashboardFilters(
          DEFAULT_DASHBOARD_CHART_PREFERENCES
        )}
        onFilterChange={onFilterChange}
        onReset={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Model' }),
      '  custom-model  '
    )
    if (role >= 10) {
      await user.type(
        screen.getByRole('textbox', { name: 'Username' }),
        'alice'
      )
    } else {
      expect(
        screen.queryByRole('textbox', { name: 'Username' })
      ).not.toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: 'Apply Filters' }))
    const filters = onFilterChange.mock.calls[0][0]
    expect(filters.model_name).toBe('custom-model')
    const params = buildQueryParams(
      { start_timestamp: 1000, end_timestamp: 2000 },
      filters
    )
    await getUserQuotaDates(params, role >= 10)
    await getFlowQuotaDates(params, role >= 10)
    expect(get).toHaveBeenCalledWith(
      role >= 10 ? '/api/data' : '/api/data/self',
      {
        params: expect.objectContaining({ model_name: 'custom-model' }),
      }
    )
    expect(get).toHaveBeenCalledWith(
      role >= 10 ? '/api/data/flow' : '/api/data/flow/self',
      {
        params: expect.objectContaining({ model_name: 'custom-model' }),
      }
    )
  }
)

it('clears an applied model filter and resets to the default filters', async () => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'alice', role: 1 })
  const user = userEvent.setup()
  const onFilterChange = vi.fn()
  const onReset = vi.fn()
  const defaults = buildDefaultDashboardFilters(
    DEFAULT_DASHBOARD_CHART_PREFERENCES
  )
  const props = {
    preferences: DEFAULT_DASHBOARD_CHART_PREFERENCES,
    currentFilters: { ...defaults, model_name: 'custom-model' },
    onFilterChange,
    onReset,
  }
  const view = render(<ModelsFilter {...props} />)
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  await user.clear(screen.getByRole('textbox', { name: 'Model' }))
  await user.click(screen.getByRole('button', { name: 'Apply Filters' }))
  expect(onFilterChange.mock.calls[0][0]).not.toHaveProperty('model_name')

  await user.click(screen.getByRole('button', { name: 'Filter' }))
  await user.click(screen.getByRole('button', { name: 'Reset' }))
  expect(onReset).toHaveBeenCalledOnce()
  view.rerender(<ModelsFilter {...props} currentFilters={defaults} />)
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  expect(screen.getByRole('textbox', { name: 'Model' })).toHaveValue('')
})
