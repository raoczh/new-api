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

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../../../constants'
import { PlaygroundInput } from '../playground-input'

vi.mock('@/components/model-group-selector', () => ({
  ModelGroupSelector: () => <div data-testid='model-group-selector' />,
}))

const NO_CHAT_MODELS_MESSAGE =
  'This group has no chat-capable models. Choose another group to start chatting.'

const groups = [{ label: 'default', value: 'default', ratio: 1 }]

function renderInput(options: {
  hasNoChatModels?: boolean
  models?: string[]
}) {
  const models = (options.models ?? []).map((model) => ({
    label: model,
    value: model,
  }))

  return render(
    <PlaygroundInput
      config={{
        ...DEFAULT_CONFIG,
        model: models[0]?.value ?? '',
        group: 'default',
      }}
      groups={groups}
      groupValue='default'
      hasNoChatModels={options.hasNoChatModels}
      models={models}
      modelValue={models[0]?.value ?? ''}
      onConfigChange={() => undefined}
      onGroupChange={() => undefined}
      onModelChange={() => undefined}
      onParameterEnabledChange={() => undefined}
      onSubmit={() => undefined}
      parameterEnabled={DEFAULT_PARAMETER_ENABLED}
    />
  )
}

describe('PlaygroundInput empty group state', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      'Ask anything': 'Ask anything',
      Attach: 'Attach',
      Parameters: 'Parameters',
      Send: 'Send',
      Stop: 'Stop',
      [NO_CHAT_MODELS_MESSAGE]: NO_CHAT_MODELS_MESSAGE,
    })
  })

  test('explains why the group cannot start a chat and keeps sending disabled', async () => {
    const user = userEvent.setup()

    renderInput({ hasNoChatModels: true })

    expect(screen.getByRole('alert')).toHaveTextContent(NO_CHAT_MODELS_MESSAGE)

    await user.type(screen.getByPlaceholderText('Ask anything'), 'Hello')
    // 移动端与桌面端各渲染一个发送按钮，两者都必须保持禁用。
    for (const send of screen.getAllByRole('button', { name: /Send/ })) {
      expect(send).toBeDisabled()
    }
  })

  test('shows no warning while the group has chat-capable models', async () => {
    const user = userEvent.setup()

    renderInput({ hasNoChatModels: false, models: ['gpt-5'] })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Ask anything'), 'Hello')
    for (const send of screen.getAllByRole('button', { name: /Send/ })) {
      expect(send).toBeEnabled()
    }
  })
})
