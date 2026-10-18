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
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { ImageStudioTask } from '../../types'
import {
  readLocalRecords,
  removeLocalRecords,
  saveLocalRecords,
} from '../local-store'

function task(id: string): ImageStudioTask {
  return {
    id,
    kind: 'image',
    status: 'succeeded',
    model: 'gpt-image-1',
    group: 'default',
    prompt: 'a lighthouse at dusk',
    params: null,
    images: [],
    references: [],
    error: '',
    quota: 0,
    favorite: false,
    elapsed_ms: 0,
    created_at: Date.now(),
    finished_at: Date.now(),
    expires_at: Date.now() + 86400000,
  }
}

beforeEach(() => {
  // jsdom ships without IndexedDB, which is exactly the environment the cache
  // must survive (private browsing, desktop shells). Pin it so a host that
  // does provide one cannot mask the fallback.
  vi.stubGlobal('indexedDB', undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('reading without IndexedDB returns an empty list instead of throwing', async () => {
  await expect(readLocalRecords('user-1', 7)).resolves.toEqual([])
})

test('saving without IndexedDB resolves quietly so generation is never blocked', async () => {
  await expect(
    saveLocalRecords('user-1', [task('task-1')])
  ).resolves.toBeUndefined()
})

test('removing without IndexedDB resolves quietly', async () => {
  await expect(removeLocalRecords(['task-1'])).resolves.toBeUndefined()
})

test('an unknown owner reads nothing', async () => {
  await expect(readLocalRecords('', 7)).resolves.toEqual([])
})
