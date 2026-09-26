import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
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
  PublicLayout: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@tanstack/react-router', () => ({ Link: () => null }))
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
    expect(resolveSiteUrl(input)).toBe('https://api.tokencome.org')
  })
})

it('uses the saved site address in instructions and shows configured contact methods', () => {
  statusState.current = {
    server_address: 'https://configured.example.net/proxy/',
    contact_email: 'support@example.net',
    contact_wechat_qrcode: 'https://configured.example.net/qr.png',
    contact_qq_group: '12345678',
  }

  const view = render(createElement(UsageDocs))
  expect(view.container.textContent).toContain(
    'https://configured.example.net/proxy/v1/chat/completions'
  )
  expect(view.container.textContent).toContain(
    'base_url = "https://configured.example.net/proxy/v1"'
  )
  expect(view.container.textContent).not.toContain('YOUR-SITE.example')
  expect(
    screen.getByRole('link', { name: 'support@example.net' })
  ).toHaveAttribute('href', 'mailto:support@example.net')
  expect(
    screen.getByRole('img', { name: 'WeChat Group QR Code' })
  ).toHaveAttribute('src', 'https://configured.example.net/qr.png')
  expect(screen.getByText('12345678')).toBeInTheDocument()
})

it('uses the public fallback and hides contact methods when nothing is configured', () => {
  statusState.current = { server_address: 'http://localhost:3000' }

  const view = render(createElement(UsageDocs))
  expect(view.container.textContent).toContain(
    'https://api.tokencome.org/v1/chat/completions'
  )
  expect(
    screen.queryByRole('heading', { name: 'Contact Information' })
  ).toBeNull()
})
