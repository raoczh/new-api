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

import {
  calculateImageSize,
  clampImageSize,
  describeImageRatio,
  findSizePreset,
  parseImageRatio,
  parseImageSize,
} from '../size'

test('the 1K tier pins the short side so ratios keep their shape', () => {
  expect(calculateImageSize('1K', '1:1')).toBe('1024x1024')
  expect(calculateImageSize('1K', '16:9')).toBe('1824x1024')
  expect(calculateImageSize('1K', '9:16')).toBe('1024x1824')
  expect(calculateImageSize('1K', '3:2')).toBe('1536x1024')
})

test('the 2K and 4K tiers pin the long side', () => {
  expect(calculateImageSize('2K', '16:9')).toBe('2048x1152')
  expect(calculateImageSize('2K', '1:1')).toBe('2048x2048')
  expect(calculateImageSize('4K', '16:9')).toBe('3840x2160')
  expect(calculateImageSize('4K', '3:2')).toBe('3840x2560')
})

test('every ratio-derived size is a multiple of 16', () => {
  for (const ratio of ['1:1', '3:2', '2:3', '16:9', '9:16', '4:3', '3:4', '21:9']) {
    for (const tier of ['1K', '2K', '4K'] as const) {
      const parsed = parseImageSize(calculateImageSize(tier, ratio) ?? '')
      expect(parsed).not.toBeNull()
      expect(parsed?.width % 16).toBe(0)
      expect(parsed?.height % 16).toBe(0)
    }
  }
})

test('an unreadable ratio yields no size instead of a guess', () => {
  expect(calculateImageSize('1K', 'auto')).toBeNull()
  expect(calculateImageSize('1K', '0:9')).toBeNull()
})

test('custom sizes snap to multiples of 16 and report an adjustment', () => {
  const exact = clampImageSize(1024, 768)
  expect(exact).toEqual({ size: '1024x768', adjusted: false })

  const rounded = clampImageSize(1001, 769)
  expect(rounded?.adjusted).toBe(true)
  const parsed = parseImageSize(rounded?.size ?? '')
  expect(parsed?.width % 16).toBe(0)
  expect(parsed?.height % 16).toBe(0)
})

test('a huge or extreme custom size is pulled back into range', () => {
  const oversized = clampImageSize(9999, 9999)
  expect(oversized?.size).toBe('2880x2880')

  const panoramic = clampImageSize(4000, 500)
  const parsed = parseImageSize(panoramic?.size ?? '')
  expect(parsed).not.toBeNull()
  expect(
    Math.max(parsed!.width, parsed!.height) / Math.min(parsed!.width, parsed!.height)
  ).toBeLessThanOrEqual(3)
  expect(parsed!.width * parsed!.height).toBeLessThanOrEqual(8_294_400)
})

test('a custom size below the minimum is scaled up', () => {
  const tiny = clampImageSize(100, 100)
  const parsed = parseImageSize(tiny?.size ?? '')
  expect(parsed?.width).toBe(parsed?.height)
  expect((parsed?.width ?? 0) * (parsed?.height ?? 0)).toBeGreaterThanOrEqual(655_360)
  expect(tiny?.adjusted).toBe(true)
})

test('unusable custom input returns null', () => {
  expect(clampImageSize(0, 1024)).toBeNull()
  expect(clampImageSize(Number.NaN, 1024)).toBeNull()
})

test('a preset size is recognised together with its tier and ratio', () => {
  expect(
    findSizePreset('2048x1152', ['1K', '2K', '4K'], ['16:9'])
  ).toEqual({ tier: '2K', ratio: '16:9' })
  expect(findSizePreset('1000x1000', ['1K', '2K', '4K'], ['1:1'])).toBeNull()
  expect(findSizePreset('auto', ['1K'], ['1:1'])).toBeNull()
})

test('ratio labels reduce sizes and ratios alike', () => {
  expect(describeImageRatio('1024x1365')).toBe('1024:1365')
  expect(describeImageRatio('16:9')).toBe('16:9')
  expect(describeImageRatio('auto')).toBe('auto')
})

test('ratio parsing accepts decimals and rejects nonsense', () => {
  expect(parseImageRatio('2.39:1')).toEqual({ width: 2.39, height: 1 })
  expect(parseImageRatio('16x9')).toEqual({ width: 16, height: 9 })
  expect(parseImageRatio('')).toBeNull()
  expect(parseImageRatio('wide')).toBeNull()
})
