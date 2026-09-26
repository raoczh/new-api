import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { LegalPageLayout } from '../legal-page-layout'

test('policy pages share a sidebar with the current document marked', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], { system_name: 'New API' })
  const root = createRootRoute()
  const privacy = createRoute({
    getParentRoute: () => root,
    path: '/privacy-policy',
    component: () => (
      <LegalPageLayout>
        <h1>Privacy</h1>
      </LegalPageLayout>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([privacy]),
    history: createMemoryHistory({ initialEntries: ['/privacy-policy'] }),
  })
  await router.load()

  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )

  const sidebar = screen.getByRole('navigation', { name: 'Policies' })
  expect(within(sidebar).getAllByRole('link')).toHaveLength(8)
  expect(
    within(sidebar).getByRole('link', { name: 'Privacy Policy' })
  ).toHaveAttribute('aria-current', 'page')
  expect(
    within(sidebar).getByRole('link', { name: 'Terms of Service' })
  ).toHaveAttribute('href', '/terms-of-service')
})
