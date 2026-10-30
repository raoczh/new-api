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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { OverviewDashboard } from '../overview-dashboard'

vi.mock('@visactor/react-vchart', () => ({
  VChart: () => null,
}))

let client: QueryClient

beforeEach(() => {
  window.localStorage.clear()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'dashboard-user',
    role: 1,
    quota: 1000000,
    used_quota: 1000,
    request_count: 1,
  })
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    switch (url) {
      case '/api/token/?p=1&size=10':
        return {
          data: {
            success: true,
            data: {
              items: [{ id: 1, name: 'App key', key: 'masked', status: 1 }],
            },
          },
        }
      case '/api/status':
        return {
          data: {
            data: {
              api_info_enabled: false,
              announcements_enabled: false,
              faq_enabled: false,
              uptime_kuma_enabled: false,
            },
          },
        }
      case '/api/user/models':
        return { data: { success: true, data: ['gpt-4o-mini'] } }
      case '/api/data/self':
        return { data: { success: true, data: [] } }
      default:
        throw new Error(`Unexpected dashboard request: ${url}`)
    }
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  window.localStorage.clear()
})

async function renderOverview() {
  const router = createRouter({
    routeTree: createRootRoute({ component: OverviewDashboard }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('overview dashboard', () => {
  it('shows usage first and hides onboarding, announcements, FAQ and contact when setup is complete', async () => {
    await renderOverview()

    expect(
      await screen.findByRole('region', { name: 'Usage at a glance' })
    ).toBeVisible()
    expect(screen.queryByText('Get started')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Setup guide' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Buy redemption codes')).not.toBeInTheDocument()
    expect(screen.queryByText('Announcements')).not.toBeInTheDocument()
    expect(screen.queryByText('FAQ')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Contact Information' })
    ).not.toBeInTheDocument()
  })

  it('shows the compact setup guide for incomplete accounts and toggles it', async () => {
    useAuthStore.getState().auth.setUser({
      id: 1,
      username: 'new-user',
      role: 1,
    })
    const user = userEvent.setup()
    await renderOverview()

    expect(
      await screen.findByRole('heading', {
        name: 'Build on your API gateway in minutes',
      })
    ).toBeVisible()
    expect(screen.getByText('Setup progress: 1/3')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Hide setup guide' }))
    expect(
      screen.queryByRole('heading', {
        name: 'Build on your API gateway in minutes',
      })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Setup progress: 1/3')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Show setup guide' }))
    expect(
      screen.getByRole('heading', {
        name: 'Build on your API gateway in minutes',
      })
    ).toBeVisible()
  })

  it('restores the setup guide preference after remounting', async () => {
    useAuthStore.getState().auth.setUser({
      id: 1,
      username: 'new-user',
      role: 1,
    })
    const user = userEvent.setup()
    const first = await renderOverview()
    await user.click(
      await screen.findByRole('button', { name: 'Hide setup guide' })
    )
    first.unmount()

    await renderOverview()
    expect(
      await screen.findByRole('button', { name: 'Show setup guide' })
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', {
        name: 'Build on your API gateway in minutes',
      })
    ).not.toBeInTheDocument()
  })
})
