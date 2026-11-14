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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { channelSchema, type Channel } from '../../types'
import { ChannelsProvider, useChannels } from '../channels-provider'
import { ChannelTestDialog } from '../dialogs/channel-test-dialog'

function channelOfType(type: number): Channel {
  return channelSchema.parse({
    id: 7,
    name: 'Tested channel',
    type,
    key: '',
    status: 1,
    created_time: 1,
    test_time: 0,
    response_time: 0,
    balance_updated_time: 0,
    models: 'claude-sonnet',
    group: 'default',
  })
}

/** The dialog tests whichever channel the page picked last. */
function PickedChannel(props: { channel: Channel }) {
  const channels = useChannels()
  const setCurrentRow = channels.setCurrentRow
  useEffect(() => {
    setCurrentRow(props.channel)
  }, [props.channel, setCurrentRow])
  return <ChannelTestDialog open onOpenChange={() => undefined} />
}

function renderTestDialog(type: number) {
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/channel/test/7') {
      return { data: { success: true, message: '', time: 0.5 } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const channel = channelOfType(type)
  render(
    <QueryClientProvider client={client}>
      <ChannelsProvider>
        <PickedChannel channel={channel} />
      </ChannelsProvider>
    </QueryClientProvider>
  )
  return get
}

async function testFirstModel() {
  await userEvent.click(screen.getByRole('button', { name: 'Test Connection' }))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

test('simulating the Claude Code client on an Anthropic channel fixes the Anthropic endpoint and stream mode and tests with them', async () => {
  const get = renderTestDialog(14)

  const simulate = await screen.findByRole('switch', {
    name: 'Simulate Claude Code client',
  })
  const endpoint = screen.getByRole('combobox', { name: 'Endpoint Type' })
  const stream = screen.getByRole('switch', { name: 'Stream Mode' })
  expect(simulate).not.toBeChecked()
  expect(endpoint).toBeEnabled()
  expect(stream).not.toBeChecked()

  await userEvent.click(simulate)

  expect(simulate).toBeChecked()
  expect(endpoint).toHaveValue('Anthropic (/v1/messages)')
  expect(endpoint).toBeDisabled()
  expect(stream).toBeChecked()
  expect(stream).toHaveAttribute('aria-disabled', 'true')

  await testFirstModel()
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      '/api/channel/test/7',
      expect.objectContaining({
        params: {
          model: 'claude-sonnet',
          endpoint_type: 'anthropic',
          stream: true,
          claude_code: true,
        },
      })
    )
  )
})

test('turning the simulation off again returns the endpoint and stream choices and tests without it', async () => {
  const get = renderTestDialog(14)
  const simulate = await screen.findByRole('switch', {
    name: 'Simulate Claude Code client',
  })
  const endpoint = screen.getByRole('combobox', { name: 'Endpoint Type' })
  const stream = screen.getByRole('switch', { name: 'Stream Mode' })

  await userEvent.click(simulate)
  await userEvent.click(simulate)

  expect(endpoint).toHaveValue('Auto detect (default)')
  expect(endpoint).toBeEnabled()
  expect(stream).not.toBeChecked()
  expect(stream).not.toHaveAttribute('aria-disabled', 'true')

  await testFirstModel()
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      '/api/channel/test/7',
      expect.objectContaining({ params: { model: 'claude-sonnet' } })
    )
  )
})

test('a channel of another provider offers no Claude Code simulation', async () => {
  renderTestDialog(1)

  expect(
    await screen.findByRole('combobox', { name: 'Endpoint Type' })
  ).toBeEnabled()
  expect(
    screen.queryByRole('switch', { name: 'Simulate Claude Code client' })
  ).not.toBeInTheDocument()
})
