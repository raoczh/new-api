import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ImageStudioApiDocsButton } from '../api-docs-button'

function renderDocs() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ImageStudioApiDocsButton />
    </QueryClientProvider>
  )
}

async function openDocs() {
  const user = userEvent.setup()
  renderDocs()
  await user.click(screen.getByRole('button', { name: 'Image API docs' }))
  const dialog = await screen.findByRole('dialog', { name: 'Image API docs' })
  return { user, dialog }
}

test('opening the docs lists the four image endpoints and starts on image generation', async () => {
  const { dialog } = await openDocs()

  const nav = await within(dialog).findByRole('navigation', {
    name: 'Image API endpoints',
  })
  const endpoints = within(nav).getAllByRole('button')
  expect(endpoints.map((button) => button.textContent)).toEqual([
    'Gemini native formatPOST',
    'OpenAI chat formatPOST',
    'Edit imagesPOST',
    'Generate imagesPOST',
  ])
  expect(
    within(nav).getByRole('button', { name: /Generate images/ })
  ).toHaveAttribute('aria-current', 'page')
  expect(within(dialog).getByText('/v1/images/generations')).toBeVisible()
})

test('the generation reference documents gpt-image-2.6 quality tiers and SVG/GIF output', async () => {
  const { dialog } = await openDocs()

  expect(
    await within(dialog).findByText(
      /gpt-image-2.5 and gpt-image-2.6 also accept xhigh and max/
    )
  ).toBeVisible()
  expect(within(dialog).getByText('frame_count')).toBeVisible()
  expect(within(dialog).getByText('frame_duration_ms')).toBeVisible()
  expect(
    within(dialog).getByRole('cell', {
      name: 'png, jpeg, webp, svg, gif',
    })
  ).toBeVisible()
})

test('choosing the edit endpoint shows its multipart contract', async () => {
  const { user, dialog } = await openDocs()

  await user.click(
    await within(dialog).findByRole('button', { name: /Edit images/ })
  )

  expect(within(dialog).getByText('/v1/images/edits')).toBeVisible()
  expect(within(dialog).getByText('multipart/form-data')).toBeVisible()
  expect(within(dialog).getByText('mask')).toBeVisible()
})

test('choosing the Gemini endpoint shows its model path parameter', async () => {
  const { user, dialog } = await openDocs()

  await user.click(
    await within(dialog).findByRole('button', { name: /Gemini native format/ })
  )

  expect(
    within(dialog).getByText('/v1beta/models/{model}:generateContent')
  ).toBeVisible()
  expect(within(dialog).getByText('Path Parameters')).toBeVisible()
  expect(within(dialog).getByText('generationConfig')).toBeVisible()
})
