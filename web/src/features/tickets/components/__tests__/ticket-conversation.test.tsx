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
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import type { TicketDetail, TicketScope } from '../../types'
import { TicketConversation } from '../ticket-conversation'

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

function detail(status: 1 | 2 | 3): TicketDetail {
  return {
    ticket: {
      id: 5,
      user_id: 11,
      username: 'alice',
      title: 'API returns 500',
      status,
      created_at: 1_700_000_000,
      updated_at: 1_700_000_100,
      closed_at: status === 3 ? 1_700_000_200 : 0,
    },
    messages: [
      {
        id: 1,
        ticket_id: 5,
        user_id: 11,
        username: 'alice',
        is_admin: false,
        content: 'The API returns 500',
        created_at: 1_700_000_000,
      },
      {
        id: 2,
        ticket_id: 5,
        user_id: 1,
        username: 'root',
        is_admin: true,
        content: 'Fixed, please retry',
        created_at: 1_700_000_100,
      },
    ],
  }
}

function renderConversation(scope: TicketScope) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <TicketConversation scope={scope} ticketId={5} onBack={() => {}} />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: detail(2) },
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('aligns user messages to the right when the user views their own ticket', async () => {
  renderConversation('self')
  const userMessage = await screen.findByText('The API returns 500')
  const adminMessage = screen.getByText('Fixed, please retry')
  expect(userMessage.closest('li')).toHaveClass('items-end')
  expect(adminMessage.closest('li')).toHaveClass('items-start')
  expect(adminMessage.closest('li')).toHaveTextContent('Support')
})

it('aligns admin messages to the right when an admin views the ticket', async () => {
  renderConversation('admin')
  const adminMessage = await screen.findByText('Fixed, please retry')
  expect(adminMessage.closest('li')).toHaveClass('items-end')
  expect(screen.getByText('The API returns 500').closest('li')).toHaveClass(
    'items-start'
  )
  expect(api.get).toHaveBeenCalledWith('/api/ticket/admin/5')
})

it('sends the trimmed reply with Ctrl+Enter and clears the draft on success', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true, data: {} } })
  renderConversation('self')
  await screen.findByText('Fixed, please retry')
  const input = screen.getByRole('textbox', { name: 'Reply' })
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

  await userEvent.type(input, '  still failing  ')
  await userEvent.keyboard('{Control>}{Enter}{/Control}')

  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/api/ticket/self/5/reply', {
      content: 'still failing',
    })
  )
  await waitFor(() => expect(input).toHaveValue(''))
})

it('hides the reply box and close action when the ticket is closed', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: detail(3) },
  })
  renderConversation('admin')
  expect(
    await screen.findByText(
      'This ticket is closed and can no longer be replied to.'
    )
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('textbox', { name: 'Reply' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Close Ticket' })
  ).not.toBeInTheDocument()
})

it('closes an open ticket only after confirmation', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true } })
  renderConversation('admin')
  await userEvent.click(
    await screen.findByRole('button', { name: 'Close Ticket' })
  )
  expect(post).not.toHaveBeenCalled()

  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Close Ticket' })
  )
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/api/ticket/admin/5/close')
  )
})
