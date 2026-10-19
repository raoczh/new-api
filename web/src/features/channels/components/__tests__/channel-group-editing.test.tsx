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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import type { Channel } from '../../types'
import { ChannelsProvider } from '../channels-provider'
import { ChannelsTable } from '../channels-table'

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})
const clients: QueryClient[] = []

function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 3,
    type: 1,
    key: '',
    status: 1,
    name: 'prod',
    created_time: 0,
    test_time: 0,
    response_time: 0,
    other: '',
    balance: 0,
    balance_updated_time: 0,
    models: 'gpt-4o',
    group: 'vip',
    used_quota: 0,
    other_info: '',
    remark: '',
    max_input_tokens: 0,
    channel_info: {
      is_multi_key: false,
      multi_key_size: 0,
      multi_key_polling_index: 0,
      multi_key_mode: 'random',
    },
    settings: '{}',
    ...overrides,
  }
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

function getCommandOption(label: string): HTMLElement {
  const option = [
    ...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]'),
  ].find((item) => item.textContent?.includes(label))
  if (!option) throw new Error(`Missing group option "${label}"`)
  return option
}

async function renderChannelsPage(
  item: Channel = channel(),
  expectedText = 'prod'
) {
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/channel/search' || url === '/api/channel') {
      return {
        data: {
          success: true,
          data: { items: [item], total: 1, type_counts: {} },
        },
      }
    }
    return {
      data: {
        success: true,
        data: ['vip', 'default'],
        group_ratio: { vip: 2, default: 1 },
      },
    }
  })
  const put = vi.spyOn(api, 'put').mockResolvedValue({
    data: { success: true, data: item },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const channelsRoute = createRoute({
    getParentRoute: () => auth,
    path: 'channels/',
    component: () => (
      <ChannelsProvider>
        <ChannelsTable />
        <Toaster />
      </ChannelsProvider>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([channelsRoute])]),
    history: createMemoryHistory({ initialEntries: ['/channels/'] }),
  })
  await router.load()
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await waitFor(() => expect(document.body.textContent).toContain(expectedText))
  return { get, put }
}

it('saves groups picked inline and confirms the new list', async () => {
  const user = userEvent.setup()
  const { put } = await renderChannelsPage()

  const trigger = screen.getByRole('combobox', {
    name: 'Change group for prod',
  })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await user.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await user.click(getCommandOption('default'))

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      '/api/channel/',
      {
        id: 3,
        group: 'vip,default',
      },
      { skipBusinessError: true, skipErrorHandler: true }
    )
  )
  expect(
    await screen.findByText('Group changed to vip, default')
  ).toBeInTheDocument()
})

it('keeps at least one group selected without a request', async () => {
  const user = userEvent.setup()
  const { put } = await renderChannelsPage()

  await user.click(
    screen.getByRole('combobox', { name: 'Change group for prod' })
  )
  await user.click(getCommandOption('vip'))

  expect(await screen.findByText('Group is required')).toBeInTheDocument()
  expect(put).not.toHaveBeenCalled()
})

it('shows the server reason when the group change is refused', async () => {
  const user = userEvent.setup()
  const { put } = await renderChannelsPage()
  put.mockResolvedValue({
    data: { success: false, message: 'Group is not available' },
  })

  await user.click(
    screen.getByRole('combobox', { name: 'Change group for prod' })
  )
  await user.click(getCommandOption('default'))

  expect(await screen.findByText('Group is not available')).toBeInTheDocument()
  expect(
    screen.queryByText('Group changed to vip, default')
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('combobox', { name: 'Change group for prod' })
  ).toBeEnabled()
})

it('keeps tag aggregate rows read-only', async () => {
  localStorage.setItem('enable-tag-mode', 'true')
  await renderChannelsPage(channel({ tag: 'batch', children: [] }), 'batch')

  expect(
    screen.queryByRole('combobox', { name: 'Change group for batch' })
  ).not.toBeInTheDocument()
})
