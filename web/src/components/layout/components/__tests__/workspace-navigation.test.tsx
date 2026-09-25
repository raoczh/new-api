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
  act,
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
import { useNotificationStore } from '@/stores/notification-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { AppHeader } from '../app-header'
import { AppSidebar } from '../app-sidebar'

let client: QueryClient
let mediaEvents: EventTarget

beforeEach(() => {
  vi.stubGlobal('innerWidth', 1280)
  mediaEvents = new EventTarget()
  const matchMedia = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    if (query !== '(max-width: 767px)') return matchMedia(query)
    return {
      ...matchMedia(query),
      matches: window.innerWidth < 768,
      addEventListener: mediaEvents.addEventListener.bind(mediaEvents),
      removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents),
    }
  })
  localStorage.clear()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  useNotificationStore.setState(useNotificationStore.getInitialState(), true)
  useSystemConfigStore.setState(
    { ...useSystemConfigStore.getInitialState(), loading: false },
    true
  )
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(['status'], {})
  client.setQueryData(['notice'], { success: true, data: '' })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  client.clear()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  useNotificationStore.setState(useNotificationStore.getInitialState(), true)
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  localStorage.clear()
})

async function renderNavigation(path = '/keys', role = 1) {
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'navigation-fixture', role })
  const root = createRootRoute({
    component: () => (
      <>
        <AppHeader
          showSearch={false}
          showConfigDrawer={false}
          showProfileDropdown={false}
        />
        <AppSidebar />
      </>
    ),
  })
  const routes = [
    '/keys',
    '/wallet',
    '/channels',
    '/system-settings/site',
    '/system-settings/site/system-info',
    '/dashboard/overview',
    '/chat/$chatId',
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

it('shows all permitted page links immediately and supports direct keyboard navigation', async () => {
  const user = userEvent.setup()
  await renderNavigation()
  const navigation = within(
    screen.getByRole('navigation', { name: 'Navigation' })
  )
  expect(navigation.getByRole('link', { name: 'Playground' })).toBeVisible()
  expect(navigation.getByRole('link', { name: 'Overview' })).toBeVisible()
  expect(navigation.getByRole('link', { name: 'Wallet' })).toBeVisible()
  expect(
    navigation.queryByRole('link', { name: 'Channels' })
  ).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'API Keys' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  navigation.getByRole('link', { name: 'Wallet' }).focus()
  await user.keyboard('[Enter]')
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'Wallet' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  )
  expect(navigation.getByRole('link', { name: 'API Keys' })).toBeVisible()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('keeps the full menu visible when choosing the current page', async () => {
  const user = userEvent.setup()
  await renderNavigation('/wallet')
  await user.click(screen.getByRole('link', { name: 'Wallet' }))
  expect(screen.getByRole('link', { name: 'Wallet' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  expect(screen.getByRole('link', { name: 'API Keys' })).toBeVisible()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('lists configured chat pages without opening another menu', async () => {
  client.setQueryData(['status'], {
    chats: [{ 'Team chat': 'https://chat.example.invalid' }],
  })
  const user = userEvent.setup()
  const router = await renderNavigation()
  const chat = screen.getByRole('link', { name: 'Team chat' })
  expect(chat).toBeVisible()
  await user.click(chat)
  await waitFor(() => expect(router.state.location.pathname).toBe('/chat/0'))
  expect(chat).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'API Keys' })).toBeVisible()
})

it('preserves administrator and user menu visibility settings', async () => {
  client.setQueryData(['status'], {
    SidebarModulesAdmin: JSON.stringify({
      console: { enabled: true, token: false },
      personal: { enabled: false },
    }),
  })
  await renderNavigation('/channels', 100)
  expect(screen.getByRole('link', { name: 'Channels' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  expect(screen.queryByRole('link', { name: 'Wallet' })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', {
      name: 'API Keys',
    })
  ).not.toBeInTheDocument()
})

it('expands settings categories so their pages can be opened directly', async () => {
  const user = userEvent.setup()
  await renderNavigation('/system-settings/site', 100)
  expect(
    screen.getByRole('button', { name: 'Site & Branding' })
  ).toHaveAttribute('aria-expanded', 'true')
  expect(
    screen.getByRole('button', { name: 'Authentication' })
  ).toHaveAttribute('aria-expanded', 'true')
  expect(
    screen.getByRole('link', { name: 'System Information' })
  ).toHaveAttribute('href', '/system-settings/site/system-info')
  await user.click(screen.getByRole('link', { name: 'System Information' }))
  await waitFor(() =>
    expect(
      screen.getByRole('link', { name: 'System Information' })
    ).toHaveAttribute('aria-current', 'page')
  )
  const back = screen.getByRole('link', { name: /Back to Dashboard/ })
  expect(back).toHaveAttribute('href', '/dashboard/overview')
  await user.click(back)
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'API Keys' })).toBeVisible()
  )
})

it('opens mobile navigation as a drawer and closes it after selecting a page', async () => {
  vi.stubGlobal('innerWidth', 390)
  const user = userEvent.setup()
  const router = await renderNavigation()
  await user.click(
    screen.getByRole('button', { name: 'Toggle navigation menu' })
  )
  const drawer = await screen.findByRole('dialog', { name: 'Navigation' })
  expect(
    within(drawer).getByRole('link', { name: 'API Keys' })
  ).toHaveAttribute('aria-current', 'page')
  await user.click(within(drawer).getByRole('link', { name: 'Wallet' }))
  await waitFor(() => expect(drawer).not.toBeInTheDocument())
  expect(router.state.location.pathname).toBe('/wallet')
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Toggle navigation menu' })
    ).toHaveFocus()
  )
})

it('dismisses mobile tools and notifications on desktop and keeps them closed on return', async () => {
  vi.stubGlobal('innerWidth', 390)
  const user = userEvent.setup()
  await renderNavigation()
  await user.click(screen.getByRole('button', { name: 'Actions' }))
  await user.click(screen.getByRole('button', { name: 'Notifications' }))
  expect(
    screen.getByRole('dialog', { name: 'System Announcements' })
  ).toBeVisible()

  act(() => {
    vi.stubGlobal('innerWidth', 1280)
    mediaEvents.dispatchEvent(new Event('change'))
  })
  await waitFor(() => {
    expect(
      screen.queryByRole('dialog', { name: 'Actions' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('dialog', { name: 'System Announcements' })
    ).not.toBeInTheDocument()
  })

  act(() => {
    vi.stubGlobal('innerWidth', 390)
    mediaEvents.dispatchEvent(new Event('change'))
  })
  expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
    'aria-expanded',
    'false'
  )
  await user.click(screen.getByRole('button', { name: 'Actions' }))
  expect(
    screen.queryByRole('dialog', { name: 'System Announcements' })
  ).not.toBeInTheDocument()
})

it('keeps the mobile drawer closed after switching to desktop and back', async () => {
  vi.stubGlobal('innerWidth', 390)
  const user = userEvent.setup()
  await renderNavigation()
  await user.click(
    screen.getByRole('button', { name: 'Toggle navigation menu' })
  )
  expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeVisible()

  act(() => {
    vi.stubGlobal('innerWidth', 1280)
    mediaEvents.dispatchEvent(new Event('change'))
  })
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Navigation' })
    ).not.toBeInTheDocument()
  )
  act(() => {
    vi.stubGlobal('innerWidth', 390)
    mediaEvents.dispatchEvent(new Event('change'))
  })
  expect(
    screen.getByRole('button', { name: 'Toggle navigation menu' })
  ).toHaveAttribute('aria-expanded', 'false')
})
