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
import { describe, expect, test } from 'vitest'

import {
  convertDetectedLanguage,
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from './languages'

describe('interface language options', () => {
  test('exposes only Simplified Chinese and English', () => {
    expect(INTERFACE_LANGUAGE_OPTIONS.map((option) => option.code)).toEqual([
      'zhCN',
      'en',
    ])
  })
})

describe('normalizeInterfaceLanguage', () => {
  test('folds every Chinese variant onto zhCN', () => {
    expect(normalizeInterfaceLanguage('zh-CN')).toBe('zhCN')
    expect(normalizeInterfaceLanguage('zh-TW')).toBe('zhCN')
    expect(normalizeInterfaceLanguage('zh-Hant')).toBe('zhCN')
    expect(normalizeInterfaceLanguage('zhCN')).toBe('zhCN')
    expect(normalizeInterfaceLanguage('zh')).toBe('zhCN')
  })

  test('keeps English and falls back for removed or unknown locales', () => {
    expect(normalizeInterfaceLanguage('en')).toBe('en')
    expect(normalizeInterfaceLanguage('en-US')).toBe('en')
    expect(normalizeInterfaceLanguage('fr')).toBe('en')
    expect(normalizeInterfaceLanguage('ja')).toBe('en')
    expect(normalizeInterfaceLanguage('')).toBe('en')
    expect(normalizeInterfaceLanguage(null)).toBe('en')
  })
})

describe('convertDetectedLanguage', () => {
  test('maps browser BCP-47 Chinese tags onto the interface code', () => {
    expect(convertDetectedLanguage('zh-TW')).toBe('zhCN')
    expect(convertDetectedLanguage('zh-HK')).toBe('zhCN')
    expect(convertDetectedLanguage('zh-Hant-TW')).toBe('zhCN')
    expect(convertDetectedLanguage('zh')).toBe('zhCN')
    expect(convertDetectedLanguage('zh-CN')).toBe('zhCN')
    expect(convertDetectedLanguage('zhCN')).toBe('zhCN')
  })

  test('passes non-Chinese values through unchanged', () => {
    expect(convertDetectedLanguage('en')).toBe('en')
    expect(convertDetectedLanguage('en-US')).toBe('en-US')
  })
})
