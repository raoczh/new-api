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
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getImageStudioTask } from '../api'
import type { ImageStudioTask } from '../types'

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get,
  },
}))

const task: ImageStudioTask = {
  id: 'img_xpvLpJxKbDeZPEg3bXs4PS4V',
  kind: 'image',
  status: 'succeeded',
  model: 'gpt-image-1',
  group: 'default',
  prompt: 'a cat',
  params: null,
  images: ['https://example.com/a.png'],
  references: [],
  error: '',
  quota: 40000,
  favorite: false,
  elapsed_ms: 1200,
  created_at: 1_760_000_000,
  finished_at: 1_760_000_001,
  expires_at: 1_760_086_400,
}

describe('getImageStudioTask', () => {
  beforeEach(() => {
    get.mockReset()
  })

  test('returns the task view the server sends directly in data', async () => {
    get.mockResolvedValue({ data: { success: true, data: task } })

    await expect(getImageStudioTask(task.id)).resolves.toEqual(task)
    expect(get).toHaveBeenCalledWith(`/api/image-studio/tasks/${task.id}`, {
      signal: undefined,
      disableDuplicate: true,
    })
  })

  test('surfaces a failed envelope instead of an undefined task', async () => {
    get.mockResolvedValue({
      data: { success: false, message: 'Record not found or expired' },
    })

    await expect(getImageStudioTask(task.id)).rejects.toThrow(
      'Record not found or expired'
    )
  })
})
