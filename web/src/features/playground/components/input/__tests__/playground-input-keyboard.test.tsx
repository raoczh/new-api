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
import i18next from 'i18next'
import { beforeAll, describe, expect, test, vi } from 'vitest'

import {
  DEFAULT_CONFIG,
  DEFAULT_PARAMETER_ENABLED,
} from '../../../constants'
import { PlaygroundInput } from '../playground-input'

// The selector has its own coverage; here it only needs to render without
// reaching for provider data so the keyboard behaviour stays isolated.
vi.mock('@/components/model-group-selector', () => ({
  ModelGroupSelector: () => <div data-testid='model-group-selector' />,
}))

const models = [{ label: 'gpt-test', value: 'gpt-test' }]
const groups = [{ label: 'default', value: 'default', ratio: 1 }]

function renderInput(onSubmit: (text: string, attachments?: string[]) => void) {
  return render(
    <PlaygroundInput
      config={{ ...DEFAULT_CONFIG, model: 'gpt-test', group: 'default' }}
      groups={groups}
      groupValue='default'
      models={models}
      modelValue='gpt-test'
      onConfigChange={() => undefined}
      onGroupChange={() => undefined}
      onModelChange={() => undefined}
      onParameterEnabledChange={() => undefined}
      onSubmit={onSubmit}
      parameterEnabled={DEFAULT_PARAMETER_ENABLED}
    />
  )
}

describe('PlaygroundInput keyboard', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      Ask anything: 'Ask anything',
      Attach: 'Attach',
      Parameters: 'Parameters',
      Send: 'Send',
      Stop: 'Stop',
    })
  })

  test('submits the message when Enter is pressed', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    renderInput(onSubmit)

    const textarea = screen.getByPlaceholderText('Ask anything')
    await user.type(textarea, 'Hello there')
    await user.keyboard('{Enter}')

    expect(onSubmit).toHaveBeenCalledWith('Hello there', [])
    expect(textarea).toHaveValue('')
  })

  test('inserts a newline instead of submitting on Shift+Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    renderInput(onSubmit)

    const textarea = screen.getByPlaceholderText('Ask anything')
    await user.type(textarea, 'First line')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await user.type(textarea, 'Second line')

    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('First line\nSecond line')
  })

  test('does not submit blank input on Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    renderInput(onSubmit)

    const textarea = screen.getByPlaceholderText('Ask anything')
    await user.type(textarea, '   ')
    await user.keyboard('{Enter}')

    expect(onSubmit).not.toHaveBeenCalled()
  })
})
