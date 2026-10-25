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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  findInvalidIQModels,
  normalizeIQModelList,
} from '@/features/system-settings/models/iq-group-models'
import {
  parseIQPromptConfig,
  validateIQPromptConfig,
} from '@/features/system-settings/request-policies/iq-prompts'
import { api } from '@/lib/api'

import { IQMonitor } from '..'
import { buildSandboxedDocument, IQ_PREVIEW_CSP } from '../lib/html'
import type { IQMonitorOverview, IQProbeResult } from '../types'

vi.mock('@/components/layout', () => ({
  PublicLayout: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
}))

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${IQ_PREVIEW_CSP}">`

function result(id: number, overrides: Partial<IQProbeResult> = {}) {
  return {
    id,
    group_name: 'vip',
    model_name: 'gpt-5.1[high]',
    code: 'IQ-ABCD2345',
    prompt_title: `Prompt ${id}`,
    source: 'auto',
    success: true,
    verdict: 'normal',
    verdict_reasons: '',
    error_message: '',
    html_bytes: 2048,
    latency_ms: 12000,
    prompt_tokens: 80,
    completion_tokens: 3000,
    reasoning_tokens: 900,
    created_at: 1789387200 + id,
    ...overrides,
  } satisfies IQProbeResult
}

function overview(canRun: boolean, canDelete = false): IQMonitorOverview {
  const latest = result(2, {
    verdict: 'suspect',
    verdict_reasons: 'html_drop',
  })
  return {
    auto_enabled: true,
    interval_minutes: 30,
    running: false,
    can_run: canRun,
    can_delete: canDelete,
    groups: [
      {
        group: 'vip',
        description: 'Premium access',
        models: [
          { model: 'gpt-5.1[high]', latest, history: [latest, result(1)] },
        ],
      },
    ],
  }
}

function renderPage(data: IQMonitorOverview) {
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/iq-monitor') return { data: { success: true, data } }
    const id = Number(url.split('/').pop())
    return {
      data: {
        success: true,
        data: { ...result(id), prompt: 'Draw a pelican', html: '<svg/>' },
      },
    }
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <IQMonitor />
    </QueryClientProvider>
  )
  return client
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('IQ preview sandbox', () => {
  it('places the network-blocking CSP before any generated head content', () => {
    expect(
      buildSandboxedDocument(
        '<!DOCTYPE html><html lang="en"><head><script>x()</script></head></html>'
      )
    ).toBe(
      `<!DOCTYPE html><html lang="en"><head>${CSP_META}<script>x()</script></head></html>`
    )
    expect(buildSandboxedDocument('<html><body><svg/></body></html>')).toBe(
      `<html><head>${CSP_META}</head><body><svg/></body></html>`
    )
    const bare = buildSandboxedDocument('<svg><circle/></svg>')
    expect(bare.indexOf(CSP_META)).toBeLessThan(bare.indexOf('<svg>'))
    expect(IQ_PREVIEW_CSP).toContain("default-src 'none'")
    expect(IQ_PREVIEW_CSP).not.toMatch(/connect-src|https?:/)
  })
})

describe('IQ monitor settings helpers', () => {
  it('accepts model[thinking level] pools and reports malformed entries', () => {
    expect(normalizeIQModelList(' gpt-5.1[high] , ,claude-sonnet ')).toBe(
      'gpt-5.1[high],claude-sonnet'
    )
    expect(
      findInvalidIQModels('gpt-5.1[high],o3[XHIGH],claude-sonnet')
    ).toEqual([])
    expect(
      findInvalidIQModels('gpt-5.1[turbo],gpt 5,gpt-5@effort:high,gpt[high')
    ).toEqual(['gpt-5.1[turbo]', 'gpt 5', 'gpt-5@effort:high', 'gpt[high'])
  })

  it('parses the prompt config and drops blank or non-string pool entries', () => {
    expect(
      parseIQPromptConfig(
        '{"template":"{{code}}","animals":["fox"," ",3],"scenes":["space"]}'
      )
    ).toEqual({
      template: '{{code}}',
      animals: ['fox'],
      scenes: ['space'],
      styles: [],
    })
    expect(parseIQPromptConfig('[]')).toEqual({
      template: '',
      animals: [],
      scenes: [],
      styles: [],
    })
  })

  it('rejects prompt configs without a code placeholder or with an empty pool', () => {
    const valid = {
      template: 'Draw a {{animal}} titled {{code}}',
      animals: ['fox'],
      scenes: ['space'],
      styles: ['pixel'],
    }
    expect(validateIQPromptConfig(valid)).toBeNull()
    expect(
      validateIQPromptConfig({ ...valid, template: 'Draw a {{animal}}' })?.key
    ).toBe('Prompt template must contain {{placeholder}}')
    expect(validateIQPromptConfig({ ...valid, styles: [] })?.key).toBe(
      'Each word pool needs 1-{{max}} entries'
    )
  })
})

describe('IQ monitor page', () => {
  it('shows the latest verdict with history and lets admins probe one model', async () => {
    const user = userEvent.setup()
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, data: { task_id: 't1', created: true } },
    })
    const client = renderPage(overview(true))
    try {
      expect(
        await screen.findByRole('heading', { name: 'gpt-5.1[high]' })
      ).toBeVisible()
      expect(screen.getByText('Last 2 probes')).toBeVisible()
      expect(
        await screen.findByTitle('Rendered output of gpt-5.1[high]')
      ).toHaveAttribute('sandbox', 'allow-scripts')

      await user.click(screen.getByRole('button', { name: 'Probe this model' }))
      await waitFor(() =>
        expect(post).toHaveBeenCalledWith('/api/iq-monitor/run', {
          group: 'vip',
          model: 'gpt-5.1[high]',
        })
      )
      expect(
        screen.getByRole('button', { name: 'Probe all groups' })
      ).toBeVisible()
    } finally {
      client.clear()
    }
  })

  it('opens a history record in a detail dialog and hides admin actions from visitors', async () => {
    const user = userEvent.setup()
    const client = renderPage(overview(false))
    try {
      await user.click(await screen.findByRole('button', { name: /Prompt 1/ }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('vip · Prompt 1')).toBeVisible()
      expect(await within(dialog).findByText('Draw a pelican')).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'Probe this model' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Probe all groups' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Delete record' })
      ).not.toBeInTheDocument()
    } finally {
      client.clear()
    }
  })

  it('lets a super administrator delete one history record after confirmation', async () => {
    const user = userEvent.setup()
    const del = vi.spyOn(api, 'delete').mockResolvedValue({
      data: { success: true, data: { id: 1 } },
    })
    const client = renderPage(overview(true, true))
    try {
      const deleteButtons = await screen.findAllByRole('button', {
        name: 'Delete record',
      })
      expect(deleteButtons).toHaveLength(2)

      await user.click(deleteButtons[1])
      const dialog = await screen.findByRole('alertdialog', {
        name: 'Delete this record?',
      })
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      await waitFor(() =>
        expect(del).toHaveBeenCalledWith('/api/iq-monitor/results/1')
      )
      expect(del).toHaveBeenCalledTimes(1)
    } finally {
      client.clear()
    }
  })
})
