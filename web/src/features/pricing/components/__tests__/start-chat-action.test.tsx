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
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { pickChatGroup } from '../../lib/chat-group'
import type { PricingModel } from '../../types'
import { StartChatAction } from '../start-chat-action'
import { VendorModelList } from '../vendor-model-list'

let queryClient: QueryClient

function stubStorage(entries: Record<string, string> = {}) {
  const store = new Map(Object.entries(entries))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  })
}

async function renderAction(modelName: string, group?: string) {
  return renderWithChatRoute(
    <StartChatAction modelName={modelName} group={group} />
  )
}

async function renderWithChatRoute(content: ReactNode) {
  const rootRoute = createRootRoute({
    component: () => content,
  })
  const playgroundRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/playground',
    component: () => <p>chat page</p>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([playgroundRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  // The status snapshot is optional here: without it the chat counts as enabled.
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: {} } })
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('start chat action', () => {
  it('links to the chat with the model and the group that serves it', async () => {
    stubStorage({
      status: JSON.stringify({
        SidebarModulesAdmin: JSON.stringify({
          workbench: { enabled: true, chat: true },
        }),
      }),
    })
    await renderAction('gpt-x', 'vip')

    const link = await screen.findByRole('link', { name: 'Start chatting' })
    const href = link.getAttribute('href') ?? ''

    // Without the group the chat would fall back to the reader's default group,
    // which may not offer the model at all.
    expect(href.startsWith('/playground?')).toBe(true)
    expect(Object.fromEntries(new URLSearchParams(href.split('?')[1]))).toEqual(
      { model: 'gpt-x', group: 'vip' }
    )
  })

  it('links with just the model when no group is known', async () => {
    stubStorage({
      status: JSON.stringify({
        SidebarModulesAdmin: JSON.stringify({
          workbench: { enabled: true, chat: true },
        }),
      }),
    })
    await renderAction('gpt-x')

    const link = await screen.findByRole('link', { name: 'Start chatting' })

    expect(link).toHaveAttribute('href', '/playground?model=gpt-x')
  })

  it('stays out of the way when the chat is turned off for the site', async () => {
    stubStorage({
      status: JSON.stringify({
        SidebarModulesAdmin: JSON.stringify({
          workbench: { enabled: true, chat: false },
        }),
      }),
    })
    await renderAction('gpt-x')

    expect(
      screen.queryByRole('link', { name: 'Start chatting' })
    ).not.toBeInTheDocument()
  })
})

const chatEnabledStatus = {
  SidebarModulesAdmin: JSON.stringify({
    workbench: { enabled: true, chat: true },
  }),
}

/** The site keeps the chat on, both in the stored snapshot and when asked. */
function enableChat() {
  stubStorage({ status: JSON.stringify(chatEnabledStatus) })
  vi.mocked(api.get).mockResolvedValue({
    data: { success: true, data: chatEnabledStatus },
  })
}

describe('group a chat opens on', () => {
  it.each([
    {
      name: 'the group being browsed when it serves the model',
      modelGroups: ['default', 'vip'],
      usable: ['default', 'vip'],
      preferred: 'vip',
      expected: 'vip',
    },
    {
      name: 'the first usable group when the browsed one does not serve it',
      modelGroups: ['default', 'vip'],
      usable: ['vip', 'default'],
      preferred: 'partner',
      expected: 'default',
    },
    {
      name: 'the first usable group while every group is shown',
      modelGroups: ['internal', 'vip'],
      usable: ['default', 'vip'],
      preferred: 'all',
      expected: 'vip',
    },
    {
      name: 'no group when the reader can use none that serves it',
      modelGroups: ['internal'],
      usable: ['default'],
      preferred: undefined,
      expected: undefined,
    },
  ])('is $name', (scenario) => {
    expect(
      pickChatGroup(scenario.modelGroups, scenario.usable, scenario.preferred)
    ).toBe(scenario.expected)
  })
})

describe('start chat entry points', () => {
  const model: PricingModel = {
    id: 1,
    model_name: 'alpha',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 3,
    vendor_id: 1,
    enable_groups: ['default', 'vip'],
    group_ratio: { default: 1, vip: 2 },
  }

  it('a list row offers a chat with its model on the group being browsed', async () => {
    enableChat()
    await renderWithChatRoute(
      <VendorModelList
        models={[model]}
        vendors={[{ id: 1, name: 'First Vendor' }]}
        onModelClick={() => {}}
        selectedGroup='vip'
        chatGroups={['default', 'vip']}
      />
    )

    const row = (await screen.findByRole('button', { name: /alpha/ })).closest(
      'li'
    )
    expect(row).not.toBeNull()
    const link = await within(row as HTMLElement).findByRole('link', {
      name: 'Start chatting',
    })
    const href = link.getAttribute('href') ?? ''
    expect(Object.fromEntries(new URLSearchParams(href.split('?')[1]))).toEqual(
      { model: 'alpha', group: 'vip' }
    )
  })

  it('a list row has no chat entry where the list is shown without groups', async () => {
    enableChat()
    await renderWithChatRoute(
      <VendorModelList
        models={[model]}
        vendors={[{ id: 1, name: 'First Vendor' }]}
        onModelClick={() => {}}
      />
    )

    await screen.findByRole('button', { name: /alpha/ })
    // The copy button is there once the row has settled, the chat link never.
    await screen.findByRole('button', { name: 'Copy model name' })
    expect(
      screen.queryByRole('link', { name: 'Start chatting' })
    ).not.toBeInTheDocument()
  })

  it('takes the height of the dialog buttons it is placed next to', async () => {
    enableChat()
    await renderWithChatRoute(
      <StartChatAction modelName='alpha' size='default' />
    )

    const link = await screen.findByRole('link', { name: 'Start chatting' })
    expect(link).toHaveClass('h-9')
    expect(link).not.toHaveClass('h-7')
  })
})
