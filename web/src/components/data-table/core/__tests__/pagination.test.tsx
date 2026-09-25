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
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'

import { SectionPageLayout } from '@/components/layout'

import { DataTablePage } from '../../layout/data-table-page'
import { DataTablePagination } from '../pagination'

const rows = [{ id: 1 }, { id: 2 }, { id: 3 }]
const emptyRows: { id: number }[] = []

function Fixture(props: {
  empty?: boolean
  compact?: boolean
  page?: boolean
}) {
  const columns = [{ accessorKey: 'id', header: 'ID' }]
  const table = useReactTable({
    data: props.empty ? emptyRows : rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
  })
  if (props.page) {
    return (
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>Records</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <DataTablePage table={table} columns={columns} compactPagination />
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }
  return <DataTablePagination table={table} compact={props.compact} />
}

it('keeps footer pagination outside the table and changes visible rows from the keyboard', async () => {
  const user = userEvent.setup()
  render(<Fixture page />)
  const next = screen.getByRole('button', { name: 'Go to next page' })
  expect(screen.getByRole('cell', { name: '1' })).toBeVisible()
  for (const table of screen.getAllByRole('table')) {
    expect(table.contains(next)).toBe(false)
  }
  next.focus()
  await user.keyboard('[Enter]')
  expect(screen.getByRole('cell', { name: '3' })).toBeVisible()
  expect(screen.queryByRole('cell', { name: '1' })).not.toBeInTheDocument()
  expect(next).toBeDisabled()
  expect(screen.getByText('2 / 2')).toBeVisible()
})
it('moves between pages in compact mode and disables the boundary actions', async () => {
  const user = userEvent.setup()
  render(<Fixture compact />)
  expect(screen.getByText('1 / 2')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Go to previous page' })
  ).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Go to next page' }))
  expect(screen.getByText('2 / 2')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Go to previous page' }))
  expect(screen.getByText('1 / 2')).toBeVisible()
})
it('shows a valid empty page with navigation disabled', () => {
  render(<Fixture empty compact />)
  expect(screen.getByText('1 / 1')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Go to previous page' })
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled()
})
it('labels page size selection and updates the available pages', async () => {
  const user = userEvent.setup()
  render(<Fixture />)
  const pageSize = screen.getByRole('combobox', { name: 'Rows per page' })
  expect(screen.getByRole('button', { name: 'Go to next page' })).toBeEnabled()
  pageSize.focus()
  await user.keyboard('[Enter]')
  await user.click(screen.getByRole('option', { name: '20' }))
  expect(pageSize).toHaveTextContent('20')
  expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled()
})
