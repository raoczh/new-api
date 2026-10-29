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
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import type { ImageStudioTask } from '../../types'
import { ImageStudioTaskCard } from '../task-card'

function makeTask(overrides: Partial<ImageStudioTask> = {}): ImageStudioTask {
  return {
    id: 'task-1',
    kind: 'image',
    status: 'succeeded',
    model: 'gpt-image-1',
    group: 'default',
    prompt: 'A lighthouse at dusk',
    params: { size: '1024x1024' },
    images: ['https://img.example.com/result.png'],
    references: [],
    mask: '',
    error: '',
    quota: 5000,
    favorite: false,
    elapsed_ms: 3200,
    created_at: 1_700_000_000,
    finished_at: 1_700_000_010,
    expires_at: 1_700_600_000,
    ...overrides,
  }
}

function renderCard(
  task: ImageStudioTask,
  onOpen: (task: ImageStudioTask) => void
) {
  render(
    <ImageStudioTaskCard
      task={task}
      selected={false}
      selectionMode={false}
      onSelectChange={() => undefined}
      onOpen={onOpen}
      onToggleFavorite={() => undefined}
    />
  )
}

test('a multi-image record shows its image count on the cover', () => {
  const task = makeTask({
    images: ['https://img.example.com/a.png', 'https://img.example.com/b.png'],
  })
  renderCard(task, () => undefined)

  const cover = screen.getByRole('button', {
    name: 'Open details for A lighthouse at dusk',
  })
  expect(within(cover).getByText('2 images')).toBeInTheDocument()
})

test('the favorite toggle stays reachable by keyboard on a record not yet favorited', () => {
  const onToggleFavorite = vi.fn()
  const task = makeTask()
  render(
    <ImageStudioTaskCard
      task={task}
      selected={false}
      selectionMode={false}
      onSelectChange={() => undefined}
      onOpen={() => undefined}
      onToggleFavorite={onToggleFavorite}
    />
  )

  const toggle = screen.getByRole('button', { name: 'Add to favorites' })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  toggle.focus()
  expect(toggle).toHaveFocus()
  fireEvent.click(toggle)
  expect(onToggleFavorite).toHaveBeenCalledWith(task)
})

test('a failed record still opens its detail panel from the history grid', () => {
  const task = makeTask({
    status: 'failed',
    images: [],
    error: 'The upstream rejected this prompt',
  })
  const onOpen = vi.fn()
  renderCard(task, onOpen)

  expect(screen.getByText('The upstream rejected this prompt')).toBeVisible()
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Open details for A lighthouse at dusk',
    })
  )
  expect(onOpen).toHaveBeenCalledWith(task)
})
