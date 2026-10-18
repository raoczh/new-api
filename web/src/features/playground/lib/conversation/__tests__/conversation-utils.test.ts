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
import { describe, expect, test } from 'vitest'

import type { Message, PlaygroundConversation } from '../../../types'
import {
  MAX_CONVERSATION_TITLE_LENGTH,
  deriveConversationTitle,
  getConversationGroupKey,
  groupConversations,
  sortConversations,
} from '../conversation-utils'

const NOW = new Date(2026, 9, 18, 12, 0, 0).getTime()
const DAY_MS = 24 * 60 * 60 * 1000

function createMessage(
  from: Message['from'],
  content: string,
  key = `${from}-${content}`
): Message {
  return {
    key,
    from,
    versions: [{ id: `${key}-version`, content }],
  }
}

function createConversation(
  id: string,
  updatedAt: number
): PlaygroundConversation {
  return {
    id,
    title: id,
    createdAt: updatedAt,
    updatedAt,
  }
}

describe('deriveConversationTitle', () => {
  test('uses the first user message and skips assistant replies', () => {
    const messages = [
      createMessage('assistant', 'Welcome!'),
      createMessage('user', 'Summarize this document'),
      createMessage('user', 'Another question'),
    ]

    expect(deriveConversationTitle(messages)).toBe('Summarize this document')
  })

  test('collapses whitespace from multi-line prompts', () => {
    const messages = [createMessage('user', '  Explain\n\n  this   code  ')]

    expect(deriveConversationTitle(messages)).toBe('Explain this code')
  })

  test('truncates long titles and appends an ellipsis', () => {
    const longText = 'a'.repeat(MAX_CONVERSATION_TITLE_LENGTH + 20)
    const messages = [createMessage('user', longText)]

    const title = deriveConversationTitle(messages)

    expect(title).toBe(`${'a'.repeat(MAX_CONVERSATION_TITLE_LENGTH)}…`)
  })

  test('returns an empty title when no user text exists', () => {
    expect(deriveConversationTitle([])).toBe('')
    expect(deriveConversationTitle([createMessage('assistant', 'Hi')])).toBe('')
    expect(deriveConversationTitle([createMessage('user', '   ')])).toBe('')
  })
})

describe('getConversationGroupKey', () => {
  test('classifies by local day boundaries', () => {
    expect(getConversationGroupKey(NOW, NOW)).toBe('today')
    expect(getConversationGroupKey(NOW - DAY_MS, NOW)).toBe('yesterday')
    expect(getConversationGroupKey(NOW - 3 * DAY_MS, NOW)).toBe('previous7Days')
    expect(getConversationGroupKey(NOW - 10 * DAY_MS, NOW)).toBe('older')
  })
})

describe('groupConversations', () => {
  test('orders groups from newest to oldest and drops empty ones', () => {
    const today = createConversation('today', NOW)
    const yesterday = createConversation('yesterday', NOW - DAY_MS)
    const week = createConversation('week', NOW - 3 * DAY_MS)

    const groups = groupConversations([week, yesterday, today], NOW)

    expect(groups.map((group) => group.key)).toEqual([
      'today',
      'yesterday',
      'previous7Days',
    ])
    expect(groups[0].items).toEqual([today])
  })

  test('sorts conversations inside a group newest first', () => {
    const older = createConversation('older-today', NOW - 2 * 60 * 60 * 1000)
    const newer = createConversation('newer-today', NOW - 60 * 60 * 1000)

    const [group] = groupConversations([older, newer], NOW)

    expect(group.items.map((conversation) => conversation.id)).toEqual([
      'newer-today',
      'older-today',
    ])
  })

  test('returns no groups for an empty list', () => {
    expect(groupConversations([], NOW)).toEqual([])
  })
})

describe('sortConversations', () => {
  test('sorts newest first without mutating the input', () => {
    const older = createConversation('older', NOW - DAY_MS)
    const newer = createConversation('newer', NOW)
    const input = [older, newer]

    expect(sortConversations(input).map((item) => item.id)).toEqual([
      'newer',
      'older',
    ])
    expect(input).toEqual([older, newer])
  })
})
