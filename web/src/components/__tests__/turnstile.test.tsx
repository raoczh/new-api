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
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, assert, expect, it, vi } from 'vitest'

import { Turnstile } from '../turnstile'

afterEach(() => {
  cleanup()
  delete window.turnstile
  document.querySelector('#cf-turnstile')?.remove()
})

it('keeps the widget when callbacks change and calls the latest callback', () => {
  const renderWidget = vi.fn(
    (_element: HTMLElement, _options: Record<string, unknown>) => 'widget-1'
  )
  const removeWidget = vi.fn()
  window.turnstile = { render: renderWidget, remove: removeWidget }
  const firstCallback = vi.fn()
  const latestCallback = vi.fn()
  const firstExpire = vi.fn()
  const latestExpire = vi.fn()
  const view = render(
    <Turnstile
      siteKey='site-key'
      onVerify={firstCallback}
      onExpire={firstExpire}
    />
  )
  const options = renderWidget.mock.calls[0][1] as Record<string, unknown>

  view.rerender(
    <Turnstile
      siteKey='site-key'
      onVerify={latestCallback}
      onExpire={latestExpire}
    />
  )
  act(() => (options.callback as (token: string) => void)('fresh-token'))
  act(() => (options['expired-callback'] as () => void)())

  expect(renderWidget).toHaveBeenCalledTimes(1)
  expect(firstCallback).not.toHaveBeenCalled()
  expect(latestCallback).toHaveBeenCalledWith('fresh-token')
  expect(firstExpire).not.toHaveBeenCalled()
  expect(latestExpire).toHaveBeenCalledOnce()
  view.unmount()
  expect(removeWidget).toHaveBeenCalledWith('widget-1')
})

it('renders all mounted widgets when the shared script finishes loading', () => {
  const view = render(
    <>
      <Turnstile siteKey='first-site' onVerify={vi.fn()} />
      <Turnstile siteKey='second-site' onVerify={vi.fn()} />
    </>
  )
  const script = document.querySelector<HTMLScriptElement>('#cf-turnstile')
  assert(script)
  const renderWidget = vi.fn(
    (_element: HTMLElement, options: Record<string, unknown>) =>
      String(options.sitekey)
  )
  const removeWidget = vi.fn()
  window.turnstile = { render: renderWidget, remove: removeWidget }

  act(() => script.dispatchEvent(new Event('load')))

  expect(renderWidget.mock.calls.map((call) => call[1].sitekey)).toEqual([
    'first-site',
    'second-site',
  ])
  view.unmount()
  expect(removeWidget).toHaveBeenCalledWith('first-site')
  expect(removeWidget).toHaveBeenCalledWith('second-site')
})

it('ignores script load events after the widget unmounts', () => {
  const view = render(<Turnstile siteKey='site-key' onVerify={vi.fn()} />)
  const script = document.querySelector<HTMLScriptElement>('#cf-turnstile')
  assert(script)
  view.unmount()
  const renderWidget = vi.fn(() => 'widget-1')
  window.turnstile = { render: renderWidget, remove: vi.fn() }

  act(() => script.dispatchEvent(new Event('load')))

  expect(renderWidget).not.toHaveBeenCalled()
})
