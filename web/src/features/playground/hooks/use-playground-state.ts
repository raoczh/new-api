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
import { useCallback, useEffect, useRef, useState } from 'react'

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../constants'
import {
  applyMessageStateUpdate,
  clearLegacyMessages,
  createConversation,
  deleteConversationMessages,
  deriveConversationTitle,
  getInitialParameterEnabled,
  getInitialPlaygroundConfig,
  loadConversationIndex,
  loadLegacyMessages,
  loadMessages,
  saveConfig,
  saveConversationIndex,
  saveMessages,
  saveParameterEnabled,
  type MessageStateUpdater,
} from '../lib'
import type {
  Message,
  PlaygroundConfig,
  PlaygroundConversation,
  PlaygroundConversationIndex,
  ParameterEnabled,
  ModelOption,
  GroupOption,
} from '../types'

const MESSAGE_SAVE_DEBOUNCE_MS = 500

function upsertConversationSummary(
  conversations: PlaygroundConversation[],
  conversationId: string,
  messages: Message[]
): PlaygroundConversation[] {
  const title = deriveConversationTitle(messages)
  if (!title) return conversations

  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? { ...conversation, title, updatedAt: Date.now() }
      : conversation
  )
}

/**
 * Main state management hook for playground.
 * Owns the conversation index and the messages of the active conversation.
 */
