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
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import type { UsageLog } from '../../data/schema'
import type { LogOtherData } from '../../types'
import { DetailsDialog } from '../dialogs/details-dialog'

const queryClients: QueryClient[] = []

function makeLog(other: LogOtherData): UsageLog {
  return {
    id: 1,
    user_id: 1,
    created_at: 1,
    type: 2,
    content: '',
    username: 'user',
    token_name: 'token',
    model_name: 'alias-model',
    quota: 0,
    prompt_tokens: 10,
    completion_tokens: 10,
    use_time: 1,
    is_stream: false,
    channel: 1,
    channel_name: 'channel',
    token_id: 1,
    group: 'default',
    ip: '',
    other: JSON.stringify(other),
    request_id: 'req-1',
    upstream_request_id: '',
  }
}

function renderDetails(other: LogOtherData, isAdmin: boolean): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(['status'], {}, { updatedAt: Date.now() + 60_000 })
  queryClients.push(queryClient)

  render(
    <QueryClientProvider client={queryClient}>
      <DetailsDialog
        log={makeLog(other)}
        isAdmin={isAdmin}
        isRoot={false}
        open
        onOpenChange={() => undefined}
      />
    </QueryClientProvider>
  )
}

const mapped: LogOtherData = {
  is_model_mapped: true,
  upstream_model_name: 'upstream-secret-model',
}

const mappedWithResponse: LogOtherData = {
  ...mapped,
  response_model: {
    requested_model: 'alias-model',
    upstream_model: 'upstream-secret-model',
    returned_model: 'upstream-secret-model',
  },
}

afterEach(() => {
  for (const queryClient of queryClients) {
    queryClient.clear()
  }
  queryClients.length = 0
})

describe('usage log model mapping visibility', () => {
  test('shows the model mapping section to admins', () => {
    renderDetails(mapped, true)

    expect(screen.getByText('Model Mapping')).toBeInTheDocument()
    expect(screen.getByText('upstream-secret-model')).toBeInTheDocument()
  })

  test('hides the model mapping section from non-admin users', () => {
    renderDetails(mapped, false)

    expect(screen.queryByText('Model Mapping')).toBeNull()
    expect(screen.queryByText('upstream-secret-model')).toBeNull()
  })

  test('hides a mapped response model observation from non-admin users', () => {
    renderDetails(mappedWithResponse, false)

    expect(screen.queryByText('Response Model')).toBeNull()
    expect(screen.queryByText('upstream-secret-model')).toBeNull()
  })

  test('shows a mapped response model observation to admins', () => {
    renderDetails(mappedWithResponse, true)

    expect(screen.getAllByText('upstream-secret-model').length).toBeGreaterThan(
      0
    )
  })
})
