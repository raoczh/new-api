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
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore, type AuthUser } from '@/stores/auth-store'

import { STORAGE_KEYS } from '../../constants'
import { usePlaygroundState } from '../use-playground-state'

const user = { id: 7, username: 'tester', role: 1 } as AuthUser
let store: Map<string, string>

beforeEach(() => {
  store = new Map()
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
})

afterEach(() => {
  vi.unstubAllGlobals()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
})

describe('playground initial model', () => {
  it('starts the chat on the model a link asked for', () => {
    const { result } = renderHook(() => usePlaygroundState('gpt-x'))

    expect(result.current.config.model).toBe('gpt-x')
  })

  it('starts on the group a link asked for and keeps the stored group otherwise', () => {
    store.set(
      `${STORAGE_KEYS.CONFIG}:${user.id}`,
      JSON.stringify({ version: 1, data: { group: 'stored-group' } })
    )

    const linked = renderHook(() => usePlaygroundState('gpt-x', 'vip'))
    const plain = renderHook(() => usePlaygroundState('gpt-x'))

    expect(linked.result.current.config.group).toBe('vip')
    expect(plain.result.current.config.group).toBe('stored-group')
  })

  it('keeps the stored model when no model was asked for', () => {
    store.set(
      `${STORAGE_KEYS.CONFIG}:${user.id}`,
      JSON.stringify({ version: 1, data: { model: 'stored-model' } })
    )

    const { result } = renderHook(() => usePlaygroundState())

    expect(result.current.config.model).toBe('stored-model')
  })

  it('does not overwrite the stored model with the one asked for', () => {
    store.set(
      `${STORAGE_KEYS.CONFIG}:${user.id}`,
      JSON.stringify({ version: 1, data: { model: 'stored-model' } })
    )

    renderHook(() => usePlaygroundState('gpt-x'))

    expect(
      JSON.parse(store.get(`${STORAGE_KEYS.CONFIG}:${user.id}`) ?? '')
    ).toEqual({
      version: 1,
      data: { model: 'stored-model' },
    })
  })
})
