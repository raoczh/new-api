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
import { expect, test } from 'vitest'

import type { ImageStudioTask } from '../../types'
import { describeTaskParams, describeTaskTime } from '../task-view'

test('describeTaskTime accepts the interface language codes', () => {
  const timestamp = Math.floor(Date.now() / 1000) - 5
  expect(() => describeTaskTime(timestamp, 'zhCN')).not.toThrow()
  expect(() => describeTaskTime(timestamp, 'en')).not.toThrow()
})

test('describeTaskTime formats with a BCP-47 locale', () => {
  const timestamp = Math.floor(Date.now() / 1000) - 5
  expect(describeTaskTime(timestamp, 'en-US')).toContain('second')
})

test('describeTaskTime falls back to the runtime locale for unknown codes', () => {
  const timestamp = Math.floor(Date.now() / 1000) - 5
  expect(() => describeTaskTime(timestamp, 'not a locale')).not.toThrow()
})

test('Zhiqi history summaries display direct resolution, ratio and compression zero', () => {
  const task = {
    params: {
      resolution: '1080p',
      aspect_ratio: '4:5',
      quality: 'max',
      output_format: 'webp',
      output_compression: 0,
    },
  } as ImageStudioTask
  expect(describeTaskParams(task)).toBe('max · 1080p · 4:5 · WEBP · 0%')
})

test('GIF history summaries include frame count and unrounded duration', () => {
  const task = {
    params: { output_format: 'gif', frame_count: 2, frame_duration_ms: 84 },
  } as ImageStudioTask
  expect(describeTaskParams(task)).toBe('GIF · 2f · 84ms')
})
