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

import { useAuthStore } from '@/stores/auth-store'
import { useNotificationStore } from '@/stores/notification-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { PublicHeader } from '../public-header'

let desktop = false
let mediaEvents: EventTarget
let queryClient: QueryClient

async function renderHeader() {
  const rootRoute = createRootRoute({ component: PublicHeader })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  desktop = false
  mediaEvents = new EventTarget()
  const matchMedia = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    if (query !== '(min-width: 1024px)') return matchMedia(query)
    return {
      ...matchMedia(query),
      matches: desktop,
      addEventListener: mediaEvents.addEventListener.bind(mediaEvents),
      removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents),
    }
  })
  localStorage.clear()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  useNotificationStore.setState(useNotificationStore.getInitialState(), true)
  useSystemConfigStore.setState(
    {
      ...useSystemConfigStore.getInitialState(),
      loading: false,
    },
    true
  )
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(['status'], {
    system_name: 'New API',
    announcements_enabled: false,
  })
  queryClient.setQueryData(['notice'], { success: true, data: '' })
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  vi.restoreAllMocks()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  useNotificationStore.setState(useNotificationStore.getInitialState(), true)
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  localStorage.clear()
})

it('opens one mobile notification popup and returns focus to its trigger on Escape', async () => {
  const user = userEvent.setup()
  await renderHeader()
  await user.click(
    screen.getByRole('button', { name: 'Toggle navigation menu' })
  )
  const navigation = await screen.findByRole('dialog', { name: 'Navigation' })
  const notifications = within(navigation).getByRole('button', {
    name: 'Notifications',
  })
  await user.click(notifications)

  expect(screen.getAllByText('System Announcements')).toHaveLength(1)
  await user.keyboard('[Escape]')
  await waitFor(() =>
    expect(screen.queryByText('System Announcements')).not.toBeInTheDocument()
  )
  expect(navigation).toBeVisible()
  await waitFor(() => expect(notifications).toHaveFocus())
})

it('dismisses mobile overlays when switching to desktop and keeps them closed on return', async () => {
  const user = userEvent.setup()
  await renderHeader()
  const trigger = screen.getByRole('button', { name: 'Toggle navigation menu' })
  await user.click(trigger)
  const navigation = await screen.findByRole('dialog', { name: 'Navigation' })
  await user.click(
    within(navigation).getByRole('button', { name: 'Notifications' })
  )

  act(() => {
    desktop = true
    mediaEvents.dispatchEvent(new Event('change'))
  })
  await waitFor(() => {
    expect(
      screen.queryByRole('dialog', { name: 'Navigation' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('System Announcements')).not.toBeInTheDocument()
  })

  act(() => {
    desktop = false
    mediaEvents.dispatchEvent(new Event('change'))
  })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await user.click(trigger)
  expect(
    await screen.findByRole('dialog', { name: 'Navigation' })
  ).toBeVisible()
  expect(screen.queryByText('System Announcements')).not.toBeInTheDocument()
})

it('opens and closes desktop announcements without opening mobile navigation', async () => {
  desktop = true
  const user = userEvent.setup()
  await renderHeader()
  const trigger = screen.getByRole('button', { name: 'Notifications' })
  await user.click(trigger)
  expect(screen.getAllByText('System Announcements')).toHaveLength(1)
  expect(
    screen.queryByRole('dialog', { name: 'Navigation' })
  ).not.toBeInTheDocument()
  await user.keyboard('[Escape]')
  await waitFor(() =>
    expect(screen.queryByText('System Announcements')).not.toBeInTheDocument()
  )
  await waitFor(() => expect(trigger).toHaveFocus())
})

it('keeps notifications closed when switching from desktop to mobile until reopened', async () => {
  desktop = true
  const user = userEvent.setup()
  await renderHeader()
  await user.click(screen.getByRole('button', { name: 'Notifications' }))

  act(() => {
    desktop = false
    mediaEvents.dispatchEvent(new Event('change'))
  })
  await waitFor(() =>
    expect(screen.queryByText('System Announcements')).not.toBeInTheDocument()
  )

  await user.click(
    screen.getByRole('button', { name: 'Toggle navigation menu' })
  )
  const navigation = await screen.findByRole('dialog', { name: 'Navigation' })
  const notifications = within(navigation).getByRole('button', {
    name: 'Notifications',
  })
  expect(notifications).toHaveAttribute('aria-expanded', 'false')
  await user.click(notifications)
  expect(screen.getAllByText('System Announcements')).toHaveLength(1)
})
