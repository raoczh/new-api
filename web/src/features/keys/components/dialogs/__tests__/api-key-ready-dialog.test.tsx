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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, test } from 'vitest'

import { api } from '@/lib/api'

import { ApiKeysProvider, useApiKeys } from '../../api-keys-provider'
import { ApiKeyReadyDialog } from '../api-key-ready-dialog'

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = { get: ApiMethod; post: ApiMethod }

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPost = apiClient.post
let queryClient: QueryClient | null = null

const storedKey = {
  id: 42,
  name: 'Anthropic-claude-fast',
  key: 'abcd**********wxyz',
  status: 1,
  remain_quota: 0,
  used_quota: 0,
  unlimited_quota: true,
  expired_time: -1,
  created_time: 1,
  accessed_time: 0,
  group: 'claude-fast',
  model_limits_enabled: false,
  model_limits: '',
  allow_ips: '',
  allow_user_quota_query: true,
}

function ReadyDialogHarness() {
  const { open, setCreatedKeyId, currentRow, resolvedKey } = useApiKeys()
  useEffect(() => {
    setCreatedKeyId(storedKey.id)
  }, [setCreatedKeyId])
  return (
    <>
      <ApiKeyReadyDialog open onOpenChange={() => undefined} />
      <output data-testid='state'>
        {`${open ?? 'none'}|${currentRow?.name ?? ''}|${resolvedKey}`}
      </output>
    </>
  )
}

async function renderReadyDialog(options: {
  status?: Record<string, unknown>
  keyAvailable?: boolean
}) {
  apiClient.post = async (url) => {
    expect(url).toBe('/api/token/42/key')
    return options.keyAvailable === false
      ? { data: { success: false, message: 'Too many requests' } }
      : { data: { success: true, data: { key: 'full-secret-key' } } }
  }
  apiClient.get = async (url) => {
    expect(url).toBe('/api/token/42')
    return { data: { success: true, data: storedKey } }
  }
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(
    ['status'],
    { server_address: 'https://api.example.com', ...options.status },
    { updatedAt: Date.now() + 60_000 }
  )
  const root = createRootRoute()
  const page = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <ApiKeysProvider>
        <ReadyDialogHarness />
      </ApiKeysProvider>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([page]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const chatEnabled = {
  SidebarModulesAdmin: JSON.stringify({
    workbench: { enabled: true, chat: true },
  }),
}

afterEach(() => {
  apiClient.get = originalGet
  apiClient.post = originalPost
  queryClient?.clear()
  queryClient = null
})

describe('API key ready dialog', () => {
  test('shows the full key and the API address, each with its own copy action', async () => {
    await renderReadyDialog({ status: chatEnabled })

    expect(await screen.findByText('sk-full-secret-key')).toBeVisible()
    expect(screen.getByText('https://api.example.com')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Copy: API Key' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Copy: API address' })
    ).toBeEnabled()
  })

  test('offers in-browser chat only when the administrator enabled the chat module', async () => {
    await renderReadyDialog({ status: chatEnabled })
    expect(
      await screen.findByRole('link', { name: 'Start chatting' })
    ).toHaveAttribute('href', '/playground')
  })

  test('leaves chat out when the chat module is turned off, keeping the other next steps', async () => {
    await renderReadyDialog({})

    await screen.findByText('sk-full-secret-key')
    expect(screen.queryByRole('link', { name: 'Start chatting' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'View guide' })).toHaveAttribute(
      'href',
      '/docs/config/agents'
    )
  })

  test('hands the new key to the CC Switch import dialog', async () => {
    await renderReadyDialog({})

    await screen.findByText('sk-full-secret-key')
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent(
        'cc-switch|Anthropic-claude-fast|sk-full-secret-key'
      )
    )
  })

  test('points to the key list and blocks import when the key cannot be loaded', async () => {
    await renderReadyDialog({ keyAvailable: false })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the key. Copy it from the key list instead.'
    )
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Copy: API Key' })).toBeNull()
  })
})
