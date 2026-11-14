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

/** Groups as the server reports them for a user whose own group is default. */
const groupsOfManagedUser = {
  group: 'default',
  groups: [
    {
      name: 'default',
      desc: 'Standard group',
      ratio: 1,
      usable: true,
      default_ratio: 1,
      default_usable: true,
      has_ratio: true,
    },
    {
      name: 'vip',
      desc: 'Premium group',
      ratio: 0.5,
      usable: true,
      default_ratio: 0.5,
      default_usable: true,
      has_ratio: true,
    },
    {
      name: 'partner',
      desc: 'Partner group',
      ratio: 2,
      usable: false,
      default_ratio: 2,
      default_usable: false,
      has_ratio: true,
    },
  ],
  extra_usable_groups: [],
  hidden_usable_groups: [],
  group_ratios: {},
}

function renderGroupsDialog(groups: object = groupsOfManagedUser) {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/2/groups') {
      return { data: { success: true, data: groups } }
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
  return put
}

it('lists every group with a tick for the ones the user can use', async () => {
  renderGroupsDialog()

  expect(await screen.findByRole('checkbox', { name: /^vip/ })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: /^partner/ })).not.toBeChecked()
  // The own group is always usable, so it cannot be cleared.
  expect(screen.getByRole('checkbox', { name: /^default/ })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: /^default/ })).toHaveAttribute(
    'aria-disabled',
    'true'
  )
  expect(screen.getByText('Premium group')).toBeVisible()
  expect(screen.getByText('2 of 3 usable')).toBeVisible()
})

it('ticking and clearing groups saves them as the extra visible and hidden groups', async () => {
  const put = renderGroupsDialog()

  await userEvent.click(await screen.findByRole('checkbox', { name: /^vip/ }))
  await userEvent.click(screen.getByRole('checkbox', { name: /^partner/ }))
  expect(screen.getByText('Blocked for this user')).toBeVisible()
  expect(screen.getByText('Added for this user')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/user/2/groups', {
      group: 'default',
      extra_usable_groups: ['partner'],
      hidden_usable_groups: ['vip'],
      group_ratios: {},
    })
  )
})

it('ticking a hidden group again removes the override instead of adding another', async () => {
  const put = renderGroupsDialog({
    ...groupsOfManagedUser,
    groups: groupsOfManagedUser.groups.map((group) =>
      group.name === 'vip' ? { ...group, usable: false } : group
    ),
    hidden_usable_groups: ['vip'],
  })

  await userEvent.click(await screen.findByRole('checkbox', { name: /^vip/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      '/api/user/2/groups',
      expect.objectContaining({
        extra_usable_groups: [],
        hidden_usable_groups: [],
      })
    )
  )
})

it('a ratio typed for a group is saved for this user and an emptied one is removed', async () => {
  const put = renderGroupsDialog({
    ...groupsOfManagedUser,
    group_ratios: { default: 0.8 },
  })

  const vipRatio = await screen.findByRole('textbox', {
    name: 'Ratio of vip for this user',
  })
  // The saved ratio is shown, and an empty field offers the default one.
  expect(
    screen.getByRole('textbox', { name: 'Ratio of default for this user' })
  ).toHaveValue('0.8')
  expect(vipRatio).toHaveAttribute('placeholder', '0.5')

  await userEvent.type(vipRatio, '0.3')
  await userEvent.clear(
    screen.getByRole('textbox', { name: 'Ratio of default for this user' })
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      '/api/user/2/groups',
      expect.objectContaining({ group_ratios: { vip: 0.3 } })
    )
  )
})

it.each(['-1', 'abc', '1000.5'])(
  'a ratio of %s is pointed out and nothing is saved',
  async (typed) => {
    const put = renderGroupsDialog()

    const vipRatio = await screen.findByRole('textbox', {
      name: 'Ratio of vip for this user',
    })
    await userEvent.type(vipRatio, typed)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(vipRatio).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'A ratio must be a number from 0 to 1000.'
    )
    expect(put).not.toHaveBeenCalled()
  }
)

/** One key of the managed user, as the masked admin listing returns it. */
const managedKey = {
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
}

function mockManagedKeys() {
  return vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/2/tokens') {
      return {
        data: { success: true, data: { items: [managedKey], total: 1 } },
      }
    }
    if (url === '/api/user/2/groups') {
      return { data: { success: true, data: groupsOfManagedUser } }
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
    throw new Error(`Unexpected GET ${url}`)
  })
}

function renderKeysDialog() {
  renderInProvider(
    <UserApiKeysDialog
      open
      onOpenChange={() => undefined}
      user={{ id: 2, username: 'managed-user' }}
    />
  )
}

it('shows keys masked and offers no way to read a full key', async () => {
  const get = mockManagedKeys()
  renderKeysDialog()

  expect(await screen.findByText('sk-abc***xyz')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'View full key' })
  ).not.toBeInTheDocument()
  expect(get).not.toHaveBeenCalledWith(
    '/api/user/2/tokens/5/key',
    expect.anything()
  )
})

it('moves a key to another group the user can use', async () => {
  mockManagedKeys()
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  renderKeysDialog()

  const groupPicker = await screen.findByRole('combobox', {
    name: 'Change group for ci',
  })
  await waitFor(() => expect(groupPicker).toBeEnabled())
  await userEvent.click(groupPicker)
  // Only groups the owner can use are offered.
  expect(screen.queryByRole('option', { name: /partner/ })).toBeNull()
  await userEvent.click(await screen.findByRole('option', { name: /vip/ }))

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/user/2/tokens/5/group', {
      group: 'vip',
    })
  )
  expect(
    screen.queryByLabelText('Authenticator code or backup code')
  ).toBeNull()
})

it('deletes a key only with a proof bound to that user and action', async () => {
  mockManagedKeys()
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue(mockVerification('admin.user.manage', 'key-proof'))
  const del = vi
    .spyOn(api, 'delete')
    .mockResolvedValue({ data: { success: true } })
  renderKeysDialog()

  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
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
  mockManagedKeys()
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true } })

  renderKeysDialog()

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
