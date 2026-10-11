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
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { usageLogSchema } from '../../data/schema'
import { ChannelSwitchAction } from '../channel-switch-action'
import { useCommonLogsColumns } from '../columns/common-logs-columns'

const log = usageLogSchema.parse({
  id: 1,
  user_id: 2,
  created_at: 1,
  type: 2,
  content: '',
  channel: 7,
  model_name: 'test-model',
  other: JSON.stringify({
    admin_info: {
      channel_affinity: {
        rule_name: 'session',
        model: 'test-model',
        using_group: 'default',
        key_fp: 'abcd1234',
        cache_key_hash: 'a'.repeat(64),
      },
    },
  }),
})

const previousUser = useAuthStore.getState().auth.user
let client: QueryClient
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'admin',
    role: ROLE.ADMIN,
    permissions: { admin_permissions: { channel: { operate: true } } },
  })
})
afterEach(() => {
  client.clear()
  useAuthStore.getState().auth.setUser(previousUser)
})

function renderAction(request = log) {
  return render(
    <QueryClientProvider client={client}>
      <ChannelSwitchAction log={request} />
      <Toaster />
    </QueryClientProvider>
  )
}

function LogRowActions(props: { admin: boolean }) {
  const table = useReactTable({
    data: [log],
    columns: useCommonLogsColumns(props.admin, false),
    getCoreRowModel: getCoreRowModel(),
  })
  const action = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((cell) => cell.column.id === 'actions')
  return action
    ? flexRender(action.column.columnDef.cell, action.getContext())
    : null
}

test('uses an icon-only action with a label and opens confirmation from the keyboard', async () => {
  const user = userEvent.setup()
  renderAction()
  const button = screen.getByRole('button', { name: 'Switch channel' })
  expect(button.textContent).toBe('')
  expect(button).toHaveAttribute('title', 'Clear cache and switch channel')
  await user.tab()
  expect(button).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(await screen.findByRole('alertdialog')).toBeVisible()
})

test('shows request row actions only in the administrator log view', () => {
  const { rerender } = render(
    <QueryClientProvider client={client}>
      <LogRowActions admin />
    </QueryClientProvider>
  )
  expect(screen.getByRole('button', { name: 'Switch channel' })).toBeEnabled()
  rerender(
    <QueryClientProvider client={client}>
      <LogRowActions admin={false} />
    </QueryClientProvider>
  )
  expect(
    screen.queryByRole('button', { name: 'Switch channel' })
  ).not.toBeInTheDocument()
})

test.each([ROLE.USER, ROLE.ADMIN])(
  'hides channel switching without administrator operation permission (%s)',
  (role) => {
    useAuthStore
      .getState()
      .auth.setUser({ id: 2, username: 'restricted', role })
    renderAction()
    expect(
      screen.queryByRole('button', { name: 'Switch channel' })
    ).not.toBeInTheDocument()
  }
)

test('disables switching when the log has no session binding', () => {
  renderAction({ ...log, other: '{}' })
  expect(screen.getByRole('button', { name: 'Switch channel' })).toBeDisabled()
})

test('confirms switching, prevents duplicate submissions, and reports success', async () => {
  const user = userEvent.setup()
  let finish!: (value: { data: { success: boolean } }) => void
  const post = vi.spyOn(api, 'post').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  renderAction()
  await user.click(screen.getByRole('button', { name: 'Switch channel' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(post).not.toHaveBeenCalled()
  const confirm = within(dialog).getByRole('button', { name: 'Continue' })
  await user.click(confirm)
  expect(confirm).toBeDisabled()
  expect(post).toHaveBeenCalledWith('/api/log/channel_affinity/switch', {
    cache_key_hash: 'a'.repeat(64),
    rule_name: 'session',
    model: 'test-model',
    using_group: 'default',
    key_fp: 'abcd1234',
    channel_id: 7,
  })
  finish({ data: { success: true } })
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  )
  expect(
    await screen.findByText(
      'Session binding cleared. The next request will avoid this channel.'
    )
  ).toBeVisible()
})

test('keeps the confirmation open and permits retry after a rejected switch', async () => {
  const user = userEvent.setup()
  vi.spyOn(api, 'post').mockResolvedValue({
    data: {
      success: false,
      message: 'Session binding has expired or was cleared',
    },
  })
  renderAction()
  await user.click(screen.getByRole('button', { name: 'Switch channel' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
  expect(
    await screen.findByText('Session binding has expired or was cleared')
  ).toBeVisible()
  expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeEnabled()
})
