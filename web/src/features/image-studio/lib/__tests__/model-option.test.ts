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

import type { ImageStudioModelOption } from '../../types'
import { summarizeModelMeta } from '../model-option'

function translate(key: string, options?: Record<string, unknown>): string {
  return Object.entries(options ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    key
  )
}

function model(
  overrides: Partial<ImageStudioModelOption>
): ImageStudioModelOption {
  return {
    model: 'gpt-image-1',
    quota_type: 1,
    price: 0,
    ...overrides,
  }
}

test('a tiered fixed per-image price is shown per image', () => {
  const meta = summarizeModelMeta(
    model({ price: 0.04, price_unit: 'image' }),
    translate
  )
  expect(meta).toBe('$0.04 / image')
})

test('a tiered fixed per-request price is not mislabeled as per image', () => {
  // Legacy quota_type stays 1 on these models, so price_unit must win.
  const meta = summarizeModelMeta(
    model({ price: 0.02, price_unit: 'request', quota_type: 1 }),
    translate
  )
  expect(meta).toBe('$0.02 / request')
})

test('legacy per-call pricing without price_unit still renders per image', () => {
  const meta = summarizeModelMeta(
    model({ price: 0.25, quota_type: 1 }),
    translate
  )
  expect(meta).toBe('$0.25 / image')
})

test('token-priced models show the input and output prices instead of a ratio', () => {
  const meta = summarizeModelMeta(
    model({ quota_type: 0, input_price: 2, output_price: 8 }),
    translate
  )
  expect(meta).toBe('Input $2 / 1M tokens · Output $8 / 1M tokens')
})

test('a token-priced model missing one side shows only the price it has', () => {
  expect(
    summarizeModelMeta(model({ quota_type: 0, output_price: 8 }), translate)
  ).toBe('Output $8 / 1M tokens')
})

test('a model with no displayable price keeps the row single-line', () => {
  expect(summarizeModelMeta(model({ quota_type: 0 }), translate)).toBe('')
})
