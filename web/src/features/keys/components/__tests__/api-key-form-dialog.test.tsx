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

import type { ApiKey } from '../../types'
import { ApiKeyFormDialog } from '../api-key-form-dialog'
import { ApiKeysDialogs } from '../api-keys-dialogs'
import { ApiKeysProvider, useApiKeys } from '../api-keys-provider'

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = { get: ApiMethod; post: ApiMethod; put: ApiMethod }

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPost = apiClient.post
const originalPut = apiClient.put
let queryClient: QueryClient | null = null

type Fixture = {
  groups?: Record<
    string,
    { desc: string; ratio: number | string; vendor_id?: number }
  >
  autoGroups?: string[]
  failGroups?: boolean
  /** Keys the server holds, returned when one is opened for editing. */
  storedKeys?: ApiKey[]
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
      default: {
        const stored = fixture.storedKeys?.find(
          (item) => url === `/api/token/${item.id}`
        )
        if (stored) return { data: { success: true, data: stored } }
        throw new Error(`Unexpected GET ${url}`)
      }
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
        <ApiKeyFormDialog
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
  apiClient.put = originalPut
  queryClient?.clear()
  queryClient = null
})

describe('creating an API key by model vendor', () => {
  test('starts on the first vendor with its lines in the administrator order and a matching name', async () => {
    const { created } = renderDialog()

    const anthropic = await screen.findByRole('radio', { name: /Anthropic/ })
    expect(anthropic).toBeChecked()
    expect(screen.getByText('Great for long writing')).toBeVisible()
    // The lines are editable from the start, with no mode to switch first.
    expect(screen.queryByRole('button', { name: 'Custom' })).toBeNull()
    const lines = within(screen.getByRole('list'))
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('claude-fast')
    // Each chosen line shows what it costs.
    expect(lines[0]).toContain('2x')
    expect(lines[1]).toContain('claude-stable')
    expect(lines[1]).toContain('1x')
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

  test('a chosen line stays in the list with a tick and is cleared by picking it again', async () => {
    const { created } = renderDialog()

    await screen.findByRole('radio', { name: /Anthropic/ })
    fireEvent.click(screen.getByRole('combobox'))
    const fast = await screen.findByRole('option', { name: /claude-fast/ })
    expect(fast).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(fast)
    // The list stays open, the line is still offered, now without its tick.
    expect(screen.getByRole('option', { name: /claude-fast/ })).toHaveAttribute(
      'aria-checked',
      'false'
    )
    expect(
      screen.queryByRole('button', { name: 'Remove claude-fast' })
    ).toBeNull()

    fireEvent.click(screen.getByRole('option', { name: /claude-fast/ }))
    expect(screen.getByRole('option', { name: /claude-fast/ })).toHaveAttribute(
      'aria-checked',
      'true'
    )

    fireEvent.click(createButton())
    await waitFor(() => expect(created).toHaveLength(1))
    // A line ticked again goes to the end of the order.
    expect(created[0]).toMatchObject({
      group: 'auto',
      auto_groups: ['claude-stable', 'claude-fast'],
    })
  })

  test('changing the order is saved in the new order', async () => {
    const { created } = renderDialog()

    await screen.findByRole('radio', { name: /Anthropic/ })
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

  test('refuses to create a key once every line is removed', async () => {
    const { created } = renderDialog()

    fireEvent.click(await screen.findByRole('radio', { name: /OpenAI/ }))
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

const storedKey: ApiKey = {
  id: 9,
  name: 'writing',
  key: 'demo********9',
  status: 1,
  remain_quota: 500000,
  used_quota: 0,
  unlimited_quota: false,
  expired_time: 2000000000,
  created_time: 1,
  accessed_time: 0,
  group: 'auto',
  auto_groups: ['claude-stable', 'claude-fast'],
  cross_group_retry: true,
  model_limits_enabled: false,
  model_limits: '',
  allow_ips: '',
  allow_user_quota_query: true,
}

function renderEditDialog(stored: ApiKey, fixture: Fixture = {}) {
  const saved: Record<string, unknown>[] = []
  const closed: boolean[] = []
  installApi({ ...fixture, storedKeys: [stored] }, [])
  apiClient.put = async (url, data) => {
    expect(url).toBe('/api/token/')
    saved.push(data as Record<string, unknown>)
    return { data: { success: true } }
  }
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ApiKeysProvider>
        <ApiKeyFormDialog
          open
          apiKey={stored}
          onOpenChange={(open) => {
            if (!open) closed.push(true)
          }}
        />
      </ApiKeysProvider>
    </QueryClientProvider>
  )
  return { saved, closed }
}

const saveButton = () => screen.getByRole('button', { name: 'Save changes' })
const lineNames = () =>
  within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((item) => item.textContent)

describe('editing an API key in the same dialog', () => {
  test('opens on the vendor, lines, name and limits the key was saved with', async () => {
    const { saved, closed } = renderEditDialog(storedKey)

    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.getByRole('dialog', { name: 'Update API Key' })).toBeVisible()
    expect(screen.getByRole('radio', { name: /Anthropic/ })).toBeChecked()
    expect(nameInput().value).toBe('writing')
    const lines = lineNames()
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('claude-stable')
    expect(lines[1]).toContain('claude-fast')
    // The lines picker shows what the key uses.
    fireEvent.click(screen.getByRole('combobox', { name: 'Choose lines' }))
    expect(
      await screen.findByRole('option', { name: /claude-stable/ })
    ).toHaveAttribute('aria-checked', 'true')
    // A key is edited one at a time.
    expect(screen.queryByLabelText('Quantity')).toBeNull()

    fireEvent.click(saveButton())
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toMatchObject({
      id: 9,
      name: 'writing',
      group: 'auto',
      auto_groups: ['claude-stable', 'claude-fast'],
      cross_group_retry: true,
      unlimited_quota: false,
      remain_quota: 500000,
      expired_time: 2000000000,
    })
    await waitFor(() => expect(closed).toEqual([true]))
  })

  test('saves the lines in the order they were changed to', async () => {
    const { saved } = renderEditDialog(storedKey)

    await waitFor(() => expect(saveButton()).toBeEnabled())
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove claude-stable' })
    )
    fireEvent.click(saveButton())

    await waitFor(() => expect(saved).toHaveLength(1))
    // One remaining line is stored as a plain group.
    expect(saved[0]).toMatchObject({
      id: 9,
      group: 'claude-fast',
      auto_groups: [],
      cross_group_retry: false,
    })
  })

  test('switching vendor replaces the lines with that vendor default', async () => {
    const { saved } = renderEditDialog(storedKey)

    await waitFor(() => expect(saveButton()).toBeEnabled())
    fireEvent.click(screen.getByRole('radio', { name: /OpenAI/ }))
    expect(lineNames()).toHaveLength(1)
    expect(lineNames()[0]).toContain('gpt-main')
    // The name of an existing key is never rewritten for the user.
    expect(nameInput().value).toBe('writing')

    fireEvent.click(saveButton())
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toMatchObject({ group: 'gpt-main', auto_groups: [] })
  })

  test('a key on the site-wide line order keeps following it when only its name changes', async () => {
    const { saved } = renderEditDialog({ ...storedKey, auto_groups: [] })

    await waitFor(() => expect(saveButton()).toBeEnabled())
    // The site-wide order is shown, including lines of other vendors.
    const lines = lineNames()
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('gpt-main')
    fireEvent.input(nameInput(), { target: { value: 'renamed' } })
    fireEvent.click(saveButton())

    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toMatchObject({
      name: 'renamed',
      group: 'auto',
      auto_groups: [],
      cross_group_retry: true,
    })
  })

  test('a key that follows the account group says so and is saved unchanged', async () => {
    const { saved } = renderEditDialog({
      ...storedKey,
      group: '',
      auto_groups: [],
      cross_group_retry: false,
    })

    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(
      screen.getByText(/This key follows the group of your account/)
    ).toBeVisible()
    fireEvent.click(saveButton())

    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toMatchObject({ group: '', auto_groups: [] })
  })

  test('cannot be saved once every line was cleared', async () => {
    const { saved } = renderEditDialog({
      ...storedKey,
      group: 'gpt-main',
      auto_groups: [],
      cross_group_retry: false,
    })

    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.getByRole('radio', { name: /OpenAI/ })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Remove gpt-main' }))

    expect(saveButton()).toBeDisabled()
    expect(
      screen.getByText('No line is chosen. Tick at least one line above.')
    ).toBeVisible()
    expect(saved).toHaveLength(0)
  })
})

describe('limits of a key', () => {
  test.each(['Never', 'Clear'])(
    'a new key does not expire once its date is cleared with %s',
    async (action) => {
      const { created } = renderDialog()

      await screen.findByRole('radio', { name: /Anthropic/ })
      fireEvent.click(screen.getByRole('button', { name: 'More options' }))
      fireEvent.click(await screen.findByRole('button', { name: '1 Month' }))
      expect(screen.getByLabelText('Time')).toBeEnabled()
      fireEvent.click(screen.getByRole('button', { name: action }))
      expect(
        screen.getByRole('button', { name: 'Never expires' })
      ).toBeVisible()
      expect(screen.getByLabelText('Time')).toBeDisabled()

      fireEvent.click(createButton())
      await waitFor(() => expect(created).toHaveLength(1))
      expect(created[0]?.expired_time).toBe(-1)
    }
  )

  test('a new key cannot read the account quota once that switch, which starts on, is turned off', async () => {
    const { created } = renderDialog()

    await screen.findByRole('radio', { name: /Anthropic/ })
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    const quotaQuery = await screen.findByRole('switch', {
      name: 'Allow querying user quota',
    })
    expect(quotaQuery).toBeChecked()
    fireEvent.click(quotaQuery)

    fireEvent.click(createButton())
    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]?.allow_user_quota_query).toBe(false)
  })

  test('a key whose saved lines are all gone is saved again once new lines are ticked', async () => {
    const { saved } = renderEditDialog({
      ...storedKey,
      auto_groups: ['retired-line'],
    })

    await waitFor(() =>
      expect(
        screen.getByText('No line is chosen. Tick at least one line above.')
      ).toBeVisible()
    )
    expect(saveButton()).toBeDisabled()
    fireEvent.click(screen.getByRole('combobox', { name: 'Choose lines' }))
    fireEvent.click(await screen.findByRole('option', { name: /claude-fast/ }))
    fireEvent.click(saveButton())

    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toMatchObject({ group: 'claude-fast', auto_groups: [] })
  })
})

function EditTargets(props: { keys: ApiKey[] }) {
  const { setCurrentRow, setOpen } = useApiKeys()
  return (
    <>
      {props.keys.map((item) => (
        <button
          key={item.id}
          type='button'
          onClick={() => {
            setCurrentRow(item)
            setOpen('update')
          }}
        >
          {`edit ${item.name}`}
        </button>
      ))}
    </>
  )
}

describe('editing one key after another', () => {
  test('a key without an expiry opens that way after a key that has one', async () => {
    const expiring = { ...storedKey, id: 1, name: 'expiring' }
    const lasting = { ...storedKey, id: 2, name: 'lasting', expired_time: -1 }
    const saved: Record<string, unknown>[] = []
    installApi({ storedKeys: [expiring, lasting] }, [])
    apiClient.put = async (_url, data) => {
      saved.push(data as Record<string, unknown>)
      return { data: { success: true } }
    }
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <ApiKeysProvider>
          <EditTargets keys={[expiring, lasting]} />
          <ApiKeysDialogs />
        </ApiKeysProvider>
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'edit expiring' }))
    await waitFor(() => expect(nameInput().value).toBe('expiring'))
    expect(screen.getByLabelText('Time')).toBeEnabled()
    fireEvent.click(saveButton())
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toMatchObject({ id: 1, expired_time: 2000000000 })
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: 'edit lasting' }))
    await waitFor(() => expect(nameInput().value).toBe('lasting'))
    expect(screen.getByRole('button', { name: 'Never expires' })).toBeVisible()
    expect(screen.getByLabelText('Time')).toBeDisabled()
    fireEvent.click(saveButton())
    await waitFor(() => expect(saved).toHaveLength(2))
    expect(saved[1]).toMatchObject({ id: 2, expired_time: -1 })
  })
})
