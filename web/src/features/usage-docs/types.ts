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

/** Console pages the documentation may link to directly. */
export type AppRoute =
  | '/keys'
  | '/wallet'
  | '/pricing'
  | '/status-monitor'
  | '/usage-logs'
  | '/tickets'
  | '/playground'

export type CodeSample = { label: string; code: string }

/**
 * Text values may wrap `inline code` in backticks; the renderer turns those
 * spans into <code> elements.
 */
export type Block =
  | { type: 'p'; text: Copy }
  | { type: 'steps'; items: Copy[] }
  | { type: 'bullets'; items: Copy[] }
  | { type: 'code'; code: string; label?: string }
  | { type: 'tabs'; samples: CodeSample[] }
  | { type: 'table'; head: Copy[]; rows: Copy[][] }
  | { type: 'note'; text: Copy; tone?: 'warning' }
  | { type: 'docLinks'; items: Array<{ slug: string; text: Copy }> }
  | { type: 'appLinks'; items: Array<{ to: AppRoute; text: Copy }> }
  /** The operator's configured contact methods, or a ticket fallback. */
  | { type: 'contact' }

export type Section = { id: string; title: Copy; blocks: Block[] }

/** `slug` is the path after /docs/; the introduction uses an empty slug. */
export type DocPage = {
  slug: string
  title: Copy
  summary: Copy
  sections: Section[]
}

export type DocGroup = { id: string; title: Copy; pages: DocPage[] }

/** Addresses every page interpolates into its instructions. */
export type DocUrls = {
  /** Site root, used by Anthropic- and Gemini-style clients. */
  site: string
  /** OpenAI-compatible base URL: the site root plus /v1. */
  api: string
}

/** A value that reads the same in every documentation language. */
export function both(text: string): Copy {
  return { en: text, zh: text }
}

/**
 * Map an interface language to the language the documentation is written in.
 *
 * Chinese interface languages read Simplified content; every other interface
 * language falls back to English rather than rendering a blank page.
 */
export function resolveDocLanguage(language: string | undefined): DocLanguage {
  return language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}
