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
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { useMemo } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import type {
  User,
  UserRechargeHistory,
  UserRechargeRecord,
} from '../../../types'
import { DataTableRowActions } from '../../data-table-row-actions'
import { UsersProvider } from '../../users-provider'

const language = createInstance()
await language.init({
  lng: 'en',
  initAsync: false,
  resources: { en: { translation: {} }, zhCN: zh },
})

const target: User = {
  id: 2,
  username: 'recharge-owner',
  display_name: '',
  role: 1,
  status: 1,
  quota: 0,
  used_quota: 0,
  request_count: 0,
  group: 'default',
}
const records: UserRechargeRecord[] = [
  {
    id: 'online-1',
    source: 'online',
    created_at: 1730000000,
    status: 'success',
    quota: '4000000',
    reference: 'online-order',
    payment_method: 'alipay',
  },
  {
    id: 'manual-1',
    source: 'manual',
    created_at: 1730000001,
    status: 'success',
    quota: '-500000',
    reference: '',
    action: 'user.quota_override',
    before: 1500000,
    after: 1000000,
    operator: 'root-operator',
  },
  {
    id: 'redemption-1',
    source: 'redemption',
    created_at: 1730000002,
    status: 'success',
    quota: '1000000',
    reference: 'credit-code',
  },
]
const history: UserRechargeHistory = {
  items: records,
  total: 11,
  page: 1,
  page_size: 10,
  summary: {
    credited_quota: '5000000',
    debited_quota: '500000',
    net_quota: '4500000',
    unknown_count: 0,
  },
}
const clients: QueryClient[] = []

function RowActions(props: { user: User }) {
  const data = useMemo(() => [props.user], [props.user])
  const table = useReactTable({
    data,
    columns: [],
    getCoreRowModel: getCoreRowModel(),
  })
  return <DataTableRowActions row={table.getRowModel().rows[0]} />
}

function renderActions() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 10000 } },
  })
  clients.push(client)
  const wrap = (user: User) => (
    <I18nextProvider i18n={language}>
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <UsersProvider>
            <RowActions user={user} />
          </UsersProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
  const view = render(wrap(target))
  return { ...view, switchUser: (user: User) => view.rerender(wrap(user)) }
}

beforeEach(async () => {
  await language.changeLanguage('en')
  useAuthStore.getState().auth.setUser({ id: 1, username: 'root', role: 100 })
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'USD' },
  })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  localStorage.clear()
})

it('opens the selected user history from the menu and keeps all-record totals while paging', async () => {
  const interaction = userEvent.setup()
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true, data: history } })
  renderActions()
  expect(get).not.toHaveBeenCalled()
  await interaction.click(screen.getByRole('button', { name: 'Open menu' }))
  screen.getByRole('menuitem', { name: 'Recharge records' }).focus()
  await interaction.keyboard('{Enter}')

  const dialog = await screen.findByRole('dialog', { name: 'Recharge records' })
  await within(dialog).findByText('online-order')
  expect(
    within(dialog).getByText('Manual balance override')
  ).toBeInTheDocument()
  expect(
    within(dialog).getByText('Redemption code recharge')
  ).toBeInTheDocument()
  expect(
    within(dialog).getByText('Operator: root-operator')
  ).toBeInTheDocument()
  expect(
    within(dialog).getByText('Balance change: $3 to $2')
  ).toBeInTheDocument()
  expect(within(dialog).getByText('$9')).toBeInTheDocument()
  expect(get).toHaveBeenCalledWith('/api/user/2/recharge-history', {
    params: { p: 1, page_size: 10 },
    signal: expect.any(AbortSignal),
  })
  expect(
    screen.getByRole('button', { name: 'Go to previous page' })
  ).toBeDisabled()

  get.mockResolvedValueOnce({
    data: { success: true, data: { ...history, items: [records[2]], page: 2 } },
  })
  await interaction.click(
    screen.getByRole('button', { name: 'Go to next page' })
  )
  await waitFor(() =>
    expect(screen.queryByText('online-order')).not.toBeInTheDocument()
  )
  expect(await screen.findByText('$9')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled()
  expect(get).toHaveBeenLastCalledWith('/api/user/2/recharge-history', {
    params: { p: 2, page_size: 10 },
    signal: expect.any(AbortSignal),
  })
  await interaction.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  await interaction.click(screen.getByRole('button', { name: 'Open menu' }))
  await interaction.click(
    screen.getByRole('menuitem', { name: 'Recharge records' })
  )
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/api/user/2/recharge-history', {
      params: { p: 1, page_size: 10 },
      signal: expect.any(AbortSignal),
    })
  )
})

it('shows loading then a retryable error instead of a misleading zero total', async () => {
  const interaction = userEvent.setup()
  let rejectRequest!: (reason: Error) => void
  const pending = new Promise<never>((_resolve, reject) => {
    rejectRequest = reject
  })
  const get = vi.spyOn(api, 'get').mockReturnValueOnce(pending)
  renderActions()
  await interaction.click(screen.getByRole('button', { name: 'Open menu' }))
  await interaction.click(
    screen.getByRole('menuitem', { name: 'Recharge records' })
  )
  expect(await screen.findByRole('status')).toHaveTextContent('Loading...')
  await act(async () => rejectRequest(new Error('History unavailable')))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'History unavailable'
  )
  expect(screen.queryByText('Net recharge total')).not.toBeInTheDocument()

  get.mockResolvedValueOnce({
    data: {
      success: true,
      data: {
        ...history,
        items: [],
        total: 0,
        summary: {
          credited_quota: '0',
          debited_quota: '0',
          net_quota: '0',
          unknown_count: 0,
        },
      },
    },
  })
  await interaction.click(screen.getByRole('button', { name: 'Retry' }))
  expect(
    await screen.findByText('No billing records found')
  ).toBeInTheDocument()
  expect(screen.getAllByText('$0')).toHaveLength(3)
  expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled()
})

it('resets pagination for another user and responds to a language change', async () => {
  const interaction = userEvent.setup()
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true, data: history } })
  const view = renderActions()
  await interaction.click(screen.getByRole('button', { name: 'Open menu' }))
  await interaction.click(
    screen.getByRole('menuitem', { name: 'Recharge records' })
  )
  await screen.findByText('online-order')
  await interaction.click(
    screen.getByRole('button', { name: 'Go to next page' })
  )
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      '/api/user/2/recharge-history',
      expect.objectContaining({ params: { p: 2, page_size: 10 } })
    )
  )

  get.mockResolvedValue({
    data: {
      success: true,
      data: {
        ...history,
        items: [{ ...records[1], quota: null }],
        total: 1,
        summary: { ...history.summary, unknown_count: 1 },
      },
    },
  })
  view.switchUser({ ...target, id: 3, username: 'another-owner' })
  expect(
    await screen.findByText('Recharge history for another-owner')
  ).toBeInTheDocument()
  expect(await screen.findByText('Unknown amount')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent(
    '1 records have no recoverable amount'
  )
  expect(get).toHaveBeenLastCalledWith(
    '/api/user/3/recharge-history',
    expect.objectContaining({ params: { p: 1, page_size: 10 } })
  )
  expect(screen.queryByText('online-order')).not.toBeInTheDocument()
  await act(async () => language.changeLanguage('zhCN'))
  expect(
    screen.getByRole('dialog', { name: zh.translation['Recharge records'] })
  ).toBeInTheDocument()
  expect(
    screen.getByText(zh.translation['Net recharge total'])
  ).toBeInTheDocument()
})
