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
import { resolveSiteUrl } from '../site-address'

const statusState = vi.hoisted(() => ({
  current: {} as Record<string, string>,
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: statusState.current }),
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
  }) =>
    createElement(
      'a',
      {
        href: props.params?._splat
          ? props.to.replace('$', props.params._splat)
          : props.to,
        className: props.className,
      },
      props.children
    ),
}))
vi.mock('@/components/copy-button', () => ({ CopyButton: () => null }))

describe('documentation site address', () => {
  it.each([
    ['https://gateway.example.org/', 'https://gateway.example.org'],
    [
      'https://gateway.example.org/proxy/v1/',
      'https://gateway.example.org/proxy',
    ],
    [
      'https://gateway.example.org/proxy/?source=admin#docs',
      'https://gateway.example.org/proxy',
    ],
    ['http://gateway.example.org', 'http://gateway.example.org'],
  ])('uses the configured address %s', (input, expected) => {
    expect(resolveSiteUrl(input)).toBe(expected)
  })

  it.each([
    undefined,
    '',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'not a URL',
  ])('uses the public fallback for %s', (input) => {
    expect(resolveSiteUrl(input)).toBe('https://tokencome.org')
  })
})

it('uses the saved site address in instructions on a client page', () => {
  statusState.current = {
    server_address: 'https://configured.example.net/proxy/',
  }

  const view = render(createElement(UsageDocs, { slug: 'config/codex' }))
  expect(view.container.textContent).toContain(
    'base_url = "https://configured.example.net/proxy/v1"'
  )
  expect(view.container.textContent).not.toContain('YOUR-SITE.example')
})

it('shows configured contact methods on the support section', () => {
  statusState.current = {
    server_address: 'https://configured.example.net',
    contact_email: 'support@example.net',
    contact_wechat_qrcode: 'https://configured.example.net/qr.png',
    contact_qq_group: '12345678',
  }

  render(createElement(UsageDocs, { slug: 'guides/error-handling' }))
  expect(
    screen.getByRole('link', { name: 'support@example.net' })
  ).toHaveAttribute('href', 'mailto:support@example.net')
  expect(
    screen.getByRole('img', { name: 'WeChat Group QR Code' })
  ).toHaveAttribute('src', 'https://configured.example.net/qr.png')
  expect(screen.getByText('12345678')).toBeInTheDocument()
})

it('falls back to the default email and a ticket link when no contact method is configured', () => {
  statusState.current = { server_address: 'http://localhost:3000' }

  const view = render(
    createElement(UsageDocs, { slug: 'guides/error-handling' })
  )
  expect(view.container.textContent).toContain(
    'https://tokencome.org/v1/chat/completions'
  )
  expect(
    screen.queryByRole('heading', { name: 'Contact Information' })
  ).toBeNull()
  expect(
    screen.getByRole('link', { name: 'tokencome@163.com' })
  ).toHaveAttribute('href', 'mailto:tokencome@163.com')
  expect(
    screen.getByRole('link', { name: 'Open a support ticket' })
  ).toHaveAttribute('href', '/tickets')
})
