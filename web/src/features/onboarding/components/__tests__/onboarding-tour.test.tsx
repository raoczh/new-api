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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'

import { TOUR_TARGETS } from '../../lib/tour-steps'
import { hasDismissedTour, useOnboardingStore } from '../../store'
import { OnboardingTour } from '../onboarding-tour'

type ApiMethod = (url: string) => Promise<{ data: unknown }>
const apiClient = api as unknown as { get: ApiMethod }
const originalGet = apiClient.get
let queryClient: QueryClient | null = null
let keyProbes = 0
const originalGetClientRects = Element.prototype.getClientRects

const user = { id: 9, username: 'newcomer', role: 1 } as AuthUser

/** A page with the two controls the tour points at. */
function Page() {
  const [onKeysPage, setOnKeysPage] = useState(false)
  const [created, setCreated] = useState(false)
  return (
    <>
      <a
        href='#keys'
        data-tour={TOUR_TARGETS.keysNav}
        onClick={(event) => {
          event.preventDefault()
          setOnKeysPage(true)
        }}
      >
        API Keys
      </a>
      {onKeysPage && (
        <button
          type='button'
          data-tour={TOUR_TARGETS.createKey}
          onClick={() => setCreated(true)}
        >
          Create API Key
        </button>
      )}
      {created && <p>create dialog opened</p>}
      <a
        href='#playground'
        data-tour={TOUR_TARGETS.playgroundNav}
        onClick={(event) => event.preventDefault()}
      >
        AI Chat
      </a>
      <OnboardingTour />
    </>
  )
}

function renderTour(options: { keyTotal?: number; failProbe?: boolean } = {}) {
  apiClient.get = async (url) => {
    expect(url).toBe('/api/token/?p=1&size=1')
    keyProbes += 1
    if (options.failProbe) throw new Error('offline')
    return {
      data: {
        success: true,
        data: { items: [], total: options.keyTotal ?? 0 },
      },
    }
  }
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <Page />
    </QueryClientProvider>
  )
}

const tourDialog = () => screen.queryByRole('dialog')

beforeEach(() => {
  keyProbes = 0
  // jsdom reports no layout, so give the highlighted controls a box.
  Element.prototype.getClientRects = function getClientRects() {
    return [{ width: 80, height: 32 }] as unknown as DOMRectList
  }
  act(() => useAuthStore.getState().auth.setUser(user))
})

afterEach(() => {
  Element.prototype.getClientRects = originalGetClientRects
  apiClient.get = originalGet
  queryClient?.clear()
  queryClient = null
  localStorage.clear()
  act(() => {
    useOnboardingStore.setState({ step: null })
    useAuthStore.getState().auth.setUser(null)
  })
})

describe('when the tour opens by itself', () => {
  test('opens for a signed-in user who has no API key yet', async () => {
    renderTour({ keyTotal: 0 })

    expect(await screen.findByRole('dialog')).toHaveAccessibleName(
      'Welcome! Let us get you started'
    )
    expect(screen.getByText('Step 1 of 4')).toBeVisible()
  })

  test('stays closed for a user who already has an API key', async () => {
    renderTour({ keyTotal: 2 })

    await waitFor(() => expect(keyProbes).toBe(1))
    expect(tourDialog()).toBeNull()
  })

  test('stays closed after the user closed it once, without asking the server again', async () => {
    renderTour({ keyTotal: 0 })
    fireEvent.click(await screen.findByRole('button', { name: 'Close guide' }))
    expect(tourDialog()).toBeNull()
    expect(hasDismissedTour(user.id)).toBe(true)

    queryClient?.clear()
    renderTour({ keyTotal: 0 })
    expect(tourDialog()).toBeNull()
    expect(keyProbes).toBe(1)
  })

  test('stays closed when the key check fails', async () => {
    renderTour({ failProbe: true })

    await waitFor(() => expect(keyProbes).toBe(1))
    expect(tourDialog()).toBeNull()
  })

  test('remembers the choice per user, so another account still gets the tour', async () => {
    renderTour({ keyTotal: 0 })
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }))
    expect(hasDismissedTour(user.id)).toBe(true)

    expect(hasDismissedTour(user.id + 1)).toBe(false)
  })
})

describe('walking through the tour', () => {
  test('follows the user from the navigation entry to the create button and ends at the Playground', async () => {
    renderTour({ keyTotal: 0 })

    fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
    expect(tourDialog()).toHaveAccessibleName('Open API Keys')
    expect(screen.getByText('Click the highlighted button')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: 'API Keys' }))
    await waitFor(() =>
      expect(tourDialog()).toHaveAccessibleName('Create your first key')
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create API Key' }))
    expect(screen.getByText('create dialog opened')).toBeVisible()

    // 建好密钥后引导继续指向体验广场，告诉用户下一步能做什么。
    await waitFor(() =>
      expect(tourDialog()).toHaveAccessibleName('Try a model right away')
    )
    expect(tourDialog()).not.toBeNull()

    fireEvent.click(screen.getByRole('link', { name: 'AI Chat' }))
    expect(tourDialog()).toBeNull()
    expect(hasDismissedTour(user.id)).toBe(true)
  })

  test('goes back one step and closes on Escape', async () => {
    renderTour({ keyTotal: 0 })

    fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(tourDialog()).toHaveAccessibleName('Welcome! Let us get you started')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(tourDialog()).toBeNull()
    expect(hasDismissedTour(user.id)).toBe(true)
  })

  test('offers a Next button when the highlighted control is not on the page', async () => {
    renderTour({ keyTotal: 0 })
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
    act(() => useOnboardingStore.getState().next())

    expect(tourDialog()).toHaveAccessibleName('Create your first key')
    expect(screen.queryByText('Click the highlighted button')).toBeNull()
    expect(screen.getByRole('button', { name: 'Next' })).toBeVisible()
  })
})

describe('reopening the tour by hand', () => {
  test('opens from the first step even after it was dismissed and the user has keys', async () => {
    localStorage.setItem(`onboarding:tour-dismissed:${user.id}`, '1')
    renderTour({ keyTotal: 5 })
    expect(tourDialog()).toBeNull()

    act(() => useOnboardingStore.getState().start())

    expect(tourDialog()).toHaveAccessibleName('Welcome! Let us get you started')
    expect(keyProbes).toBe(0)
  })
})
