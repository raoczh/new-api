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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { ModelTypeSettingsCard } from '../model-type-settings-card'

function Fixture(props: { defaultValue: string }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <ModelTypeSettingsCard defaultValue={props.defaultValue} />
      </SettingsPageProvider>
    </>
  )
}

function renderSettings(defaultValue: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <Fixture defaultValue={defaultValue} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
})

test('existing rules render one row per model pattern', async () => {
  renderSettings('{"*-image":"image","veo-3":"video"}')

  const patterns = screen.getAllByRole('textbox', {
    name: 'Model name or wildcard',
  })
  expect(patterns).toHaveLength(2)
  expect(patterns[0]).toHaveValue('*-image')
  expect(patterns[1]).toHaveValue('veo-3')
  expect(
    screen.getAllByRole('combobox', { name: 'Model type' })[0]
  ).toHaveTextContent('Image')
})

test('saving sends the whole table as one JSON object', async () => {
  const user = userEvent.setup()
  renderSettings('{"*-image":"image"}')

  await user.click(screen.getByRole('button', { name: 'Add model type' }))
  const patterns = screen.getAllByRole('textbox', {
    name: 'Model name or wildcard',
  })
  expect(patterns).toHaveLength(2)
  await user.type(patterns[1], 'veo-3')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  const [path, payload] = vi.mocked(api.put).mock.calls[0]
  expect(path).toBe('/api/option/')
  expect(payload).toEqual({
    key: 'global.model_types',
    value: expect.any(String),
  })
  expect(JSON.parse((payload as { value: string }).value)).toEqual({
    '*-image': 'image',
    'veo-3': 'image',
  })
})

test('a deleted rule is absent from the saved table', async () => {
  const user = userEvent.setup()
  renderSettings('{"*-image":"image","veo-3":"video"}')

  await user.click(
    screen.getAllByRole('button', { name: 'Delete model type rule' })[1]
  )
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  const [, payload] = vi.mocked(api.put).mock.calls[0]
  expect(JSON.parse((payload as { value: string }).value)).toEqual({
    '*-image': 'image',
  })
})
