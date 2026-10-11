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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { downloadTicketAttachment, getTicketAttachment } from '../api'
import { appendTicketAttachments } from '../lib/attachments'
import type { TicketMessage } from '../types'
import { TicketMessageBubble } from './ticket-message-bubble'

vi.mock('../api', () => ({
  downloadTicketAttachment: vi.fn(),
  getTicketAttachment: vi.fn(),
}))

const message: TicketMessage = {
  id: 3,
  ticket_id: 7,
  user_id: 11,
  username: 'alice',
  is_admin: false,
  content: 'Please see the attachment.',
  created_at: 1_700_000_000,
  attachments: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows an image thumbnail and opens its full-size preview', async () => {
  vi.mocked(getTicketAttachment).mockResolvedValue(
    new Blob(['image data'], { type: 'image/png' })
  )
  class URLWithObjectUrls extends URL {
    static createObjectURL(): string {
      return 'blob:ticket-image'
    }
    static revokeObjectURL(): void {}
  }
  vi.stubGlobal('URL', URLWithObjectUrls)

  render(
    <TicketMessageBubble
      message={{
        ...message,
        attachments: [
          {
            id: 4,
            ticket_id: 7,
            message_id: 3,
            filename: 'screenshot.png',
            content_type: 'image/png',
            size: 128,
            created_at: 1_700_000_000,
          },
        ],
      }}
      scope='self'
      own
    />
  )

  const thumbnail = await screen.findByRole('button', {
    name: 'Preview image: screenshot.png',
  })
  expect(thumbnail.querySelector('img')).toHaveAttribute(
    'src',
    'blob:ticket-image'
  )
  await userEvent.click(thumbnail)
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toBeInTheDocument()
  expect(dialog.querySelector('img')).toHaveAttribute(
    'src',
    'blob:ticket-image'
  )
})

test('downloads non-image attachments through the authenticated API client', async () => {
  vi.mocked(downloadTicketAttachment).mockResolvedValue()

  render(
    <TicketMessageBubble
      message={{
        ...message,
        attachments: [
          {
            id: 5,
            ticket_id: 7,
            message_id: 3,
            filename: 'report.pdf',
            content_type: 'application/pdf',
            size: 256,
            created_at: 1_700_000_000,
          },
        ],
      }}
      scope='self'
      own
    />
  )

  await userEvent.click(screen.getByRole('button', { name: /report\.pdf/ }))
  await waitFor(() =>
    expect(downloadTicketAttachment).toHaveBeenCalledWith(
      'self',
      7,
      expect.objectContaining({ id: 5, filename: 'report.pdf' })
    )
  )
})

test('accepts pasted images while enforcing attachment limits', () => {
  const result = appendTicketAttachments(
    [],
    [
      new File(['image'], 'pasted.png', { type: 'image/png' }),
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', {
        type: 'image/png',
      }),
    ]
  )

  expect(result.attachments).toHaveLength(1)
  expect(result.attachments[0]?.file.name).toBe('pasted.png')
  expect(result.hasOversizedFile).toBe(true)
  expect(result.exceedsCount).toBe(false)
})
