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
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import type { User } from '../../types'
import { useUsersColumns } from '../users-columns'

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

const USER = {
  id: 42,
  username: 'payer',
  display_name: '',
  role: 1,
  status: 1,
  quota: 1900,
  used_quota: 1100,
  request_count: 0,
  group: 'default',
} as User

function QuotaRow(props: { onAdjustQuota?: (user: User) => void }) {
  const columns = useUsersColumns(props).filter(
    (column) =>
      column.id === 'quota' ||
      ('accessorKey' in column && column.accessorKey === 'quota')
  )
  const table = useReactTable({
    columns,
    data: [USER],
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <table>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

async function openQuotaDetails() {
  const trigger = screen.getByRole('button', {
    name: /^Available Balance .*; Used amount /,
  })
  await userEvent.click(trigger)
  return screen.findByRole('dialog', { name: 'Quota ($)' })
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})

afterEach(() => {
  cleanup()
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})

describe('adjusting a balance from the user list', () => {
  it('asks for the row it belongs to before opening the quota dialog', async () => {
    const onAdjustQuota = vi.fn()
    render(
      <I18nextProvider i18n={i18n}>
        <QuotaRow onAdjustQuota={onAdjustQuota} />
      </I18nextProvider>
    )

    const detail = await openQuotaDetails()
    await userEvent.click(
      within(detail).getByRole('button', { name: 'Adjust Quota' })
    )

    expect(onAdjustQuota).toHaveBeenCalledWith(USER)
  })

  it('leaves the details without an action when the reader cannot adjust it', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <QuotaRow />
      </I18nextProvider>
    )

    const detail = await openQuotaDetails()

    expect(
      within(detail).queryByRole('button', { name: 'Adjust Quota' })
    ).not.toBeInTheDocument()
  })
})
