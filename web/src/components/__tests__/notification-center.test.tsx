import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { NotificationCenter } from '../notification-center'

const announcements = [
  {
    id: 2,
    content: 'New model catalogue is live',
    extra: 'Rolling out to every group',
    publishDate: '2026-10-30T09:00:00Z',
    type: 'success',
  },
  {
    id: 1,
    content: 'Scheduled maintenance finished',
    publishDate: '2026-10-20T09:00:00Z',
    type: 'info',
  },
]

function Fixture(props: {
  hasUnreadAnnouncements?: boolean
  notice?: string
  announcements?: typeof announcements
  initialOpen?: boolean
  initialTab?: 'notice' | 'announcements'
}) {
  const [open, setOpen] = useState(props.initialOpen ?? false)
  const [tab, setTab] = useState<'notice' | 'announcements'>(
    props.initialTab ?? 'notice'
  )
  return (
    <NotificationCenter
      open={open}
      onOpenChange={setOpen}
      hasUnreadAnnouncements={props.hasUnreadAnnouncements ?? true}
      activeTab={tab}
      onTabChange={setTab}
      notice={props.notice ?? 'Welcome to the gateway'}
      announcements={props.announcements ?? announcements}
      loading={false}
    />
  )
}

afterEach(cleanup)

describe('notification center', () => {
  it('marks unread announcements with a single dot instead of a count badge', () => {
    render(<Fixture />)
    const bell = screen.getByRole('button', { name: 'Notifications' })
    expect(bell.querySelector('[data-slot="notification-dot"]')).not.toBeNull()
    expect(bell).not.toHaveTextContent('1')
  })

  it('hides the dot once every announcement has been read', () => {
    render(<Fixture hasUnreadAnnouncements={false} />)
    const bell = screen.getByRole('button', { name: 'Notifications' })
    expect(bell.querySelector('[data-slot="notification-dot"]')).toBeNull()
  })

  it('opens a centred dialog titled Announcements with both tabs', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByRole('button', { name: 'Notifications' }))
    const dialog = await screen.findByRole('dialog', { name: 'Announcements' })
    expect(within(dialog).getByRole('tab', { name: 'Notice' })).toBeVisible()
    expect(
      within(dialog).getByRole('tab', { name: 'System Announcements' })
    ).toBeVisible()
  })

  it('renders system announcements as a chronological timeline', async () => {
    render(<Fixture initialOpen initialTab='announcements' />)
    const dialog = await screen.findByRole('dialog', { name: 'Announcements' })
    const items = within(dialog).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('New model catalogue is live')
    expect(items[1]).toHaveTextContent('Scheduled maintenance finished')
  })

  it('closes from the footer button', async () => {
    const user = userEvent.setup()
    render(<Fixture initialOpen />)
    const dialog = await screen.findByRole('dialog', { name: 'Announcements' })
    const footerClose = within(dialog)
      .getAllByRole('button', { name: 'Close' })
      .find((button) => button.textContent === 'Close')
    expect(footerClose).toBeDefined()
    await user.click(footerClose as HTMLElement)
    expect(
      screen.queryByRole('dialog', { name: 'Announcements' })
    ).not.toBeInTheDocument()
  })

  it('switches to the empty announcement timeline', async () => {
    const user = userEvent.setup()
    render(<Fixture initialOpen announcements={[]} />)
    const dialog = await screen.findByRole('dialog', { name: 'Announcements' })
    await user.click(
      within(dialog).getByRole('tab', { name: 'System Announcements' })
    )
    expect(within(dialog).getByText('No system announcements')).toBeVisible()
  })
})
