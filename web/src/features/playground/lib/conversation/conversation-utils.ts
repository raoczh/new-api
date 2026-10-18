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
import { nanoid } from 'nanoid'

import { MESSAGE_ROLES } from '../../constants'
import type {
  ConversationGroup,
  ConversationGroupKey,
  Message,
  PlaygroundConversation,
} from '../../types'
import { getMessageContent } from '../message/message-utils'

export const MAX_CONVERSATION_TITLE_LENGTH = 60

const DAY_MS = 24 * 60 * 60 * 1000

const GROUP_ORDER: ConversationGroupKey[] = [
  'today',
  'yesterday',
  'previous7Days',
  'older',
]

export function createConversation(
  title = '',
  now: number = Date.now()
): PlaygroundConversation {
  return {
    id: nanoid(),
    title,
    createdAt: now,
    updatedAt: now,
  }
}

function getFirstUserText(messages: Message[]): string {
  for (const message of messages) {
    if (message.from !== MESSAGE_ROLES.USER) continue

    const text = getMessageContent(message).trim()
    if (text) return text
  }

  return ''
}

/**
 * Derive a conversation title from its first user message.
 * Falls back to an empty string; the UI supplies a localized placeholder.
 */
export function deriveConversationTitle(
  messages: Message[]
): string {
  const firstText = getFirstUserText(messages)
  const collapsed = firstText.replace(/\s+/g, ' ').trim()

  if (collapsed.length <= MAX_CONVERSATION_TITLE_LENGTH) {
    return collapsed
  }

  return `${collapsed.slice(0, MAX_CONVERSATION_TITLE_LENGTH).trimEnd()}…`
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function getConversationGroupKey(
  updatedAt: number,
  now: number = Date.now()
): ConversationGroupKey {
  const todayStart = startOfDay(now)

  if (updatedAt >= todayStart) {
    return 'today'
  }

  if (updatedAt >= todayStart - DAY_MS) {
    return 'yesterday'
  }

  if (updatedAt >= todayStart - 6 * DAY_MS) {
    return 'previous7Days'
  }

  return 'older'
}

/**
 * Group conversations for the history list, newest first.
 * Empty groups are dropped so the panel only renders populated sections.
 */
export function groupConversations(
  conversations: PlaygroundConversation[],
  now: number = Date.now()
): ConversationGroup[] {
  const buckets = new Map<ConversationGroupKey, PlaygroundConversation[]>()

  for (const conversation of conversations) {
    const key = getConversationGroupKey(conversation.updatedAt, now)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(conversation)
    } else {
      buckets.set(key, [conversation])
    }
  }

  return GROUP_ORDER.flatMap((key) => {
    const items = buckets.get(key)
    if (!items?.length) return []

    return [
      {
        key,
        items: [...items].sort((a, b) => b.updatedAt - a.updatedAt),
      },
    ]
  })
}

/**
 * Sort conversations newest first, active one included.
 */
export function sortConversations(
  conversations: PlaygroundConversation[]
): PlaygroundConversation[] {
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
}
