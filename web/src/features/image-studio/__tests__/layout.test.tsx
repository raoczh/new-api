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
import { render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { ImageStudioPage } from '../index'
import type {
  ImageStudioConfig,
  ImageStudioGroupOption,
  ImageStudioTask,
  ImageStudioTaskList,
} from '../types'

const api = vi.hoisted(() => ({
  getImageStudioConfig: vi.fn(),
  getImageStudioModels: vi.fn(),
  getImageStudioTask: vi.fn(),
  listImageStudioTasks: vi.fn(),
  submitImageStudioTask: vi.fn(),
  uploadImageStudioFile: vi.fn(),
  deleteImageStudioTask: vi.fn(),
  cancelImageStudioTask: vi.fn(),
  batchImageStudioTasks: vi.fn(),
  updateImageStudioPreferences: vi.fn(),
}))
vi.mock('../api', () => api)

const config: ImageStudioConfig = {
  enabled: true,
  image_concurrency: 2,
  video_concurrency: 1,
  retention_days: 7,
  max_images_per_request: 4,
  max_reference_images: 2,
  upload_max_mb: 10,
  queue_max_wait_minutes: 5,
  image_models: ['gpt-image-1'],
  smtp_configured: false,
}

const groups: ImageStudioGroupOption[] = [
  {
    group: 'default',
    desc: 'Standard group',
    ratio: 1,
    models: [{ model: 'gpt-image-1', quota_type: 1, price: 0.02 }],
  },
  {
    group: 'vip',
    desc: 'Premium group',
    ratio: 0.5,
    models: [{ model: 'nano-banana', quota_type: 1, price: 0.03 }],
  },
]

const task: ImageStudioTask = {
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
}

const list: ImageStudioTaskList = {
  items: [task],
  total: 1,
  page: 1,
  page_size: 12,
  models: ['gpt-image-1'],
  retention_days: 7,
}

afterEach(() => {
  vi.clearAllMocks()
})

/**
 * Columns are located through the sections they hold: the composer's `AI Image`
 * heading and the history heading. That keeps the assertions independent of the
 * wrapper markup while still pinning the two-column contract.
 */
async function renderWorkbench() {
  api.getImageStudioConfig.mockResolvedValue(config)
  api.getImageStudioModels.mockResolvedValue(groups)
  api.listImageStudioTasks.mockResolvedValue(list)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ImageStudioPage />
    </QueryClientProvider>
  )

  const composer = await screen.findByRole('heading', { name: 'AI Image' })
  const history = await screen.findByRole('heading', {
    name: /Generation history/,
  })
  // Wait for the first record so the grid is mounted, not just the filter bar.
  await screen.findByRole('button', {
    name: 'Open details for A lighthouse at dusk',
  })

  const editorColumn = composer.closest('section')?.parentElement?.parentElement
  const galleryColumn = history.closest('section')?.parentElement
  if (!editorColumn || !galleryColumn) {
    throw new Error('workbench columns not found')
  }
  return { editorColumn, galleryColumn }
}

test('splits the workbench into an editor column and a gallery column', async () => {
  const { editorColumn, galleryColumn } = await renderWorkbench()

  const grid = editorColumn.parentElement
  expect(grid).toBe(galleryColumn.parentElement)
  expect(grid).toHaveClass(
    'xl:grid',
    'xl:grid-cols-[minmax(23rem,27rem)_minmax(0,1fr)]',
    'xl:overflow-hidden'
  )
  // Mobile keeps a single stacked column; only xl turns it into a grid.
  expect(grid).toHaveClass('flex-col')
})

test('lets each column scroll on its own', async () => {
  const { editorColumn, galleryColumn } = await renderWorkbench()

  // A long history must not push the prompt off screen.
  expect(editorColumn).toHaveClass('xl:overflow-y-auto')
  expect(galleryColumn).toHaveClass('xl:overflow-y-auto')
  expect(galleryColumn).toHaveClass('@container/history')
})

test('sizes the record grid by the gallery column width', async () => {
  const { galleryColumn } = await renderWorkbench()

  // Viewport breakpoints would keep the gallery at two columns on a wide
  // screen; container queries follow the column the grid actually fills.
  const cardGrid = galleryColumn.querySelector(
    '[class*="@min-[34rem]/history"]'
  )
  expect(cardGrid).not.toBeNull()
  expect(cardGrid).toHaveClass('grid', 'grid-cols-2')
  expect(within(cardGrid as HTMLElement).getByRole('img')).toBeInTheDocument()
})
