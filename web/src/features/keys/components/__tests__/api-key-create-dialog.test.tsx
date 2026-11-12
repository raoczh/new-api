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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import { api } from '@/lib/api'

import { ApiKeyCreateDialog } from '../api-key-create-dialog'
import { ApiKeysProvider, useApiKeys } from '../api-keys-provider'

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = { get: ApiMethod; post: ApiMethod }

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPost = apiClient.post
let queryClient: QueryClient | null = null

type Fixture = {
  groups?: Record<
    string,
    { desc: string; ratio: number | string; vendor_id?: number }
  >
  autoGroups?: string[]
  failGroups?: boolean
  createResults?: {
    success: boolean
    message?: string
    data?: { id: number }
  }[]
}

const defaultGroups = {
  auto: { desc: 'Automatic routing', ratio: 'auto' },
  'claude-fast': { desc: 'Fast line', ratio: 2, vendor_id: 7 },
  'claude-stable': { desc: 'Stable line', ratio: 1, vendor_id: 7 },
  'gpt-main': { desc: 'Main line', ratio: 1, vendor_id: 3 },
  default: { desc: 'General line', ratio: 1 },
}

function installApi(fixture: Fixture, created: Record<string, unknown>[]) {
  const results = [...(fixture.createResults ?? [])]
  apiClient.get = async (url) => {
    switch (url) {
      case '/api/user/self/groups':
        if (fixture.failGroups) throw new Error('network down')
        return {
          data: {
            success: true,
            data: fixture.groups ?? defaultGroups,
            vendors: [
              {
                id: 7,
                name: 'Anthropic',
                description: 'Great for long writing',
              },
              { id: 3, name: 'OpenAI', description: 'All-round assistant' },
            ],
            group_order: [
              'claude-stable',
              'claude-fast',
              'gpt-main',
              'default',
            ],
          },
        }
      case '/api/token/auto-groups':
        return {
          data: {
            success: true,
            data: {
              groups: fixture.autoGroups ?? [
                'claude-fast',
                'gpt-main',
                'claude-stable',
              ],
              max_count: 3,
            },
          },
        }
      case '/api/user/models':
        return { data: { success: true, data: [] } }
      default:
        throw new Error(`Unexpected GET ${url}`)
    }
  }
  apiClient.post = async (url, data) => {
    expect(url).toBe('/api/token/')
    created.push(data as Record<string, unknown>)
    return {
      data: results.shift() ?? { success: true, data: { id: created.length } },
    }
  }
}

function OpenState() {
  const { open, createdKeyId } = useApiKeys()
  return (
    <output data-testid='state'>{`${open ?? 'none'}:${createdKeyId ?? ''}`}</output>
  )
}

function renderDialog(fixture: Fixture = {}) {
  const created: Record<string, unknown>[] = []
  const closed: boolean[] = []
  installApi(fixture, created)
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ApiKeysProvider>
        <ApiKeyCreateDialog
          open
          onOpenChange={(open) => {
            if (!open) closed.push(true)
          }}
        />
        <OpenState />
      </ApiKeysProvider>
    </QueryClientProvider>
  )
  return { created, closed }
}

const nameInput = () => screen.getByLabelText<HTMLInputElement>('Name')
const createButton = () =>
  screen.getByRole('button', { name: 'Create API Key' })

afterEach(() => {
  apiClient.get = originalGet
  apiClient.post = originalPost
  queryClient?.clear()
  queryClient = null
})