export function usePlaygroundState() {
  // Load initial state from localStorage
  const [config, setConfig] = useState<PlaygroundConfig>(
    getInitialPlaygroundConfig
  )

  const [parameterEnabled, setParameterEnabled] = useState<ParameterEnabled>(
    getInitialParameterEnabled
  )

  const [conversations, setConversations] = useState<PlaygroundConversation[]>(
    []
  )
  const [activeConversationId, setActiveConversationId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const messagesSaveTimerRef = useRef<number | null>(null)
  const latestMessagesRef = useRef<Message[]>(messages)
  const conversationsRef = useRef<PlaygroundConversation[]>([])
  const activeConversationIdRef = useRef('')
  const hasLoadedMessagesRef = useRef(false)

  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])

  const flushPendingSave = useCallback(() => {
    if (messagesSaveTimerRef.current !== null) {
      window.clearTimeout(messagesSaveTimerRef.current)
      messagesSaveTimerRef.current = null
    }

    if (!hasLoadedMessagesRef.current || !activeConversationIdRef.current) {
      return
    }

    saveMessages(activeConversationIdRef.current, latestMessagesRef.current)
    saveConversationIndex({
      activeId: activeConversationIdRef.current,
      items: conversationsRef.current,
    })
  }, [])

  const persistMessages = useCallback(
    (messagesToSave: Message[]) => {
      latestMessagesRef.current = messagesToSave

      if (!hasLoadedMessagesRef.current) {
        return
      }

      if (messagesSaveTimerRef.current !== null) {
        window.clearTimeout(messagesSaveTimerRef.current)
      }

      messagesSaveTimerRef.current = window.setTimeout(() => {
        messagesSaveTimerRef.current = null
        flushPendingSave()
      }, MESSAGE_SAVE_DEBOUNCE_MS)

      const conversationId = activeConversationIdRef.current
      if (!conversationId) return

      const nextConversations = upsertConversationSummary(
        conversationsRef.current,
        conversationId,
        messagesToSave
      )
      if (nextConversations !== conversationsRef.current) {
        conversationsRef.current = nextConversations
        setConversations(nextConversations)
      }
    },
    [flushPendingSave]
  )

  const applyIndex = useCallback((index: PlaygroundConversationIndex) => {
    activeConversationIdRef.current = index.activeId
    conversationsRef.current = index.items
    setActiveConversationId(index.activeId)
    setConversations(index.items)
    saveConversationIndex(index)
  }, [])

  useEffect(() => {
    let cancelled = false

    window.setTimeout(() => {
      const storedIndex = loadConversationIndex()

      if (storedIndex) {
        const hasActive = storedIndex.items.some(
          (conversation) => conversation.id === storedIndex.activeId
        )
        const items =
          hasActive || storedIndex.items.length > 0
            ? storedIndex.items
            : [createConversation()]
        const index = {
          activeId: hasActive ? storedIndex.activeId : items[0].id,
          items,
        }

        if (cancelled) return
        applyIndex(index)

        const loadedMessages = loadMessages(index.activeId) ?? []
        latestMessagesRef.current = loadedMessages
        hasLoadedMessagesRef.current = true
        setMessages(loadedMessages)
        setIsLoadingMessages(false)
        return
      }

      // Migrate the single-conversation layout into the first conversation.
      const legacyMessages = loadLegacyMessages()
      const conversation = createConversation(
        legacyMessages ? deriveConversationTitle(legacyMessages) : ''
      )

      if (cancelled) return
      applyIndex({ activeId: conversation.id, items: [conversation] })

      if (legacyMessages && legacyMessages.length > 0) {
        saveMessages(conversation.id, legacyMessages)
        latestMessagesRef.current = legacyMessages
        hasLoadedMessagesRef.current = true
        setMessages(legacyMessages)
        clearLegacyMessages()
      } else {
        latestMessagesRef.current = []
        hasLoadedMessagesRef.current = true
        setMessages([])
      }

      setIsLoadingMessages(false)
    }, 0)

    return () => {
      cancelled = true
    }
  }, [applyIndex])

  useEffect(() => () => flushPendingSave(), [flushPendingSave])

  // Update config with automatic save
  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      setConfig((prev) => {
        const updated = { ...prev, [key]: value }
        saveConfig(updated)
        return updated
      })
    },
    []
  )

  // Update parameter enabled with automatic save
  const updateParameterEnabled = useCallback(
    (key: keyof ParameterEnabled, value: boolean) => {
      setParameterEnabled((prev) => {
        const updated = { ...prev, [key]: value }
        saveParameterEnabled(updated)
        return updated
      })
    },
    []
  )

  // Update messages with automatic save
  const updateMessages = useCallback(
    (updater: MessageStateUpdater) => {
      setMessages((prev) => {
        const newMessages = applyMessageStateUpdate(prev, updater)
        persistMessages(newMessages)
        return newMessages
      })
    },
    [persistMessages]
  )

  const loadConversationMessages = useCallback((conversationId: string) => {
    const loadedMessages = loadMessages(conversationId) ?? []
    latestMessagesRef.current = loadedMessages
    setMessages(loadedMessages)
  }, [])

  // Switch the active conversation, flushing the current one first.
  const selectConversation = useCallback(
    (conversationId: string) => {
      if (conversationId === activeConversationIdRef.current) return

      flushPendingSave()
      applyIndex({
        activeId: conversationId,
        items: conversationsRef.current,
      })
      loadConversationMessages(conversationId)
    },
    [applyIndex, flushPendingSave, loadConversationMessages]
  )

  // Start a new conversation. Reuses the active one when it is still empty so
  // the history list does not collect blank entries.
  const createNewConversation = useCallback(() => {
    flushPendingSave()

    const activeConversation = conversationsRef.current.find(
      (conversation) => conversation.id === activeConversationIdRef.current
    )

    if (activeConversation && latestMessagesRef.current.length === 0) {
      return activeConversation.id
    }

    const conversation = createConversation()
    const items = [conversation, ...conversationsRef.current]

    applyIndex({ activeId: conversation.id, items })
    latestMessagesRef.current = []
    setMessages([])
    return conversation.id
  }, [applyIndex, flushPendingSave])

  const deleteConversation = useCallback(
    (conversationId: string) => {
      if (messagesSaveTimerRef.current !== null) {
        window.clearTimeout(messagesSaveTimerRef.current)
        messagesSaveTimerRef.current = null
      }

      deleteConversationMessages(conversationId)
      const remaining = conversationsRef.current.filter(
        (conversation) => conversation.id !== conversationId
      )

      if (remaining.length === 0) {
        const conversation = createConversation()
        applyIndex({ activeId: conversation.id, items: [conversation] })
        latestMessagesRef.current = []
        setMessages([])
        return conversation.id
      }

      const wasActive = activeConversationIdRef.current === conversationId
      const nextActiveId = wasActive
        ? remaining[0].id
        : activeConversationIdRef.current

      applyIndex({ activeId: nextActiveId, items: remaining })

      if (wasActive) {
        loadConversationMessages(nextActiveId)
      }

      return nextActiveId
    },
    [applyIndex, loadConversationMessages]
  )

  // Clear all messages of the active conversation
  const clearMessages = useCallback(() => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId) return

    const items = conversationsRef.current.map((conversation) =>
      conversation.id === conversationId
        ? { ...conversation, title: '', updatedAt: Date.now() }
        : conversation
    )
    conversationsRef.current = items
    setConversations(items)
    saveConversationIndex({ activeId: conversationId, items })

    updateMessages([])
  }, [updateMessages])

  // Reset config to defaults
  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    setParameterEnabled(DEFAULT_PARAMETER_ENABLED)
    saveConfig(DEFAULT_CONFIG)
    saveParameterEnabled(DEFAULT_PARAMETER_ENABLED)
  }, [])

  return {
    // State
    config,
    parameterEnabled,
    messages,
    isLoadingMessages,
    conversations,
    activeConversationId,
    models,
    groups,

    // Setters
    setModels,
    setGroups,

    // Actions
    updateConfig,
    updateParameterEnabled,
    updateMessages,
    clearMessages,
    createNewConversation,
    selectConversation,
    deleteConversation,
    resetConfig,
  }
}
