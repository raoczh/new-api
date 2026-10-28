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
import { describe, expect, test } from 'vitest'

import {
  ModelGroupSelector,
  type ModelOption,
} from '../../model-group-selector'

interface GroupOption {
  label: string
  value: string
  ratio?: number
}

/**
 * The selector is controlled: a group click must both narrow the model list and
 * reach the parent, so the harness keeps the selection in state like the real
 * pages do.
 */
function Harness({
  models,
  groups,
  openGroupFilter,
}: {
  models: ModelOption[]
  groups: GroupOption[]
  openGroupFilter?: string
}) {
  const [group, setGroup] = useState(groups[0].value)
  const [model, setModel] = useState(models[0].value)

  return (
    <ModelGroupSelector
      groups={groups}
      models={models}
      onGroupChange={setGroup}
      onModelChange={setModel}
      openGroupFilter={openGroupFilter}
      selectedGroup={group}
      selectedModel={model}
    />
  )
}

async function openPanel() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Select model' }))
  return user
}

/** The group column buttons are the only ones whose text is exactly the label. */
function groupButton(label: string): HTMLElement {
  const match = screen
    .getAllByRole('button')
    .find((button) => button.textContent?.trim() === label)
  if (!match) {
    throw new Error(`group button ${label} not found`)
  }
  return match
}

const groups: GroupOption[] = [
  { label: 'default', value: 'default', ratio: 1 },
  { label: 'vip', value: 'vip', ratio: 2 },
]

describe('model group selector group filtering', () => {
  test('clicking a group narrows the model list to that group and keeps the unfiltered list on open', async () => {
    const models: ModelOption[] = [
      {
        label: 'gpt-image-1',
        value: 'default\u0000gpt-image-1',
        category: 'default',
      },
      { label: 'nano-banana', value: 'vip\u0000nano-banana', category: 'vip' },
    ]
    render(<Harness groups={groups} models={models} />)

    const user = await openPanel()
    const list = within(screen.getByRole('listbox'))

    // Default view keeps every group's models.
    expect(list.getByText('gpt-image-1')).toBeInTheDocument()
    expect(list.getByText('nano-banana')).toBeInTheDocument()

    await user.click(groupButton('vip'))

    expect(list.queryByText('gpt-image-1')).not.toBeInTheDocument()
    expect(list.getByText('nano-banana')).toBeInTheDocument()

    // Reopening starts from the unfiltered list again, so a model from another
    // group stays reachable without reloading the page.
    await user.click(screen.getByRole('combobox', { name: 'Select model' }))
    await user.click(screen.getByRole('combobox', { name: 'Select model' }))
    const reopened = within(screen.getByRole('listbox'))
    expect(reopened.getByText('gpt-image-1')).toBeInTheDocument()
    expect(reopened.getByText('nano-banana')).toBeInTheDocument()
  })

  test('models without a group keep listing every model after a group click', async () => {
    // The chat playground sends plain options with no category and switches the
    // model independently of the group, so filtering there would hide valid rows.
    const models: ModelOption[] = [
      { label: 'gpt-4o', value: 'gpt-4o' },
      { label: 'claude-sonnet', value: 'claude-sonnet' },
    ]
    render(<Harness groups={groups} models={models} />)

    const user = await openPanel()
    await user.click(groupButton('vip'))

    const list = within(screen.getByRole('listbox'))
    expect(list.getByText('gpt-4o')).toBeInTheDocument()
    expect(list.getByText('claude-sonnet')).toBeInTheDocument()
  })

  test('opens on the group the caller pins instead of every group', async () => {
    // The image studio only generates with the selected group's models, so
    // opening on every group would bury the models it can actually use.
    const models: ModelOption[] = [
      {
        label: 'gpt-image-1',
        value: 'default\u0000gpt-image-1',
        category: 'default',
      },
      { label: 'nano-banana', value: 'vip\u0000nano-banana', category: 'vip' },
    ]
    render(
      <Harness groups={groups} models={models} openGroupFilter='default' />
    )

    const user = await openPanel()
    const list = within(screen.getByRole('listbox'))

    expect(list.getByText('gpt-image-1')).toBeInTheDocument()
    expect(list.queryByText('nano-banana')).not.toBeInTheDocument()

    // Closing and reopening keeps the pinned view, because the caller's default
    // is still the selected group.
    await user.click(screen.getByRole('combobox', { name: 'Select model' }))
    await user.click(screen.getByRole('combobox', { name: 'Select model' }))
    const reopened = within(screen.getByRole('listbox'))
    expect(reopened.getByText('gpt-image-1')).toBeInTheDocument()
    expect(reopened.queryByText('nano-banana')).not.toBeInTheDocument()
  })
})
