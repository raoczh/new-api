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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { beforeAll, describe, expect, test, vi } from 'vitest'

import type { PlaygroundConversation } from '../../../types'
import { PlaygroundHistoryPanel } from '../playground-history-panel'

const NOW = Date.now()
const DAY_MS = 24 * 60 * 60 * 1000

const conversations: PlaygroundConversation[] = [
  {
    id: 'today-chat',
    title: 'Today chat',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'yesterday-chat',
    title: '',
    createdAt: NOW - DAY_MS,
    updatedAt: NOW - DAY_MS,
  },
]

function renderPanel(options: {
  disabled?: boolean
  onCreate?: () => void
  onDelete?: (conversationId: string) => void
  onSelect?: (conversationId: string) => void
  items?: PlaygroundConversation[]
} = {}) {
  return render(
    <PlaygroundHistoryPanel
      activeConversationId='today-chat'
      conversations={options.items ?? conversations}
      disabled={options.disabled}
      onCreate={options.onCreate ?? (() => undefined)}
      onDelete={options.onDelete ?? (() => undefined)}
      onSelect={options.onSelect ?? (() => undefined)}
    />
  )
}

describe('PlaygroundHistoryPanel', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      Cancel: 'Cancel',
      Delete: 'Delete',
      'Delete conversation': 'Delete conversation',
      'Delete this conversation?': 'Delete this conversation?',
      History: 'History',
      'New chat': 'New chat',
      'No conversations yet': 'No conversations yet',
      Today: 'Today',
      'This conversation will be deleted. This cannot be undone.':
        'This conversation will be deleted. This cannot be undone.',
      'Untitled conversation': 'Untitled conversation',
      Yesterday: 'Yesterday',
    })
  })

  test('renders grouped conversations and marks the active one', () => {
    renderPanel()

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
    expect(screen.getByText('Untitled conversation')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Today chat' })
    ).toHaveAttribute('aria-current', 'true')
    expect(
      screen.getByRole('button', { name: 'Untitled conversation' })
    ).not.toHaveAttribute('aria-current')
  })

  test('shows an empty hint when there are no conversations', () => {
    renderPanel({ items: [] })

    expect(screen.getByText('No conversations yet')).toBeInTheDocument()
  })

  test('creates a new conversation from the header action', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()

    renderPanel({ onCreate })

    await user.click(screen.getByRole('button', { name: 'New chat' }))

    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  test('selects a conversation when its title is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    renderPanel({ onSelect })

    await user.click(screen.getByRole('button', { name: 'Today chat' }))

    expect(onSelect).toHaveBeenCalledWith('today-chat')
  })

  test('deletes a conversation only after confirmation', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()

    renderPanel({ onDelete })

    await user.click(
      screen.getAllByRole('button', { name: 'Delete conversation' })[0]
    )
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText('Delete this conversation?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledWith('today-chat')
  })

  test('keeps the conversation when the delete dialog is cancelled', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()

    renderPanel({ onDelete })

    await user.click(
      screen.getAllByRole('button', { name: 'Delete conversation' })[0]
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onDelete).not.toHaveBeenCalled()
  })

  test('disables history actions while a response is streaming', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    const onSelect = vi.fn()

    renderPanel({ disabled: true, onCreate, onSelect })

    const newChatButton = screen.getByRole('button', { name: 'New chat' })
    expect(newChatButton).toBeDisabled()

    const conversationButton = screen.getByRole('button', {
      name: 'Today chat',
    })
    expect(conversationButton).toBeDisabled()

    await user.click(newChatButton)
    await user.click(conversationButton)

    expect(onCreate).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
