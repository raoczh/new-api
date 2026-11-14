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
import type { PlaygroundConfig } from './types'

// Message constants
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const

export const MESSAGE_STATUS = {
  LOADING: 'loading',
  STREAMING: 'streaming',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const

// API endpoints
export const API_ENDPOINTS = {
  CHAT_COMPLETIONS: '/pg/chat/completions',
  USER_MODELS: '/api/user/models',
  USER_GROUPS: '/api/user/self/groups',
} as const

// Default group — uses 'default' as the safe fallback; auto-group is
// only selected when the backend confirms it is available for the user.
export const DEFAULT_GROUP = 'default' as const

// Default configuration
export const DEFAULT_CONFIG: PlaygroundConfig = {
  model: 'gpt-4o',
  group: DEFAULT_GROUP,
  stream: true,
}

// Storage keys
export const STORAGE_KEYS = {
  CONFIG: 'playground_config',
  MESSAGES: 'playground_messages',
  // Written by the removed parameter panel and no longer read. It stays listed
  // so the storage cleanup still deletes what earlier versions left behind.
  PARAMETER_ENABLED: 'playground_parameter_enabled',
  CONVERSATIONS: 'playground_conversations',
} as const

/**
 * Per-conversation messages live under `${prefix}:${conversationId}` so the
 * user suffix added by the storage layer keeps accounts isolated.
 */
export const CONVERSATION_MESSAGES_PREFIX = `${STORAGE_KEYS.MESSAGES}:`

/**
 * Example things to ask, offered while the conversation is still empty. A
 * reader who has never used an AI chat often does not know what to type; each
 * entry names an everyday task and puts a ready instruction in the composer so
 * it can be adjusted before sending. Both fields are i18n keys.
 */
export const PROMPT_STARTERS = [
  {
    id: 'summarize',
    label: 'Summarize a text',
    prompt: 'Summarize the following text in three sentences:',
  },
  {
    id: 'write-email',
    label: 'Write an email',
    prompt: 'Write a short, friendly email asking for a day off next Friday:',
  },
  {
    id: 'translate',
    label: 'Translate',
    prompt: 'Translate the following text into English, keeping its tone:',
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm ideas',
    prompt: 'Give me five short ideas for a birthday gift under 200 yuan:',
  },
] as const

// Error messages
export const ERROR_MESSAGES = {
  API_REQUEST_ERROR: 'Request error occurred',
  NETWORK_ERROR: 'Network connection failed or server not responding',
  PARSE_ERROR: 'Error parsing response data',
  STREAM_START_ERROR: 'Error establishing connection',
  CONNECTION_CLOSED: 'Connection closed',
  INTERRUPTED: 'Generation was interrupted',
} as const

// Message action button styles
export const MESSAGE_ACTION_BUTTON_STYLES = {
  BASE: 'size-7 text-muted-foreground hover:text-foreground',
  DELETE: 'size-7 text-muted-foreground hover:text-destructive',
  ICON: 'size-4',
} as const

// Message action labels
export const MESSAGE_ACTION_LABELS = {
  COPY: 'Copy',
  COPIED: 'Copied!',
  REGENERATE: 'Regenerate',
  SHOW_PREVIEW: 'Show preview',
  SHOW_SOURCE: 'Show source',
  EDIT: 'Edit',
  DELETE: 'Delete',
  NO_CONTENT: 'No content to copy',
  WAIT_GENERATION: 'Please wait for the current generation to complete',
} as const
