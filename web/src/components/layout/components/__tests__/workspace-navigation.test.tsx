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
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { useAuthStore } from '@/stores/auth-store'

import { AppSidebar } from '../app-sidebar'

let client: QueryClient

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(['status'], {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  client.clear()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  localStorage.clear()
})

async function renderNavigation(path = '/keys', role = 1) {
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'navigation-fixture', role })
  const root = createRootRoute({ component: AppSidebar })
  const routes = [
    '/keys',
    '/wallet',
    '/channels',
    '/system-settings/site',
    '/dashboard/overview',
  ].map((path) => createRoute({ getParentRoute: () => root, path }))
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <SidebarProvider>
        <RouterProvider router={router} />
      </SidebarProvider>
    </QueryClientProvider>
  )
  return router
}

it('selects the current section and lets users navigate across sections with the keyboard', async () => {
  const user = userEvent.setup()
  await renderNavigation()
  expect(screen.getByRole('tab', { name: /General/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(screen.getByRole('link', { name: 'API Keys' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  expect(screen.queryByRole('tab', { name: /Admin/ })).not.toBeInTheDocument()
  screen.getByRole('tab', { name: /General/ }).focus()
  await user.keyboard('[ArrowRight][Enter]')
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Personal/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  )
  await user.click(screen.getByRole('link', { name: 'Wallet' }))
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'Wallet' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  )
})

it('scrolls the current section and page into view when entering a workspace route', async () => {
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
  await renderNavigation('/wallet')
  const tab = screen.getByRole('tab', { name: /Personal/ })
  const link = screen.getByRole('link', { name: 'Wallet' })

  await waitFor(() => {
    expect(scroll.mock.contexts).toContain(tab)
    expect(scroll.mock.contexts).toContain(link)
  })
})

it('preserves administrator and user menu visibility settings', async () => {
  client.setQueryData(['status'], {
    SidebarModulesAdmin: JSON.stringify({
      console: { enabled: true, token: false },
      personal: { enabled: false },
    }),
  })
  const user = userEvent.setup()
  await renderNavigation('/channels', 100)
  expect(screen.getByRole('tab', { name: /Admin/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(screen.getByRole('link', { name: 'Channels' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  expect(
    screen.queryByRole('tab', { name: /Personal/ })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: /General/ }))
  expect(
    within(screen.getByRole('tabpanel')).queryByRole('link', {
      name: 'API Keys',
    })
  ).not.toBeInTheDocument()
})

it('provides contextual settings navigation with a route back to the workspace', async () => {
  const user = userEvent.setup()
  await renderNavigation('/system-settings/site', 100)
  const back = screen.getByRole('link', { name: /Back to Dashboard/ })
  expect(back).toHaveAttribute('href', '/dashboard/overview')
  await user.click(back)
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /General/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  )
})
