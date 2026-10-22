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
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { IMAGE_STUDIO_QUERY_KEYS } from '../../constants'
import type { ImageStudioTask } from '../../types'
import { ImageStudioTaskDetail } from '../task-detail'

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
    references: ['https://img.example.com/reference.png'],
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

function renderDetail(
  task: ImageStudioTask,
  onReuse: (task: ImageStudioTask) => void = () => undefined
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
  queryClient.setQueryData(IMAGE_STUDIO_QUERY_KEYS.task(task.id), task)
  render(
    <QueryClientProvider client={queryClient}>
      <ImageStudioTaskDetail
        taskId={task.id}
        onOpenChange={() => undefined}
        onReuse={onReuse}
      />
    </QueryClientProvider>
  )
}

test('opens the generated image in a full-screen preview', async () => {
  renderDetail(makeTask())

  fireEvent.click(
    await screen.findByRole('button', { name: 'Preview generated image' })
  )

  const dialog = await screen.findByRole('dialog', { name: 'Image Preview' })
  expect(dialog.querySelector('img')).toHaveAttribute(
    'src',
    'https://img.example.com/result.png'
  )
})

test('a failed record shows the error instead of a clickable image', async () => {
  renderDetail(
    makeTask({
      status: 'failed',
      error: 'The upstream rejected this prompt',
    })
  )

  expect(
    await screen.findByText('The upstream rejected this prompt')
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Preview generated image' })
  ).not.toBeInTheDocument()
})

test('opens a reference image in the same preview overlay', async () => {
  renderDetail(makeTask())

  fireEvent.click(
    await screen.findByRole('button', { name: 'Preview reference image 1' })
  )

  const dialog = await screen.findByRole('dialog', { name: 'Image Preview' })
  expect(dialog.querySelector('img')).toHaveAttribute(
    'src',
    'https://img.example.com/reference.png'
  )
})

test('a failed record keeps copy prompt and reuse actions without a download', async () => {
  const task = makeTask({
    status: 'failed',
    images: [],
    references: [],
    error: 'The upstream rejected this prompt',
  })
  const onReuse = vi.fn()
  renderDetail(task, onReuse)

  expect(
    await screen.findByText('The upstream rejected this prompt')
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Download' })
  ).not.toBeInTheDocument()

  // The record details stay readable even though the image area is inert.
  const sheet = screen.getByRole('dialog')
  expect(within(sheet).getByText('gpt-image-1')).toBeVisible()
  expect(within(sheet).getByText('1024x1024')).toBeVisible()
  expect(within(sheet).getByText('A lighthouse at dusk')).toBeVisible()

  fireEvent.click(
    within(sheet).getByRole('button', { name: 'Reuse these settings' })
  )
  expect(onReuse).toHaveBeenCalledWith(task)
})
