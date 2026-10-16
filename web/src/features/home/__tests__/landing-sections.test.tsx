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
import { cleanup, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import { Faq } from '../components/sections/faq'
import { Stats } from '../components/sections/stats'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    to: string
    params?: { _splat?: string }
    children?: ReactNode
    className?: string
  }) =>
    createElement(
      'a',
      {
        href: props.params?._splat
          ? props.to.replace('$', props.params._splat)
          : props.to,
        className: props.className,
      },
      props.children
    ),
}))

vi.mock('@/features/pricing/api', () => ({
  getPricing: vi.fn(async () => ({
    success: true,
    data: [
      { model_name: 'gpt-4.1', vendor_id: 1 },
      { model_name: 'claude-opus-4', vendor_id: 2 },
      { model_name: 'gemini-2.5-pro', vendor_id: 2 },
    ],
    vendors: [
      { id: 1, name: 'OpenAI' },
      { id: 2, name: 'Other' },
      { id: 3, name: 'Unused' },
    ],
  })),
}))

function renderWithStatus(status: Record<string, unknown>, ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(['status'], status)
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

it('shows catalog counts when the model square is public', async () => {
  renderWithStatus({ system_name: 'New API' }, <Stats />)
  expect(await screen.findByText('Models available')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()
  // Only vendors that own at least one model are counted.
  expect(screen.getByText('2')).toBeInTheDocument()
})

it('falls back to protocol facts when the catalog requires sign-in', () => {
  renderWithStatus(
    {
      system_name: 'New API',
      HeaderNavModules: JSON.stringify({
        pricing: { enabled: true, requireAuth: true },
      }),
    },
    <Stats />
  )
  expect(screen.getByText('Native API protocols')).toBeInTheDocument()
  expect(screen.queryByText('Models available')).not.toBeInTheDocument()
})

it('prefers admin-configured FAQ entries over the built-in answers', () => {
  renderWithStatus(
    {
      faq_enabled: true,
      faq: [{ id: 7, question: 'Custom question?', answer: 'Custom answer.' }],
    },
    <Faq />
  )
  expect(
    screen.getByRole('button', { name: /Custom question\?/ })
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /Do I need to change my code\?/ })
  ).not.toBeInTheDocument()
})

it('shows the built-in FAQ when none is configured', () => {
  renderWithStatus({ faq_enabled: false }, <Faq />)
  expect(
    screen.getByRole('button', { name: /Do I need to change my code\?/ })
  ).toBeInTheDocument()
})
