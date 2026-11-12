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
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { SettingsPageActionsPortal } from '@/features/system-settings/components/settings-page-context'
import { BILLING_SECTION_IDS } from '@/features/system-settings/billing/section-registry'
import { api } from '@/lib/api'

import { GroupManagement } from '..'

vi.mock('@/features/system-settings/models/ratio-settings-card', () => ({
  RatioSettingsCard: (props: {
    visibleTabs?: string[]
    groupDefaults: { GroupRatio: string; GroupGroupRatio: string }
  }) => (
    <div data-testid='group-editor'>
      <span data-testid='visible-tabs'>{JSON.stringify(props.visibleTabs)}</span>
      <span data-testid='group-ratio'>{props.groupDefaults.GroupRatio}</span>
      <span data-testid='special-ratio'>
        {props.groupDefaults.GroupGroupRatio}
      </span>
      {/* 保存按钮通过设置页插槽渲染，缺少容器时它会整块消失。 */}
      <SettingsPageActionsPortal>
        <button type='button'>Save group settings</button>
      </SettingsPageActionsPortal>
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <GroupManagement />
    </QueryClientProvider>
  )
}

it('edits groups on their own page with the loaded settings', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/option/') {
      return {
        data: {
          success: true,
          data: [
            { key: 'GroupRatio', value: '{"default":1,"vip":0.8}' },
            { key: 'GroupGroupRatio', value: '{"vip":{"default":0.5}}' },
          ],
        },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  })

  renderPage()

  expect(
    await screen.findByRole('heading', { name: 'Group Management' })
  ).toBeVisible()
  expect(await screen.findByTestId('group-ratio')).toHaveTextContent(
    '{"default":1,"vip":0.8}'
  )
  expect(screen.getByTestId('special-ratio')).toHaveTextContent(
    '{"vip":{"default":0.5}}'
  )
  // 只保留分组设置，模型定价仍然留在系统设置里。
  expect(screen.getByTestId('visible-tabs')).toHaveTextContent('["groups"]')
  expect(
    screen.getByRole('button', { name: 'Save group settings' })
  ).toBeVisible()
})

it('no longer offers group pricing inside billing settings', () => {
  expect(BILLING_SECTION_IDS).not.toContain('group-pricing')
})
