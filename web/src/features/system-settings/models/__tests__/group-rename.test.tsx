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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, assert, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { GroupRatioVisualEditor } from '../group-ratio-visual-editor'

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }))

afterEach(() => {
  vi.mocked(api.post).mockReset()
})

type FixtureProps = {
  renameDisabled?: boolean
  onGroupsRenamed?: () => Promise<void>
}

function RenameFixture(props: FixtureProps) {
  const [settings, setSettings] = useState<Record<string, string>>({
    GroupRatio: '{"default":1,"vip":2}',
    TopupGroupRatio: '{}',
    UserUsableGroups: '{}',
    GroupOrder: '["default","vip"]',
    GroupVendors: '{}',
  })
  return (
    <GroupRatioVisualEditor
      section='pricing'
      onSectionChange={() => {}}
      defaultUseAutoGroupField={null}
      groupRatio={settings.GroupRatio}
      groupOrder={settings.GroupOrder}
      groupVendors={settings.GroupVendors}
      vendors={[]}
      topupGroupRatio={settings.TopupGroupRatio}
      userUsableGroups={settings.UserUsableGroups}
      groupGroupRatio='{}'
      autoGroups='[]'
      maxTokenAutoGroupsField={null}
      groupSpecialUsableGroup='{}'
      groupIds={{ default: 1, vip: 2 }}
      renameDisabled={props.renameDisabled}
      onGroupsRenamed={props.onGroupsRenamed ?? (async () => {})}
      onChange={(field, value) =>
        setSettings((current) => ({ ...current, [field]: value }))
      }
    />
  )
}

function getGroupRow(name: string) {
  const row = screen.getByDisplayValue(name).closest('tr')
  assert(row)
  return row
}

test('registered groups are renamed through the rename action, new groups inline', async () => {
  const user = userEvent.setup()
  render(<RenameFixture />)

  const vipRow = getGroupRow('vip')
  expect(
    within(vipRow).getByRole('textbox', { name: 'Group name' })
  ).toHaveAttribute('readonly')
  expect(within(vipRow).getByRole('button', { name: 'Rename' })).toBeEnabled()
  expect(
    within(getGroupRow('default')).queryByRole('button', { name: 'Rename' })
  ).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Add group' }))
  const newRow = getGroupRow('group_1')
  const newName = within(newRow).getByRole('textbox', { name: 'Group name' })
  expect(newName).not.toHaveAttribute('readonly')
  expect(within(newRow).queryByRole('button', { name: 'Rename' })).toBeNull()
})

test('rename action is disabled while group settings have unsaved changes', () => {
  render(<RenameFixture renameDisabled />)

  expect(
    within(getGroupRow('vip')).getByRole('button', { name: 'Rename' })
  ).toBeDisabled()
})

test('rename dialog rejects a name in use and submits a valid name by group id', async () => {
  const user = userEvent.setup()
  const onGroupsRenamed = vi.fn(async () => {})
  vi.mocked(api.post).mockResolvedValue({
    data: { success: true, message: '', data: { vip: 'vip-pro' } },
  })
  render(<RenameFixture onGroupsRenamed={onGroupsRenamed} />)

  await user.click(
    within(getGroupRow('vip')).getByRole('button', { name: 'Rename' })
  )
  const dialog = await screen.findByRole('dialog')
  const input = within(dialog).getByRole('textbox', { name: 'New group name' })
  await user.clear(input)
  await user.type(input, 'default')
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(within(dialog).getByRole('button', { name: 'Rename' })).toBeDisabled()

  await user.clear(input)
  await user.type(input, 'vip-pro')
  await user.click(within(dialog).getByRole('button', { name: 'Rename' }))

  expect(api.post).toHaveBeenCalledWith('/api/option/groups/rename', {
    renames: [{ id: 2, name: 'vip-pro' }],
  })
  expect(onGroupsRenamed).toHaveBeenCalledTimes(1)
})
