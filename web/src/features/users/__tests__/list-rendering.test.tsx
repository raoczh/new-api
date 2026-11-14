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
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { Route as UsersRoute } from '@/routes/_authenticated/users/index'
import { useAuthStore } from '@/stores/auth-store'

import { Users } from '../index'

// Every list row shows its user ID through this cell, so the IDs it is asked
// to draw tell which rows React rendered. The real cell still does the drawing.
const idCell = vi.hoisted(() => ({ rendered: [] as number[] }))
vi.mock('@/components/table-id', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/components/table-id')>()
  return {
    ...original,
    TableId: (props: React.ComponentProps<typeof original.TableId>) => {
      idCell.rendered.push(Number(props.value))
      return <original.TableId {...props} />
    },
  }
})

const listedUsers = [2, 3, 4].map((id) => ({
  id,
  username: `listed-user-${id}`,
  display_name: '',
  role: 1,
  status: 1,
  quota: 0,
  used_quota: 0,
  request_count: 0,
  group: 'default',
}))

const clients: QueryClient[] = []

async function renderUsersPage() {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/group/') {
      return { data: { success: true, data: ['default'] } }
    }
    if (url === '/api/user/') {
      return {
        data: {
          success: true,
          data: { items: listedUsers, total: listedUsers.length },
        },
      }
    }
    if (/^\/api\/user\/\d+\/groups$/.test(String(url))) {
      return {
        data: {
          success: true,
          data: {
            group: 'default',
            groups: [],
            extra_usable_groups: [],
            hidden_usable_groups: [],
            group_ratios: {},
          },
        },
      }
    }
    // Dialogs load their own data; none of it belongs to the list.
    return { data: { success: true, data: {} } }
  })
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const users = createRoute({
    getParentRoute: () => auth,
    path: 'users/',
    validateSearch: UsersRoute.options.validateSearch,
    component: function UsersPage() {
      return (
        <TooltipProvider>
          <Users />
        </TooltipProvider>
      )
    },
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([users])]),
    history: createMemoryHistory({ initialEntries: ['/users/'] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByText('listed-user-4')
  await waitFor(() => expect(client.isFetching()).toBe(0))
  idCell.rendered.length = 0
}

function getUserRow(id: number): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(`listed-user-${id}`) })
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.clear()
  useAuthStore.getState().auth.setUser({ id: 1, username: 'admin', role: 100 })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
  localStorage.clear()
  useAuthStore.getState().auth.reset()
})

it.each(['Edit', 'Adjust Quota', 'Groups', 'API Keys'])(
  'opening %s from a row draws the dialog without rendering the list rows again',
  async (action) => {
    const user = userEvent.setup()
    await renderUsersPage()

    await user.click(
      within(getUserRow(3)).getByRole('button', { name: action })
    )

    await screen.findByRole('dialog')
    expect(idCell.rendered).toEqual([])
  }
)

it('selecting one user renders only that row again', async () => {
  const user = userEvent.setup()
  await renderUsersPage()

  await user.click(
    within(getUserRow(3)).getByRole('checkbox', { name: 'Select row' })
  )

  expect(
    within(getUserRow(3)).getByRole('checkbox', { name: 'Select row' })
  ).toBeChecked()
  expect(idCell.rendered).toEqual([3])
})
