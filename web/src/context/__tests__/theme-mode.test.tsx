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
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeSwitch } from '@/components/theme-switch'
import { ThemeProvider, useTheme } from '@/context/theme-provider'

function ThemeControls() {
  const theme = useTheme()

  return (
    <>
      <output aria-label='Theme mode'>{theme.theme}</output>
      <output aria-label='Resolved theme'>{theme.resolvedTheme}</output>
      <ThemeSwitch />
      <button type='button' onClick={theme.resetTheme}>
        Reset
      </button>
    </>
  )
}

function ThemeFixture() {
  return (
    <ThemeProvider>
      <ThemeControls />
    </ThemeProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.style.removeProperty('color-scheme')
})

describe('theme mode preference', () => {
  it('closes the theme menu after choosing a mode and restores trigger focus', async () => {
    const user = userEvent.setup()
    render(<ThemeFixture />)
    const trigger = screen.getByRole('button', { name: 'Toggle theme' })
    trigger.focus()
    await user.keyboard('[Enter]')
    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }))
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
    expect(document.documentElement).toHaveClass('dark')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('follows system changes until a manual choice, and follows again after reset', async () => {
    const events = new EventTarget()
    const originalMatchMedia = window.matchMedia
    const media: MediaQueryList = {
      ...originalMatchMedia('(prefers-color-scheme: dark)'),
      matches: false,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
    }
    vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
      query === '(prefers-color-scheme: dark)'
        ? media
        : originalMatchMedia(query)
    )
    const user = userEvent.setup()
    render(<ThemeFixture />)

    act(() => {
      Object.defineProperty(media, 'matches', {
        value: true,
        configurable: true,
      })
      media.dispatchEvent(new Event('change'))
    })
    expect(screen.getByLabelText('Resolved theme')).toHaveTextContent('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Light' }))
    act(() => {
      media.dispatchEvent(new Event('change'))
    })
    expect(screen.getByLabelText('Resolved theme')).toHaveTextContent('light')

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByLabelText('Theme mode')).toHaveTextContent('system')
    expect(screen.getByLabelText('Resolved theme')).toHaveTextContent('dark')
    expect(localStorage.getItem('newapi:theme:v1:mode')).toBeNull()
  })

  it('restores the persisted mode after remounting', async () => {
    const user = userEvent.setup()
    const first = render(<ThemeFixture />)
    await user.click(screen.getByRole('button', { name: 'Toggle theme' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }))
    expect(document.documentElement).toHaveClass('dark')
    first.unmount()

    render(<ThemeFixture />)
    expect(screen.getByLabelText('Theme mode')).toHaveTextContent('dark')
    expect(screen.getByLabelText('Resolved theme')).toHaveTextContent('dark')
    expect(localStorage.getItem('newapi:theme:v1:mode')).toBe('dark')
  })
})
