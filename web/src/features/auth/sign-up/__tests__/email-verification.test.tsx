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
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { STATUS_QUERY_KEY } from '@/lib/status-query'

import { SignUpForm } from '../components/sign-up-form'

const widgets: Record<string, unknown>[] = []

beforeEach(() => {
  widgets.length = 0
  window.turnstile = {
    render: vi.fn((_element, options) => {
      widgets.push(options)
      return `widget-${widgets.length}`
    }),
    remove: vi.fn(),
  }
  vi.spyOn(toast, 'error').mockImplementation(() => '')
  vi.spyOn(toast, 'success').mockImplementation(() => '')
})

afterEach(() => {
  cleanup()
  delete window.turnstile
  localStorage.clear()
})

async function renderSignUp() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, {
    email_verification: true,
    turnstile_check: true,
    turnstile_site_key: 'site-key',
    oauth_register_enabled: false,
  })
  const router = createRouter({
    routeTree: createRootRoute({ component: SignUpForm }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  const user = userEvent.setup()
  await user.type(
    await screen.findByRole('textbox', {
      name: 'Email (required for verification)',
    }),
    'receiver@example.com'
  )
  act(() => (widgets[0].callback as (token: string) => void)('first-token'))
  return user
}

it.each(['business failure', 'gateway timeout'])(
  'requires a fresh Turnstile token after email delivery returns %s',
  async (failure) => {
    const request = vi.spyOn(api, 'get')
    if (failure === 'gateway timeout') {
      request.mockRejectedValueOnce(new Error('504 Gateway Timeout'))
    } else {
      request.mockResolvedValueOnce({
        data: { success: false, message: 'SMTP connection failed' },
      })
    }
    request.mockResolvedValue({ data: { success: true } })
    const user = await renderSignUp()

    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await waitFor(() => expect(widgets).toHaveLength(2))
    expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled()

    act(() => (widgets[1].callback as (token: string) => void)('retry-token'))
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    expect(request).toHaveBeenLastCalledWith('/api/verification', {
      params: { email: 'receiver@example.com', turnstile: 'retry-token' },
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Resend/ })).toBeDisabled()
    )
  }
)

it('disables email sending when the Turnstile token expires', async () => {
  await renderSignUp()
  expect(screen.getByRole('button', { name: 'Send code' })).toBeEnabled()

  act(() => (widgets[0]['expired-callback'] as () => void)())

  expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled()
})

it('requires a fresh Turnstile token after registration is rejected', async () => {
  const request = vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: false, message: 'Username is already in use' },
  })
  const user = await renderSignUp()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'new-user')
  await user.type(
    screen.getByLabelText('Password', { exact: true }),
    'password123'
  )
  await user.type(screen.getByLabelText('Confirm password'), 'password123')
  await user.type(screen.getByPlaceholderText('Verification code'), '123456')
  await user.click(screen.getByRole('checkbox'))

  await user.click(screen.getByRole('button', { name: 'Create account' }))

  await waitFor(() => expect(request).toHaveBeenCalledOnce())
  expect(request.mock.calls[0][2]).toEqual({
    params: { turnstile: 'first-token' },
  })
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  expect(widgets).toHaveLength(2)
  act(() => (widgets[1].callback as (token: string) => void)('next-token'))
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
})
