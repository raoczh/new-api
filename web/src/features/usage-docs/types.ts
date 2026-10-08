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
/** Documentation content is authored in these two languages only. */
export type DocLanguage = 'en' | 'zh'

export type Copy = Record<DocLanguage, string>

export type Block = {
  type: 'p' | 'list' | 'code'
  text?: Copy
  items?: Copy[]
  code?: string
}

export type Topic = { id: string; title: Copy; blocks: Block[] }

export type Chapter = { id: string; title: Copy; topics: Topic[] }

/**
 * Map an interface language to the language the documentation is written in.
 *
 * `zh` and `zh-TW` both read Simplified content; the remaining interface
 * languages fall back to English rather than rendering a blank page.
 */
export function resolveDocLanguage(language: string | undefined): DocLanguage {
  return language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}
