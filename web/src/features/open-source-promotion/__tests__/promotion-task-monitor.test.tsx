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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PromotionProvider } from '../components/promotion-provider'
import { PromotionTaskMonitor } from '../components/promotion-task-monitor'
import type { PromotionTaskStatusSnapshot } from '../types'

const { getPromotionTaskStatus } = vi.hoisted(() => ({
  getPromotionTaskStatus: vi.fn(),
}))

vi.mock('../api', () => ({ getPromotionTaskStatus }))

let client: QueryClient

beforeEach(() => {
  getPromotionTaskStatus.mockReset()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
})

afterEach(() => {
  client.clear()
})

function snapshot(overrides: Partial<PromotionTaskStatusSnapshot> = {}): {
  success: boolean
  data: PromotionTaskStatusSnapshot
} {
  return {
    success: true,
    data: { fetch: null, email: null, ...overrides },
  }
}

async function renderMonitor(data: ReturnType<typeof snapshot>) {
  getPromotionTaskStatus.mockResolvedValue(data)
  render(
    <QueryClientProvider client={client}>
      <PromotionProvider>
        <PromotionTaskMonitor />
      </PromotionProvider>
    </QueryClientProvider>
  )
  return screen.findByText('Author harvest')
}

describe('PromotionTaskMonitor', () => {
  it('shows the repository being harvested and the processed count', async () => {
    await renderMonitor(
      snapshot({
        fetch: {
          id: 1,
          task_id: 'systask_fetch',
          type: 'open_source_promotion_fetch',
          status: 'running',
          state: {
            total: 20,
            processed: 5,
            progress: 25,
            authors_seen: 12,
            current_repository: 'owner/example-project',
          },
          created_at: 1_789_387_200,
          updated_at: 1_789_387_260,
        },
      })
    )

    expect(screen.getByText('owner/example-project')).toBeInTheDocument()
    expect(screen.getByText('Processed 5/20')).toBeInTheDocument()
    expect(screen.getByText(/^Authors found/)).toHaveTextContent(
      'Authors found 12'
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '25'
    )
  })

  it('shows the last delivery result after the run finished', async () => {
    await renderMonitor(
      snapshot({
        email: {
          id: 2,
          task_id: 'systask_email',
          type: 'open_source_promotion_email',
          status: 'succeeded',
          result: { sent: 8, failed: 1, skipped: 2 },
          created_at: 1_789_387_200,
          updated_at: 1_789_387_260,
        },
      })
    )

    expect(screen.getByText(/^Sent/)).toHaveTextContent('Sent 8')
    expect(screen.getByText(/^Failed/)).toHaveTextContent('Failed 1')
    expect(screen.getByText(/^Skipped/)).toHaveTextContent('Skipped 2')
  })

  it('flags a harvest that stopped on the GitHub rate limit', async () => {
    await renderMonitor(
      snapshot({
        fetch: {
          id: 3,
          task_id: 'systask_limited',
          type: 'open_source_promotion_fetch',
          status: 'succeeded',
          result: {
            repositories: 4,
            authors_found: 9,
            inserted: 6,
            rate_limited: true,
          },
          created_at: 1_789_387_200,
          updated_at: 1_789_387_260,
        },
      })
    )

    expect(screen.getByText('Rate limited')).toBeInTheDocument()
    expect(screen.getByText(/^Repositories/)).toHaveTextContent(
      'Repositories 4'
    )
  })

  it('shows an idle badge and the pending-start hint for queued tasks', async () => {
    await renderMonitor(
      snapshot({
        fetch: {
          id: 4,
          task_id: 'systask_pending',
          type: 'open_source_promotion_fetch',
          status: 'pending',
          created_at: 1_789_387_200,
          updated_at: 1_789_387_200,
        },
      })
    )

    expect(screen.getByText('Waiting to start')).toBeInTheDocument()
    expect(screen.getByText('Idle')).toBeInTheDocument()
  })
})