describe('creating an API key by model vendor', () => {
  test('starts on the first vendor with its lines in the administrator order and a matching name', async () => {
    const { created } = renderDialog()

    const anthropic = await screen.findByRole('radio', { name: /Anthropic/ })
    expect(anthropic).toBeChecked()
    expect(screen.getByText('Great for long writing')).toBeVisible()
    const lines = within(screen.getByRole('list', { name: 'Line' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('claude-fast')
    expect(lines[0]).toContain('Used first')
    expect(lines[1]).toContain('claude-stable')
    expect(lines[1]).toContain('Backup')
    expect(nameInput().value).toBe('Anthropic-claude-fast')

    fireEvent.click(createButton())
    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]).toMatchObject({
      name: 'Anthropic-claude-fast',
      group: 'auto',
      auto_groups: ['claude-fast', 'claude-stable'],
      cross_group_retry: true,
      unlimited_quota: true,
      expired_time: -1,
    })
    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('created:1')
    )
  })

  test('switching vendor updates the lines and the suggested name, and a single line is stored as a plain group', async () => {
    const { created } = renderDialog()

    fireEvent.click(await screen.findByRole('radio', { name: /OpenAI/ }))
    expect(screen.getByText('All-round assistant')).toBeVisible()
    expect(nameInput().value).toBe('OpenAI-gpt-main')

    fireEvent.click(createButton())
    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]).toMatchObject({
      name: 'OpenAI-gpt-main',
      group: 'gpt-main',
      auto_groups: [],
      cross_group_retry: false,
    })
  })

  test('keeps a name the user typed when the vendor changes afterwards', async () => {
    renderDialog()

    await screen.findByRole('radio', { name: /Anthropic/ })
    fireEvent.input(nameInput(), { target: { value: 'My writing key' } })
    fireEvent.click(screen.getByRole('radio', { name: /OpenAI/ }))

    expect(nameInput().value).toBe('My writing key')
  })

  test('offers lines without a vendor under Other models', async () => {
    const { created } = renderDialog()

    fireEvent.click(await screen.findByRole('radio', { name: /Other models/ }))
    expect(nameInput().value).toBe('Other models-default')

    fireEvent.click(createButton())
    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]).toMatchObject({ group: 'default', auto_groups: [] })
  })

  test('changing the order switches to a custom route that is saved in the new order', async () => {
    const { created } = renderDialog()

    await screen.findByRole('radio', { name: /Anthropic/ })
    fireEvent.click(
      screen.getByRole('button', { name: 'Change the lines or their order' })
    )
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Move claude-stable up' })
    )
    expect(nameInput().value).toBe('Anthropic-claude-stable')

    fireEvent.click(createButton())
    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]).toMatchObject({
      group: 'auto',
      auto_groups: ['claude-stable', 'claude-fast'],
    })
  })

  test('refuses to create a key once every custom line is removed', async () => {
    const { created } = renderDialog()

    fireEvent.click(await screen.findByRole('radio', { name: /OpenAI/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove gpt-main' }))

    expect(createButton()).toBeDisabled()
    expect(created).toHaveLength(0)
  })

  test('creates several keys with distinct names and closes without the ready dialog', async () => {
    const { created, closed } = renderDialog()

    await screen.findByRole('radio', { name: /Anthropic/ })
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    fireEvent.change(await screen.findByLabelText('Quantity'), {
      target: { value: '3' },
    })
    fireEvent.click(createButton())

    await waitFor(() => expect(closed).toHaveLength(1))
    expect(created.map((payload) => payload.name)).toEqual([
      'Anthropic-claude-fast',
      expect.stringMatching(/^Anthropic-claude-fast-[a-z0-9]+$/),
      expect.stringMatching(/^Anthropic-claude-fast-[a-z0-9]+$/),
    ])
    expect(screen.getByTestId('state')).toHaveTextContent('none:')
  })

  test('stays open and keeps the form when the server refuses the key', async () => {
    const { created, closed } = renderDialog({
      createResults: [
        { success: false, message: 'Maximum number of tokens reached (3)' },
      ],
    })

    await screen.findByRole('radio', { name: /Anthropic/ })
    fireEvent.click(createButton())

    await waitFor(() => expect(created).toHaveLength(1))
    await waitFor(() => expect(createButton()).toBeEnabled())
    expect(closed).toHaveLength(0)
    expect(nameInput().value).toBe('Anthropic-claude-fast')
    expect(screen.getByTestId('state')).toHaveTextContent('none:')
  })
})

describe('create dialog without usable lines', () => {
  test('explains that no line is available and disables creation', async () => {
    renderDialog({
      groups: { auto: { desc: 'Automatic routing', ratio: 'auto' } },
    })

    expect(
      await screen.findByText(
        'No lines are available for your account yet. Please contact support.'
      )
    ).toBeVisible()
    expect(createButton()).toBeDisabled()
  })

  test('reports a loading failure instead of an empty form', async () => {
    renderDialog({ failGroups: true })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load the available lines. Close this window and try again.'
    )
    expect(createButton()).toBeDisabled()
  })
})
