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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import {
  ModelGroupSelector,
  type ModelOption,
} from '../../model-group-selector'

const longGroupName = 'claude-enterprise-dedicated-low-latency-line'

const models: ModelOption[] = [{ label: 'gpt-4o', value: 'gpt-4o' }]

const groups = [
  { label: 'default', value: 'default', ratio: 1 },
  {
    label: longGroupName,
    value: longGroupName,
    ratio: 1.5,
    desc: 'Dedicated line for enterprise customers',
  },
]

/** The tooltip popup carries no role of its own, so it is found by its slot. */
async function findTooltip(): Promise<HTMLElement> {
  return waitFor(() => {
    const tooltip = document.querySelector<HTMLElement>(
      '[data-slot="tooltip-content"]'
    )
    if (!tooltip) {
      throw new Error('tooltip is not open')
    }
    return tooltip
  })
}

function renderSelector() {
  return render(
    <ModelGroupSelector
      groups={groups}
      models={models}
      onGroupChange={() => undefined}
      onModelChange={() => undefined}
      selectedGroup='default'
      selectedModel='gpt-4o'
    />
  )
}

describe('model group selector group tooltip', () => {
  test('hovering a group shows its full name, description and ratio', async () => {
    const user = userEvent.setup()
    renderSelector()
    await user.click(screen.getByRole('combobox', { name: 'Select model' }))

    // The column truncates the name, so the tooltip is the only place where a
    // long name and the group description can be read in full.
    expect(
      screen.queryByText(/Dedicated line for enterprise customers/)
    ).not.toBeInTheDocument()

    await user.hover(screen.getByRole('button', { name: longGroupName }))

    const tooltip = await findTooltip()
    expect(within(tooltip).getByText(longGroupName)).toBeVisible()
    expect(
      within(tooltip).getByText(
        'Dedicated line for enterprise customers · Ratio: 1.5'
      )
    ).toBeVisible()
  })

  test('a group without a description still shows its ratio on hover', async () => {
    const user = userEvent.setup()
    renderSelector()
    await user.click(screen.getByRole('combobox', { name: 'Select model' }))

    await user.hover(screen.getByRole('button', { name: 'default' }))

    const tooltip = await findTooltip()
    expect(within(tooltip).getByText('Ratio: 1')).toBeVisible()
  })
})
