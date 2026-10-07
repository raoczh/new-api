import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ContactInformation } from '../contact-information'

function renderContact(status: Record<string, string>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], status)
  return render(
    <QueryClientProvider client={client}>
      <ContactInformation />
    </QueryClientProvider>
  )
}

test('shows every configured contact method', () => {
  renderContact({
    contact_email: 'help@example.com',
    contact_wechat_qrcode: 'https://example.com/qr.png',
    contact_qq_group: '123456789',
  })

  expect(
    screen.getByRole('link', { name: 'help@example.com' })
  ).toHaveAttribute('href', 'mailto:help@example.com')
  expect(
    screen.getByRole('img', { name: 'WeChat Group QR Code' })
  ).toHaveAttribute('src', 'https://example.com/qr.png')
  expect(screen.getByText('123456789')).toBeInTheDocument()
})

test('hides the contact section when the admin has not configured any method', () => {
  const view = renderContact({
    contact_email: ' ',
    contact_wechat_qrcode: '',
    contact_qq_group: '',
  })
  expect(view.container).toBeEmptyDOMElement()
})
