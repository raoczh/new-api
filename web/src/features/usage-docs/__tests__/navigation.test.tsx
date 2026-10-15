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
import { render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { UsageDocs } from '../index'
import { buildDocGroups, locateDocPage } from '../navigation'

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: { server_address: 'https://gw.example.org' } }),
}))

vi.mock('@/components/layout', () => ({
  PublicLayout: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    to: string
    params?: { _splat?: string }
    children?: ReactNode
    className?: string
    'aria-current'?: 'page'
  }) =>
    createElement(
      'a',
      {
        href: props.params?._splat
          ? props.to.replace('$', props.params._splat)
          : props.to,
        className: props.className,
        'aria-current': props['aria-current'],
      },
      props.children
    ),
}))
vi.mock('@/components/copy-button', () => ({ CopyButton: () => null }))

const groups = buildDocGroups('https://gw.example.org')
const pages = groups.flatMap((group) => group.pages)

describe('documentation structure', () => {
  it('gives every page a unique slug with the introduction first', () => {
    const slugs = pages.map((page) => page.slug)
    expect(slugs[0]).toBe('')
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('gives every section a unique anchor within its page', () => {
    for (const page of pages) {
      const ids = page.sections.map((section) => section.id)
      expect(new Set(ids).size, page.slug).toBe(ids.length)
    }
  })

  it('points every in-docs link at an existing page', () => {
    const slugs = new Set(pages.map((page) => page.slug))
    for (const page of pages) {
      for (const section of page.sections) {
        for (const block of section.blocks) {
          if (block.type !== 'docLinks') continue
          for (const item of block.items) {
            expect(slugs.has(item.slug), `${page.slug} → ${item.slug}`).toBe(
              true
            )
          }
        }
      }
    }
  })

  it('links neighbours across group boundaries', () => {
    const location = locateDocPage(groups, '/config/ccswitch/')
    expect(location?.group.id).toBe('clients')
    expect(location?.previous?.slug).toBe('models')
    expect(location?.next?.slug).toBe('config/claude-code')
  })

  it('returns nothing for an unknown slug', () => {
    expect(locateDocPage(groups, 'config/unknown')).toBeUndefined()
  })
})

describe('documentation page', () => {
  it('marks the current page in the sidebar and links its neighbours', () => {
    render(createElement(UsageDocs, { slug: 'config/claude-code' }))

    const current = screen
      .getAllByRole('link', { current: 'page' })
      .map((link) => link.getAttribute('href'))
    expect(current).toContain('/docs/config/claude-code')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Claude Code (manual)' })
    ).toBeInTheDocument()

    const pagination = screen.getByRole('navigation', { name: 'Pagination' })
    const neighbours = [...pagination.querySelectorAll('a')].map((link) =>
      link.getAttribute('href')
    )
    expect(neighbours).toEqual(['/docs/config/ccswitch', '/docs/config/codex'])
  })

  it('shows a way back when the page does not exist', () => {
    render(createElement(UsageDocs, { slug: 'nope' }))

    expect(screen.getByText('Documentation page not found')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to the introduction' })
    ).toHaveAttribute('href', '/docs')
  })
})
