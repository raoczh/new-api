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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  ModelGroupSelector,
  type ModelOption,
} from '../../model-group-selector'

const models: ModelOption[] = Array.from({ length: 30 }, (_, index) => ({
  label: `model-${index}`,
  value: `model-${index}`,
}))

const groups = [
  { label: 'default', value: 'default', ratio: 1 },
  { label: 'vip', value: 'vip', ratio: 2 },
]

const originalScrollTo = HTMLElement.prototype.scrollTo

afterEach(() => {
  vi.restoreAllMocks()
  HTMLElement.prototype.scrollTo = originalScrollTo
})

describe('opening the model group selector', () => {
  test('brings the selected model into view by scrolling the model list only, never the page', async () => {
    // scrollIntoView with block: center also scrolls every ancestor, the page
    // included, which pushed the page header out of the window.
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
    const scrolled: HTMLElement[] = []
    HTMLElement.prototype.scrollTo = function scrollTo(this: HTMLElement) {
      scrolled.push(this)
    }
    const user = userEvent.setup()
    render(
      <ModelGroupSelector
        groups={groups}
        models={models}
        onGroupChange={() => undefined}
        onModelChange={() => undefined}
        selectedGroup='vip'
        selectedModel='model-20'
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Select model' }))
    const list = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(
        '[data-slot="command-list"]'
      )
      if (!element) throw new Error('model list is not open')
      return element
    })

    await waitFor(() => expect(scrolled).toContain(list))
    const centered = scrollIntoView.mock.calls.filter(
      ([options]) => typeof options === 'object' && options?.block === 'center'
    )
    expect(centered).toEqual([])
  })
})
