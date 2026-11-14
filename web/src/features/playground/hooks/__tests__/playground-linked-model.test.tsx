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
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'

import { STORAGE_KEYS } from '../../constants'
import { usePlaygroundOptions } from '../use-playground-options'
import { usePlaygroundState } from '../use-playground-state'

const user = { id: 7, username: 'tester', role: 1 } as AuthUser
const configKey = `${STORAGE_KEYS.CONFIG}:${user.id}`
let store: Map<string, string>
let requestedGroups: string[]

/** Chat-capable models per group, as the server would list them. */
const modelsByGroup: Record<string, string[]> = {
  default: ['gpt-basic'],
  vip: ['gpt-x', 'gpt-basic'],
}

/** The page wires both hooks together; the test does the same. */
function useChatSelection(linkedModel?: string, linkedGroup?: string) {
  const state = usePlaygroundState(linkedModel, linkedGroup)
  usePlaygroundOptions({
    currentGroup: state.config.group,
    currentModel: state.config.model,
    linkedModel,
    setGroups: state.setGroups,
    setModels: state.setModels,
    updateConfig: state.updateConfig,
  })
  return state
}

function renderChatSelection(linkedModel?: string, linkedGroup?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return renderHook(() => useChatSelection(linkedModel, linkedGroup), {
    wrapper: (props: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    ),
  })
}

beforeEach(() => {
  store = new Map()
  requestedGroups = []
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
  useAuthStore.setState({ auth: { user } as never })
  store.set(
    configKey,
    JSON.stringify({
      version: 1,
      data: { model: 'gpt-basic', group: 'default' },
    })
  )
  vi.spyOn(api, 'get').mockImplementation(async (url, config) => {
    if (url === '/api/user/self/groups') {
      return {
        data: {
          success: true,
          data: {
            default: { desc: 'Default', ratio: 1 },
            vip: { desc: 'VIP', ratio: 2 },
          },
          group_order: ['default', 'vip'],
        },
      }
    }
    if (url === '/api/user/models') {
      const params = config?.params as { group?: string } | undefined
      const group = String(params?.group)
      requestedGroups.push(group)
      return { data: { success: true, data: modelsByGroup[group] ?? [] } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
})

describe('playground linked model', () => {
  it('opens on the group that serves the linked model when the stored group does not', async () => {
    const { result } = renderChatSelection('gpt-x')

    await waitFor(() =>
      expect(result.current.config).toMatchObject({
        group: 'vip',
        model: 'gpt-x',
      })
    )
    expect(result.current.models.map((model) => model.value)).toEqual([
      'gpt-x',
      'gpt-basic',
    ])
    // Following a link is not the user's own choice, so it is not stored.
    expect(JSON.parse(store.get(configKey) ?? '')).toEqual({
      version: 1,
      data: { model: 'gpt-basic', group: 'default' },
    })
  })

  it('stays on the group named by the link without searching other groups', async () => {
    const { result } = renderChatSelection('gpt-x', 'vip')

    await waitFor(() => expect(result.current.models).toHaveLength(2))

    expect(result.current.config).toMatchObject({
      group: 'vip',
      model: 'gpt-x',
    })
    expect(requestedGroups).not.toContain('default')
  })

  it('finds the serving group when the link names a group without the model', async () => {
    const { result } = renderChatSelection('gpt-x', 'default')

    await waitFor(() =>
      expect(result.current.config).toMatchObject({
        group: 'vip',
        model: 'gpt-x',
      })
    )
  })

  it('falls back to an available model and says so when no group can chat with the linked model', async () => {
    const info = vi.spyOn(toast, 'info').mockReturnValue('toast-id')
    const { result } = renderChatSelection('image-only-model')

    await waitFor(() =>
      expect(result.current.config).toMatchObject({
        group: 'default',
        model: 'gpt-basic',
      })
    )
    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith(
      'image-only-model cannot be used in chat here, so another model was selected.'
    )
  })

  it('keeps the stored selection when the page is opened without a link', async () => {
    const { result } = renderChatSelection()

    await waitFor(() => expect(result.current.models).toHaveLength(1))

    expect(result.current.config).toMatchObject({
      group: 'default',
      model: 'gpt-basic',
    })
    expect(requestedGroups).toEqual(['default'])
  })
})
