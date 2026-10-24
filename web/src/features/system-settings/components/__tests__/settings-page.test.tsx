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
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPage } from '../settings-page'

const routerState = vi.hoisted(() => ({ section: 'wide' }))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useParams: () => ({ section: routerState.section }),
}))

const sections: Record<
  string,
  { titleKey: string; contentWidth?: 'default' | 'fluid' }
> = {
  wide: { titleKey: 'Wide section', contentWidth: 'fluid' },
  narrow: { titleKey: 'Narrow section' },
}

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage(section: 'wide' | 'narrow') {
  routerState.section = section
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: [] },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <SettingsPage
        routePath='/_authenticated/system-settings/billing/$section'
        defaultSettings={{ Demo: '' }}
        defaultSection='wide'
        getSectionContent={() => <div data-testid='section-content' />}
        getSectionMeta={(sectionId: string) => sections[sectionId]}
      />
    </QueryClientProvider>
  )
  return screen.findByTestId('section-content')
}

it('lets sections that opt into fluid width fill the page', async () => {
  const content = await renderPage('wide')
  expect(content.parentElement).toHaveClass(
    'max-w-none',
    'w-full',
    '@container/settings'
  )
})

it('keeps the readable frame for sections without a width override', async () => {
  const content = await renderPage('narrow')
  expect(content.parentElement).toHaveClass('max-w-6xl', 'w-full')
  expect(content.parentElement).not.toHaveClass('max-w-none')
})
