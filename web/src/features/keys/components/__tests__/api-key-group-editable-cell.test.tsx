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
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createTestWrapper } from '@/test/test-utils'

import { updateApiKey } from '../../api'
import type { ApiKey } from '../../types'
import { ApiKeyGroupEditableCell } from '../api-key-group-editable-cell'
import type { ApiKeyGroupOption } from '../api-key-group-combobox'

vi.mock('../../api', () => ({
  updateApiKey: vi.fn(),
}))

const mockTriggerRefresh = vi.fn()
vi.mock('../api-keys-provider', () => ({
  useApiKeys: () => ({
    triggerRefresh: mockTriggerRefresh,
  }),
}))

describe('ApiKeyGroupEditableCell', () => {
  const mockApiKey: ApiKey = {
    id: 1,
    name: 'Test Key',
    key: 'sk-test123',
    status: 1,
    remain_quota: 1000,
    used_quota: 500,
    unlimited_quota: false,
    expired_time: -1,
    created_time: 1704067200,
    accessed_time: 1704067200,
    group: 'default',
    auto_groups: null,
    cross_group_retry: false,
    model_limits_enabled: false,
    model_limits: '',
    allow_ips: '',
  }

  const mockGroupOptions: ApiKeyGroupOption[] = [
    { value: 'default', label: 'default', desc: 'Default Group', ratio: 1 },
    { value: 'premium', label: 'premium', desc: 'Premium Group', ratio: 1.5 },
    { value: 'auto', label: 'auto', desc: 'Auto Group' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该渲染当前分组', () => {
    render(
      <ApiKeyGroupEditableCell
        apiKey={mockApiKey}
        groupOptions={mockGroupOptions}
        ratio={1}
        shouldReduceMotion={false}
      />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('default')).toBeInTheDocument()
  })

  it('应该在点击时打开下拉菜单', async () => {
    const user = userEvent.setup()
    render(
      <ApiKeyGroupEditableCell
        apiKey={mockApiKey}
        groupOptions={mockGroupOptions}
        ratio={1}
        shouldReduceMotion={false}
      />,
      { wrapper: createTestWrapper() }
    )

    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    })

    expect(screen.getByText('Default Group')).toBeInTheDocument()
    expect(screen.getByText('Premium Group')).toBeInTheDocument()
  })

  it('应该支持搜索过滤分组选项', async () => {
    const user = userEvent.setup()
    render(
      <ApiKeyGroupEditableCell
        apiKey={mockApiKey}
        groupOptions={mockGroupOptions}
        ratio={1}
        shouldReduceMotion={false}
      />,
      { wrapper: createTestWrapper() }
    )

    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    const searchInput = await screen.findByPlaceholderText('Search...')
    await user.type(searchInput, 'premium')

    await waitFor(() => {
      expect(screen.getByText('Premium Group')).toBeInTheDocument()
      expect(screen.queryByText('Default Group')).not.toBeInTheDocument()
    })
  })

  it('应该在选择新分组时调用更新 API', async () => {
    const user = userEvent.setup()
    vi.mocked(updateApiKey).mockResolvedValue({
      success: true,
      data: { ...mockApiKey, group: 'premium' },
    })

    render(
      <ApiKeyGroupEditableCell
        apiKey={mockApiKey}
        groupOptions={mockGroupOptions}
        ratio={1}
        shouldReduceMotion={false}
      />,
      { wrapper: createTestWrapper() }
    )

    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    const premiumOption = await screen.findByText('Premium Group')
    await user.click(premiumOption)

    await waitFor(() => {
      expect(updateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          group: 'premium',
        })
      )
    })

    expect(mockTriggerRefresh).toHaveBeenCalled()
  })

  it('应该在选择相同分组时不调用更新 API', async () => {
    const user = userEvent.setup()
    render(
      <ApiKeyGroupEditableCell
        apiKey={mockApiKey}
        groupOptions={mockGroupOptions}
        ratio={1}
        shouldReduceMotion={false}
      />,
      { wrapper: createTestWrapper() }
    )

    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    const defaultOption = await screen.findByText('Default Group')
    await user.click(defaultOption)

    await waitFor(() => {
      expect(updateApiKey).not.toHaveBeenCalled()
    })
  })

  it('应该为 auto 分组显示特殊的跨组重试标识', () => {
    const autoApiKey = { ...mockApiKey, group: 'auto' }
    render(
      <ApiKeyGroupEditableCell
        apiKey={autoApiKey}
        groupOptions={mockGroupOptions}
        shouldReduceMotion={false}
      />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.getByText('Cross-group')).toBeInTheDocument()
  })

  it('应该在更新失败时显示错误提示', async () => {
    const user = userEvent.setup()
    vi.mocked(updateApiKey).mockResolvedValue({
      success: false,
      message: 'Update failed',
    })

    render(
      <ApiKeyGroupEditableCell
        apiKey={mockApiKey}
        groupOptions={mockGroupOptions}
        ratio={1}
        shouldReduceMotion={false}
      />,
      { wrapper: createTestWrapper() }
    )

    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    const premiumOption = await screen.findByText('Premium Group')
    await user.click(premiumOption)

    await waitFor(() => {
      expect(updateApiKey).toHaveBeenCalled()
    })

    expect(mockTriggerRefresh).not.toHaveBeenCalled()
  })
})
