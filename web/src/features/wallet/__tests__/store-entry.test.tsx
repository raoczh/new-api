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
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { Wallet } from '..'

beforeEach(() => {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'wallet-user',
    role: 1,
    permissions: { sidebar_settings: true },
  })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    switch (url) {
      case '/api/user/self':
        return {
          data: {
            success: true,
            data: { id: 1, username: 'wallet-user', quota: 0 },
          },
        }
      case '/api/user/topup/info':
        return {
          data: {
            success: true,
            data: {
              enable_redemption: false,
              enable_online_topup: false,
              enable_stripe_topup: false,
              pay_methods: [],
              amount_options: [],
              discount: {},
            },
          },
        }
      case '/api/user/aff':
        return { data: { success: true, data: 'aff-code' } }
      case '/api/subscription/plans':
        return { data: { success: true, data: [] } }
      case '/api/subscription/self':
        return { data: { success: true, data: {} } }
      default:
        throw new Error(`Unexpected wallet request: ${url}`)
    }
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset()
})

async function renderWallet(adminModules?: object) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {
    SidebarModulesAdmin: adminModules ? JSON.stringify(adminModules) : '',
  })
  const root = createRootRoute({ component: () => <Wallet /> })
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: '/' }),
      createRoute({ getParentRoute: () => root, path: '/wallet' }),
      createRoute({ getParentRoute: () => root, path: '/wallet/store' }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('wallet redemption store entry', () => {
  it('shows the store purchase entry when the admin keeps the store module enabled', async () => {
    await renderWallet()

    expect(
      await screen.findByRole('button', { name: 'Buy Redemption Codes' })
    ).toHaveAttribute('href', '/wallet/store')
  })

  it('hides the store purchase entry when the admin disables the store module', async () => {
    await renderWallet({ personal: { enabled: true, store: false } })

    await screen.findByRole('heading', { name: 'Wallet' })
    expect(
      screen.queryByRole('button', { name: 'Buy Redemption Codes' })
    ).not.toBeInTheDocument()
  })

  it('hides the store purchase entry when the whole personal section is disabled', async () => {
    await renderWallet({ personal: { enabled: false, store: true } })

    await screen.findByRole('heading', { name: 'Wallet' })
    expect(
      screen.queryByRole('button', { name: 'Buy Redemption Codes' })
    ).not.toBeInTheDocument()
  })
})
