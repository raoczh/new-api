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
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { HourlyStatusBar } from '../components/hourly-status-bar'
import { VendorSection } from '../components/vendor-section'
import { useGroupStatus } from '../hooks/use-group-status'
import type { GroupStatus } from '../types'

const start = 1789387200
const group: GroupStatus = {
  group: 'default',
  description: 'Public group',
  vendor_id: 1,
  group_ratio: 0.35,
  summary: null,
  last_seen_ts: 0,
  hourly: [],
  models: [],
}

afterEach(() => {
  useAuthStore.getState().auth.reset()
})

it('drops private group data immediately when the viewer changes to an anonymous visitor', async () => {
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'member', role: 1, group: 'vip' })
  vi.spyOn(api, 'get').mockImplementation(async () => ({
    data: {
      success: true,
      data: {
        groups: [
          {
            ...group,
            group: useAuthStore.getState().auth.user ? 'vip' : 'default',
          },
        ],
        vendors: [],
        window_start: start,
        window_end: start + 86400,
        hourly_start: start,
      },
    },
  }))
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const hook = renderHook(() => useGroupStatus(24), {
    wrapper: (props) => (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    ),
  })
  try {
    await waitFor(() =>
      expect(hook.result.current.data?.data.groups[0].group).toBe('vip')
    )
    act(() => useAuthStore.getState().auth.reset())
    expect(hook.result.current.data?.data.groups[0].group).not.toBe('vip')
    await waitFor(() =>
      expect(hook.result.current.data?.data.groups[0].group).toBe('default')
    )
  } finally {
    hook.unmount()
    client.clear()
  }
})

describe('group monitor cards', () => {
  it('uses spacious cards with at most three desktop columns and preserves pending states', () => {
    render(
      <VendorSection
        section={{
          vendorId: 1,
          vendor: { id: 1, name: 'OpenAI' },
          groups: [group],
        }}
        hourlyStart={start}
        windowLabel='Last 24 hours'
        onOpenDetails={vi.fn()}
      />
    )
    const card = screen.getByRole('article')
    expect(card).toHaveClass('min-h-72', 'min-w-0')
    expect(card.parentElement).toHaveClass(
      'grid-cols-1',
      'md:grid-cols-2',
      'xl:grid-cols-3'
    )
    expect(card.parentElement).not.toHaveClass('2xl:grid-cols-6')
    expect(screen.getByText('Awaiting observation')).toBeVisible()
    expect(screen.getByText('0.35x')).toBeVisible()
    expect(screen.queryByText('100.00%')).not.toBeInTheDocument()
  })

  it('opens model details by keyboard and keeps long group names contained', async () => {
    const user = userEvent.setup()
    const onOpenDetails = vi.fn()
    const longGroup = {
      ...group,
      description:
        'A public group with a long descriptive title that must stay inside its card',
    }
    render(
      <VendorSection
        section={{
          vendorId: 1,
          vendor: { id: 1, name: 'OpenAI' },
          groups: [longGroup],
        }}
        hourlyStart={start}
        windowLabel='Last 24 hours'
        onOpenDetails={onOpenDetails}
      />
    )
    expect(screen.getByRole('heading', { level: 3 })).toHaveClass('truncate')
    screen.getByRole('button', { name: 'Show model breakdown' }).focus()
    await user.keyboard('{Enter}')
    expect(onOpenDetails).toHaveBeenCalledWith(longGroup)
  })

  it('shows a model and accurate availability after receiving observations', () => {
    const observed = {
      ...group,
      hourly: [
        {
          ts: start + 23 * 3600,
          success_rate: 100,
          avg_ttft_ms: 300,
          avg_latency_ms: 1200,
          top_model: 'gpt-test',
          source: 'auto_probe' as const,
          sample_count: 1,
        },
      ],
      summary: {
        success_rate: 100,
        avg_ttft_ms: 300,
        avg_latency_ms: 1200,
        avg_tps: 0,
      },
    }
    render(
      <VendorSection
        section={{
          vendorId: 1,
          vendor: { id: 1, name: 'OpenAI' },
          groups: [observed],
        }}
        hourlyStart={start}
        windowLabel='Last 24 hours'
        onOpenDetails={vi.fn()}
      />
    )
    expect(screen.getByText('Operational')).toBeVisible()
    expect(screen.getByText('gpt-test')).toBeVisible()
    expect(screen.getByText('100.00%')).toBeVisible()
    expect(screen.getByText('0.30s')).toBeVisible()
  })

  it.each([
    ['auto_probe', 'Automatic probe'],
    ['manual_test', 'Manual test'],
    ['request', 'Request observation'],
    ['mixed_tests', 'Automatic and manual tests'],
  ] as const)(
    'shows %s as the source when focusing its hourly sample',
    async (source, label) => {
      const user = userEvent.setup()
      render(
        <HourlyStatusBar
          group={{
            ...group,
            hourly: [
              {
                ts: start,
                success_rate: 100,
                avg_ttft_ms: 100,
                top_model: 'gpt-test',
                source,
                sample_count: 1,
              },
            ],
          }}
          hourlyStart={start}
        />
      )
      const timeline = screen.getByRole('group')
      expect(timeline.children).toHaveLength(24)
      expect(timeline.children[0]).toHaveAttribute('data-source', source)
      expect(timeline.children[1]).toHaveAttribute('data-health', 'pending')
      await user.tab()
      expect(await screen.findByRole('tooltip')).toHaveTextContent(label)
      expect(screen.getByRole('tooltip')).toHaveTextContent('gpt-test')
    }
  )
})
