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
  getCoreRowModel,
  useReactTable,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test } from 'vitest'

import { GroupMultiplierBadge } from '@/components/group-badge'

import { DataTableToolbar } from '../toolbar'

function Fixture() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const table = useReactTable({
    data: [],
    columns: [{ accessorKey: 'group' }],
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <>
      <DataTableToolbar
        table={table}
        hideViewOptions
        filters={[
          {
            columnId: 'group',
            title: 'Group',
            singleSelect: true,
            options: [
              { value: 'all', label: 'All Groups' },
              {
                value: 'premium',
                label: 'premium',
                suffix: <GroupMultiplierBadge ratio={1.23456} />,
              },
            ],
          },
        ]}
      />
      <output aria-label='Selected group'>
        {columnFilters[0]?.value as string[]}
      </output>
    </>
  )
}

test('choosing a filter shows its multiplier in the menu and selected label while filtering by group name', async () => {
  const user = userEvent.setup()
  render(<Fixture />)
  await user.click(screen.getByRole('button', { name: 'Group' }))
  expect(
    screen.getByRole('option', { name: 'All Groups' })
  ).not.toHaveTextContent('x')
  await user.click(screen.getByRole('option', { name: /premium.*1\.23456x/ }))
  expect(
    screen.getByRole('status', { name: 'Selected group' })
  ).toHaveTextContent('premium')
  await user.keyboard('{Escape}')
  expect(
    screen.getByRole('button', { name: /Group.*premium.*1\.23456x/ })
  ).toBeVisible()
})
