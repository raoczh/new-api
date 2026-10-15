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
import { buildApiReferencePages } from './content/api-reference'
import { buildClientPages } from './content/clients'
import { buildGettingStartedPages } from './content/getting-started'
import { buildGuidePages } from './content/guides'
import type { DocGroup, DocPage, DocUrls } from './types'

/**
 * The sidebar groups in reading order. Kept free of React so slugs, anchors
 * and the previous/next sequence can be asserted in tests.
 *
 * Only `en` and `zh` are authored; other interface languages fall back to
 * English through `resolveDocLanguage`.
 */
export function buildDocGroups(siteUrl: string): DocGroup[] {
  const urls: DocUrls = { site: siteUrl, api: `${siteUrl}/v1` }

  return [
    {
      id: 'getting-started',
      title: { en: 'Getting started', zh: '开始使用' },
      pages: buildGettingStartedPages(urls),
    },
    {
      id: 'clients',
      title: { en: 'Client setup', zh: '客户端配置' },
      pages: buildClientPages(urls),
    },
    {
      id: 'api',
      title: { en: 'API reference', zh: 'API 参考' },
      pages: buildApiReferencePages(urls),
    },
    {
      id: 'guides',
      title: { en: 'Guides', zh: '使用指南' },
      pages: buildGuidePages(urls),
    },
  ]
}

export type DocLocation = {
  page: DocPage
  group: DocGroup
  previous?: DocPage
  next?: DocPage
}

/**
 * Find a page by its slug, ignoring surrounding slashes. Returns undefined for
 * an unknown slug so the route can render its not-found state.
 */
export function locateDocPage(
  groups: DocGroup[],
  slug: string
): DocLocation | undefined {
  const normalized = slug.replaceAll(/^\/+|\/+$/g, '')
  const ordered = groups.flatMap((group) =>
    group.pages.map((page) => ({ page, group }))
  )
  const index = ordered.findIndex((entry) => entry.page.slug === normalized)
  if (index === -1) return undefined

  return {
    ...ordered[index],
    previous: ordered[index - 1]?.page,
    next: ordered[index + 1]?.page,
  }
}

/** Path of a page under /docs; the introduction lives at /docs itself. */
export function docPath(slug: string): string {
  return slug ? `/docs/${slug}` : '/docs'
}
