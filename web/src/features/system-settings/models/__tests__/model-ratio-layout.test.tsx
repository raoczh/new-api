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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { ModelRatioVisualEditor } from '../model-ratio-visual-editor'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

async function renderEditor() {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/pricing') {
      return { data: { success: true, data: [], vendors: [] } }
    }
    return { data: { success: true, data: {} } }
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const modelRatio = JSON.stringify({
    'gpt-4.1-mini': 0.2,
    'claude-sonnet': 1.5,
  })
  render(
    <QueryClientProvider client={client}>
      <ModelRatioVisualEditor
        savedModelPrice='{}'
        savedModelRatio={modelRatio}
        savedCacheRatio='{}'
        savedCreateCacheRatio='{}'
        savedCompletionRatio='{}'
        savedImageRatio='{}'
        savedAudioRatio='{}'
        savedAudioCompletionRatio='{}'
        savedBillingMode='{}'
        savedBillingExpr='{}'
        modelPrice='{}'
        modelRatio={modelRatio}
        cacheRatio='{}'
        createCacheRatio='{}'
        completionRatio='{}'
        imageRatio='{}'
        audioRatio='{}'
        audioCompletionRatio='{}'
        billingMode='{}'
        billingExpr='{}'
        onChange={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
      />
    </QueryClientProvider>
  )
  await waitFor(() => expect(client.isFetching()).toBe(0))
  await screen.findByRole('row', { name: /gpt-4\.1-mini/ })
  return screen.getByRole('region', { name: 'Model prices' })
}

function getColumnIds() {
  return screen
    .getAllByRole('columnheader')
    .map((header) => header.getAttribute('data-column-id'))
}

function getColgroupClassNames() {
  const table = screen.getByRole('table')
  return Array.from(table.querySelectorAll('colgroup > col')).map(
    (col) => col.className
  )
}

it('gives the model name the remaining width and keeps the action column compact', async () => {
  const workspace = await renderEditor()
  expect(workspace).toHaveClass(
    'md:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]'
  )

  const table = screen.getByRole('table')
  expect(table).toHaveClass('table-fixed', 'min-w-[720px]')
  expect(getColumnIds()).toEqual([
    'select',
    'name',
    'billingMode',
    'priceSummary',
    'actions',
  ])
  expect(getColgroupClassNames()).toEqual([
    'w-10',
    '',
    'w-[132px]',
    'w-[220px]',
    'w-[84px]',
  ])
})

it('keeps the colgroup aligned with the visible columns when a column is hidden', async () => {
  localStorage.setItem(
    'model-ratio-column-visibility',
    JSON.stringify({ billingMode: false })
  )
  await renderEditor()

  expect(getColumnIds()).toEqual(['select', 'name', 'priceSummary', 'actions'])
  expect(getColgroupClassNames()).toEqual([
    'w-10',
    '',
    'w-[220px]',
    'w-[84px]',
  ])
})
