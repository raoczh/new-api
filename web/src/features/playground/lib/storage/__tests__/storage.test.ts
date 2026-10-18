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
import { afterEach, beforeEach, expect, test } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import { STORAGE_KEYS } from '../../../constants'
import type { Message, PlaygroundConversationIndex } from '../../../types'
import {
  clearLegacyMessages,
  clearPlaygroundData,
  deleteConversationMessages,
  loadConfig,
  loadConversationIndex,
  loadLegacyMessages,
  loadMessages,
  loadParameterEnabled,
  saveConfig,
  saveConversationIndex,
  saveMessages,
  saveParameterEnabled,
} from '../storage'

const messages: Message[] = [
  {
    key: 'a-chat',
    from: 'user',
    versions: [{ id: 'a-version', content: 'Account A private chat' }],
  },
]

const conversationIndex: PlaygroundConversationIndex = {
  activeId: 'conversation-a',
  items: [
    {
      id: 'conversation-a',
      title: 'Account A private chat',
      createdAt: 1000,
      updatedAt: 2000,
    },
    {
      id: 'conversation-b',
      title: 'Second chat',
      createdAt: 3000,
      updatedAt: 4000,
    },
  ],
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.getState().auth.reset()
})

afterEach(() => {
  localStorage.clear()
  useAuthStore.getState().auth.reset()
})

test('switching accounts isolates config, conversations and parameter toggles and preserves returning account data', () => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'A', role: 1 })
  saveConfig({ model: 'account-a-model' })
  saveMessages('conversation-a', messages)
  saveConversationIndex(conversationIndex)
  saveParameterEnabled({ temperature: true })

  useAuthStore.getState().auth.reset()
  useAuthStore.getState().auth.setUser({ id: 2, username: 'B', role: 1 })
  expect(loadConfig()).toEqual({})
  expect(loadMessages('conversation-a')).toBeNull()
  expect(loadConversationIndex()).toBeNull()
  expect(loadParameterEnabled()).toEqual({})
  saveConfig({ model: 'account-b-model' })
  saveMessages('conversation-b', [])
  saveParameterEnabled({ temperature: false })

  useAuthStore.getState().auth.setUser({ id: 1, username: 'A', role: 1 })
  expect(loadConfig()).toEqual({ model: 'account-a-model' })
  expect(loadMessages('conversation-a')).toEqual(messages)
  expect(loadConversationIndex()).toEqual({
    activeId: 'conversation-a',
    items: [conversationIndex.items[1], conversationIndex.items[0]],
  })
  expect(loadParameterEnabled()).toEqual({ temperature: true })

  clearPlaygroundData()
  expect(loadMessages('conversation-a')).toBeNull()
  expect(loadConversationIndex()).toBeNull()
  useAuthStore.getState().auth.setUser({ id: 2, username: 'B', role: 1 })
  expect(loadConfig()).toEqual({ model: 'account-b-model' })
  expect(loadMessages('conversation-b')).toEqual([])
  expect(loadParameterEnabled()).toEqual({ temperature: false })
})

test('conversation messages are stored per conversation and deleted individually', () => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'A', role: 1 })
  const otherMessages: Message[] = [
    {
      key: 'b-chat',
      from: 'assistant',
      versions: [{ id: 'b-version', content: 'Second conversation reply' }],
    },
  ]
  saveMessages('conversation-a', messages)
  saveMessages('conversation-b', otherMessages)

  expect(loadMessages('conversation-a')).toEqual(messages)
  expect(loadMessages('conversation-b')).toEqual(otherMessages)

  deleteConversationMessages('conversation-a')
  expect(loadMessages('conversation-a')).toBeNull()
  expect(loadMessages('conversation-b')).toEqual(otherMessages)
})

test('attachments are dropped before messages are persisted', () => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'A', role: 1 })
  const messageWithAttachment: Message[] = [
    {
      key: 'image-chat',
      from: 'user',
      versions: [
        {
          id: 'image-version',
          content: 'Look at this',
          attachments: ['data:image/png;base64,AAAA'],
        },
      ],
    },
  ]

  saveMessages('conversation-a', messageWithAttachment)

  const loaded = loadMessages('conversation-a')
  expect(loaded?.[0].versions[0].content).toBe('Look at this')
  expect(loaded?.[0].versions[0].attachments).toBeUndefined()
})

test('legacy single-conversation messages can be loaded and cleared during migration', () => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'A', role: 1 })
  localStorage.setItem(
    `${STORAGE_KEYS.MESSAGES}:1`,
    JSON.stringify(messages)
  )

  expect(loadLegacyMessages()).toEqual(messages)

  clearLegacyMessages()
  expect(loadLegacyMessages()).toBeNull()
  expect(localStorage.getItem(`${STORAGE_KEYS.MESSAGES}:1`)).toBeNull()
})

test('legacy global data is removed instead of assigned to the first signed-in account', () => {
  localStorage.setItem(
    STORAGE_KEYS.CONFIG,
    JSON.stringify({ model: 'legacy-model' })
  )
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
  localStorage.setItem(
    STORAGE_KEYS.CONVERSATIONS,
    JSON.stringify(conversationIndex)
  )
  localStorage.setItem(
    STORAGE_KEYS.PARAMETER_ENABLED,
    JSON.stringify({ temperature: true })
  )
  useAuthStore.getState().auth.setUser({ id: 2, username: 'B', role: 1 })

  expect(loadConfig()).toEqual({})
  expect(loadMessages('conversation-a')).toBeNull()
  expect(loadConversationIndex()).toBeNull()
  expect(loadParameterEnabled()).toEqual({})
  for (const key of Object.values(STORAGE_KEYS)) {
    expect(localStorage.getItem(key)).toBeNull()
  }
})

test('storage calls without a signed-in user do not persist shared data', () => {
  saveConfig({ model: 'signed-out-model' })
  saveMessages('conversation-a', messages)
  saveConversationIndex(conversationIndex)
  saveParameterEnabled({ temperature: true })
  expect(loadConfig()).toEqual({})
  expect(loadMessages('conversation-a')).toBeNull()
  expect(loadConversationIndex()).toBeNull()
  expect(loadParameterEnabled()).toEqual({})
  expect(localStorage.length).toBe(0)
})
