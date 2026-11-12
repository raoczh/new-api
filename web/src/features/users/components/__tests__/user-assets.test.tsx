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
import type { Row } from '@tanstack/react-table'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import type { User } from '../../types'
import { DataTableRowActions } from '../data-table-row-actions'
import { UserApiKeysDialog } from '../dialogs/user-api-keys-dialog'
import { UserGroupsDialog } from '../dialogs/user-groups-dialog'
import { UsersProvider, useUsers } from '../users-provider'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
}))

const target: User = {
  id: 2,
  username: 'managed-user',
  display_name: 'Managed user',
  role: 1,
  status: 1,
  quota: 0,
  used_quota: 0,
  request_count: 0,
  group: 'default',
}

function mockVerification(scope: string, proofToken: string) {
  return {
    data: {
      success: true,
      data: {
        proof_token: proofToken,
        method: '2fa',
        scope,
        expires_at: Math.floor(Date.now() / 1000) + 60,
      },
    },
  }
}

function renderInProvider(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <UsersProvider>{children}</UsersProvider>
    </QueryClientProvider>
  )
}

async function completeTwoFactorVerification() {
  await userEvent.type(
    await screen.findByLabelText('Authenticator code or backup code'),
    '123456'
  )
  await userEvent.click(screen.getByRole('button', { name: 'Verify' }))
}

/** Renders the dialog state the provider holds, so row buttons can be asserted. */
function DialogStateProbe() {
  const { open, currentRow } = useUsers()
  return (
    <span data-testid='dialog-state'>{`${open ?? 'none'}:${
      currentRow?.id ?? 'none'
    }`}</span>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  navigate.mockClear()
})

it('opens the usage logs filtered to the managed user', async () => {
  renderInProvider(
    <DataTableRowActions row={{ original: target } as Row<User>} />
  )

  await userEvent.click(screen.getByRole('button', { name: 'More actions' }))
  screen.getByRole('menuitem', { name: 'View logs' }).focus()
  await userEvent.keyboard('{Enter}')

  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      to: '/usage-logs/$section',
      params: { section: 'common' },
      search: { username: 'managed-user' },
    })
  )
})

it('opens quota, group and key dialogs from their own row buttons', async () => {
  renderInProvider(
    <>
      <DialogStateProbe />
      <DataTableRowActions row={{ original: target } as Row<User>} />
    </>
  )
  const dialogState = screen.getByTestId('dialog-state')

  for (const [button, expected] of [
    ['Adjust Quota', 'quota:2'],
    ['Groups', 'groups:2'],
    ['API Keys', 'api-keys:2'],
  ]) {
    await userEvent.click(screen.getByRole('button', { name: button }))
    expect(dialogState).toHaveTextContent(expected)
  }

  // 启用停用仍然直接可用，不需要先打开菜单。
  expect(screen.getByRole('button', { name: 'Disable' })).toBeVisible()
})

it('shows which groups a user can use and saves only the group fields', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/2/groups') {
      return {
        data: {
          success: true,
          data: {
            group: 'default',
            groups: [
              {
                name: 'default',
                desc: 'Standard group',
                ratio: 1,
                usable: true,
              },
              { name: 'vip', desc: 'Premium group', ratio: 0.5, usable: false },
            ],
            extra_usable_groups: [],
            hidden_usable_groups: [],
          },
        },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  renderInProvider(
    <UserGroupsDialog
      open
      onOpenChange={() => undefined}
      user={{ id: 2, username: 'managed-user' }}
    />
  )

  expect(await screen.findByText('Not usable')).toBeVisible()
  expect(await screen.findByText('Premium group')).toBeVisible()
  expect(screen.getAllByText('Own group').length).toBeGreaterThan(0)

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/user/2/groups', {
      group: 'default',
      extra_usable_groups: [],
      hidden_usable_groups: [],
    })
  )
})

it('keeps the full key behind verification and deletes with its own proof', async () => {
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/2/tokens') {
      return {
        data: {
          success: true,
          data: {
            items: [
              {
                id: 5,
                name: 'ci',
                key: 'sk-abc***xyz',
                status: 1,
                remain_quota: 0,
                used_quota: 0,
                unlimited_quota: true,
                expired_time: -1,
                created_time: 0,
                accessed_time: 0,
                group: 'default',
              },
            ],
            total: 1,
          },
        },
      }
    }
    if (url === '/api/verify/methods') {
      return {
        data: {
          success: true,
          data: {
            scope: 'admin.user.manage',
            methods: [{ method: '2fa', available: true }],
            oauth_providers: [],
            password_encryption_enabled: false,
          },
        },
      }
    }
    if (url === '/api/user/2/tokens/5/key') {
      return { data: { success: true, data: { key: 'sk-secret-full-key' } } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  const post = vi.spyOn(api, 'post').mockImplementation(async (url) => {
    if (url === '/api/verify') {
      return mockVerification('admin.user.manage', 'key-proof')
    }
    if (url === '/api/user/2/tokens/5/status') {
      return { data: { success: true } }
    }
    throw new Error(`Unexpected POST ${url}`)
  })
  const del = vi
    .spyOn(api, 'delete')
    .mockResolvedValue({ data: { success: true } })

  renderInProvider(
    <UserApiKeysDialog
      open
      onOpenChange={() => undefined}
      user={{ id: 2, username: 'managed-user' }}
    />
  )

  // 列表只拿到掩码，明文要等二次校验。
  expect(await screen.findByText('sk-abc***xyz')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'View full key' }))
  expect(get).not.toHaveBeenCalledWith(
    '/api/user/2/tokens/5/key',
    expect.anything()
  )
  await completeTwoFactorVerification()
  expect(await screen.findByText('sk-secret-full-key')).toBeVisible()
  expect(post).toHaveBeenCalledWith(
    '/api/verify',
    expect.objectContaining({
      scope: 'admin.user.manage',
      context: { user_id: 2, action: 'token_key_read' },
    }),
    expect.anything()
  )

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  const confirmation = await screen.findByRole('alertdialog')
  await userEvent.click(
    within(confirmation).getByRole('button', { name: 'Delete' })
  )
  await completeTwoFactorVerification()
  await waitFor(() =>
    expect(del).toHaveBeenCalledWith(
      '/api/user/2/tokens/5',
      expect.objectContaining({
        headers: { 'X-Security-Proof': 'key-proof' },
        singleUseAuthorization: true,
      })
    )
  )
  expect(post).toHaveBeenCalledWith(
    '/api/verify',
    expect.objectContaining({
      scope: 'admin.user.manage',
      context: { user_id: 2, action: 'token_delete' },
    }),
    expect.anything()
  )
})

it('toggles a key status without a verification round trip', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/2/tokens') {
      return {
        data: {
          success: true,
          data: {
            items: [
              {
                id: 5,
                name: 'ci',
                key: 'sk-abc***xyz',
                status: 1,
                remain_quota: 0,
                used_quota: 0,
                unlimited_quota: true,
                expired_time: -1,
                created_time: 0,
                accessed_time: 0,
                group: 'default',
              },
            ],
            total: 1,
          },
        },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true } })

  renderInProvider(
    <UserApiKeysDialog
      open
      onOpenChange={() => undefined}
      user={{ id: 2, username: 'managed-user' }}
    />
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Disable' }))

  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/api/user/2/tokens/5/status', {
      status: 2,
    })
  )
  expect(
    screen.queryByLabelText('Authenticator code or backup code')
  ).toBeNull()
})
