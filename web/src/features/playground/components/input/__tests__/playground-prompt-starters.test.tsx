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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { PROMPT_STARTERS } from '../../../constants'
import { PlaygroundInput } from '../playground-input'

vi.mock('@/components/model-group-selector', () => ({
  ModelGroupSelector: () => <div data-testid='model-group-selector' />,
}))

function renderInput(
  options: {
    showPromptStarters?: boolean
    hasNoChatModels?: boolean
  } = {}
) {
  const models = [{ label: 'gpt-5', value: 'gpt-5' }]

  return render(
    <PlaygroundInput
      groups={[{ label: 'default', value: 'default', ratio: 1 }]}
      groupValue='default'
      hasNoChatModels={options.hasNoChatModels}
      models={models}
      modelValue='gpt-5'
      onGroupChange={() => undefined}
      onModelChange={() => undefined}
      onSubmit={() => undefined}
      showPromptStarters={options.showPromptStarters}
    />
  )
}

const starters = () => screen.queryByRole('group', { name: 'Example prompts' })

describe('playground prompt starters', () => {
  test('offers an example for each common task while the chat is empty', () => {
    renderInput({ showPromptStarters: true })

    expect(starters()).toBeVisible()
    for (const starter of PROMPT_STARTERS) {
      expect(
        screen.getByRole('button', { name: starter.label })
      ).toBeInTheDocument()
    }
  })

  test('writes the whole instruction into the composer so it can be edited', async () => {
    const user = userEvent.setup()
    renderInput({ showPromptStarters: true })

    await user.click(screen.getByRole('button', { name: 'Translate' }))

    expect(screen.getByPlaceholderText('Ask anything')).toHaveValue(
      PROMPT_STARTERS[2].prompt
    )
  })

  test('stays out of the way once the conversation has started', () => {
    renderInput({ showPromptStarters: false })

    expect(starters()).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Summarize a text' })
    ).not.toBeInTheDocument()
  })

  test('offers nothing to send when the group cannot chat', () => {
    renderInput({ showPromptStarters: true, hasNoChatModels: true })

    expect(starters()).not.toBeInTheDocument()
  })
})
