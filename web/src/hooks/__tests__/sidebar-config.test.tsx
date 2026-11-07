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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkIsActive } from '@/components/layout/lib/url-utils'
import { invalidateModelPricing } from '@/features/model-pricing/api'
import {
  parseHeaderNavModules,
  parseSidebarModulesAdmin,
  serializeHeaderNavModules,
  serializeSidebarModulesAdmin,
} from '@/features/system-settings/maintenance/config'
import {
  MODEL_PRICING_ISSUES_QUERY_KEY,
  type ModelPricingIssue,
} from '@/features/system-settings/models/pricing-issues'
import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  useIsSidebarModuleVisible,
  useSidebarConfig,
} from '../use-sidebar-config'
import { useSidebarData } from '../use-sidebar-data'
import { useSidebarView } from '../use-sidebar-view'

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useAuthStore.getState().auth.reset()
})

function sidebarFor(admin?: object, user?: object, canConfigure = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {
    SidebarModulesAdmin: admin ? JSON.stringify(admin) : '',
  })
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'alice',
    role: 1,
    permissions: { sidebar_settings: canConfigure },
    sidebar_modules: user ? JSON.stringify(user) : '',
  })
  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )
  }
  const result = renderHook(
    () => useSidebarConfig(useSidebarData().navGroups),
    { wrapper: Wrapper }
  )
  return result
}

describe('status monitor navigation settings', () => {
  it('moves status monitoring out of the sidebar even with legacy settings', () => {
    const legacy = parseSidebarModulesAdmin(
      '{"console":{"enabled":true,"statusMonitor":true}}'
    )
    const { result } = sidebarFor(legacy)
    expect(
      result.current
        .flatMap((group) => group.items)
        .some((item) => item.title === 'Status Monitor')
    ).toBe(false)
    expect(
      JSON.parse(serializeSidebarModulesAdmin(legacy)).console.statusMonitor
    ).toBeUndefined()
  })

  it('defaults to public access and preserves login and visibility settings when saved', () => {
    const config = parseHeaderNavModules('{"pricing":true}')
    expect(config.statusMonitor).toEqual({ enabled: true, requireAuth: false })
    config.statusMonitor = { enabled: true, requireAuth: true }
    expect(
      parseHeaderNavModules(serializeHeaderNavModules(config)).statusMonitor
    ).toEqual({ enabled: true, requireAuth: true })
    config.statusMonitor.enabled = false
    expect(
      parseHeaderNavModules(serializeHeaderNavModules(config)).statusMonitor
    ).toEqual({ enabled: false, requireAuth: true })
  })
})

describe('workbench navigation settings', () => {
  it.each([
    undefined,
    { chat: { enabled: true, playground: true, chat: true } },
  ])(
    'hides workbench tools by default and removes legacy chat entries (%j)',
    (admin) => {
      const { result } = sidebarFor(admin)
      expect(result.current.map((group) => group.id)).not.toContain('workbench')
      expect(result.current.map((group) => group.id)).not.toContain('chat')
      expect(
        result.current.flatMap((group) => group.items).map((item) => item.title)
      ).not.toContain('Playground')
    }
  )

  it('shows only enabled tools between General and Personal and preserves settings when saved', () => {
    const config = parseSidebarModulesAdmin(
      '{"chat":{"enabled":true,"chat":true}}'
    )
    config.workbench = { enabled: true, chat: true, image: true, video: false }
    const saved = parseSidebarModulesAdmin(serializeSidebarModulesAdmin(config))
    expect(saved.chat).toBeUndefined()
    const { result } = sidebarFor(saved)
    const groups = result.current.map((group) => group.id)
    expect(groups.indexOf('workbench')).toBe(groups.indexOf('general') + 1)
    expect(groups.indexOf('personal')).toBe(groups.indexOf('workbench') + 1)
    expect(
      result.current.find((group) => group.id === 'workbench')?.items
    ).toMatchObject([
      { title: 'AI Chat', url: '/playground' },
      { title: 'Image Studio', url: '/workbench/image' },
    ])
  })

  it('allows personal preferences to hide tools without enabling admin-disabled tools', () => {
    const { result } = sidebarFor(
      { workbench: { enabled: true, chat: true, image: false, video: true } },
      { workbench: { enabled: true, chat: false, image: true, video: true } }
    )
    expect(
      result.current.find((group) => group.id === 'workbench')?.items
    ).toMatchObject([{ title: 'Video Studio', url: '/workbench/video' }])
  })

  it('keeps the whole workbench hidden when its section is disabled', () => {
    const { result } = sidebarFor(
      { workbench: { enabled: false, chat: true, image: true, video: true } },
      { workbench: { enabled: true, chat: true, image: true, video: true } }
    )
    expect(result.current.map((group) => group.id)).not.toContain('workbench')
  })
})

describe('profile and security sidebar visibility', () => {
  it('old configurations keep the consolidated Profile entry and API Keys without a separate security entry', () => {
    const { result } = sidebarFor(
      { personal: { enabled: true, personal: true, topup: true } },
      { personal: { enabled: true, personal: true } }
    )
    expect(
      result.current
        .find((group) => group.id === 'personal')
        ?.items.map((item) => item.title)
    ).toEqual(['Wallet', 'Buy Redemption Codes', 'Profile', 'My Tickets'])
    expect(
      result.current
        .flatMap((group) => group.items)
        .some((item) => item.title === 'API Keys')
    ).toBe(true)
  })
  it.each([
    [{ personal: { enabled: true, personal: false } }, undefined],
    [{ personal: { enabled: false } }, { personal: { personal: true } }],
    [undefined, { personal: { enabled: true, personal: false } }],
    [undefined, { personal: { enabled: false } }],
  ])(
    'admin or user disablement hides the consolidated Profile entry (%j, %j)',
    (admin, user) => {
      const { result } = sidebarFor(admin, user)
      expect(
        result.current
          .flatMap((group) => group.items)
          .some((item) => item.url === '/profile')
      ).toBe(false)
    }
  )
  it.each([
    [{ personal: { security: false } }, undefined],
    [undefined, { personal: { security: false } }],
  ])('legacy security flags do not hide Profile (%j, %j)', (admin, user) => {
    const { result } = sidebarFor(admin, user)
    expect(
      result.current
        .flatMap((group) => group.items)
        .find((item) => item.url === '/profile')
    ).toMatchObject({ title: 'Profile', url: '/profile' })
  })
  it('users without sidebar configuration permission retain the admin view', () => {
    const { result } = sidebarFor(
      undefined,
      { personal: { enabled: false, personal: false, security: false } },
      false
    )
    expect(
      result.current
        .flatMap((group) => group.items)
        .find((item) => item.url === '/profile')
    ).toMatchObject({ title: 'Profile', url: '/profile' })
  })
})

describe('redemption store sidebar entry', () => {
  it('keeps the store toggle in the admin sidebar settings and preserves it when saved', () => {
    const config = parseSidebarModulesAdmin(
      '{"personal":{"enabled":true,"topup":true}}'
    )
    expect(config.personal.store).toBe(true)
    config.personal.store = false
    expect(
      parseSidebarModulesAdmin(serializeSidebarModulesAdmin(config)).personal
        .store
    ).toBe(false)
  })

  it('shows the store entry by default and hides it when the admin disables it', () => {
    const enabled = sidebarFor(undefined)
    expect(
      enabled.result.current
        .flatMap((group) => group.items)
        .find((item) => item.url === '/wallet/store')
    ).toMatchObject({ title: 'Buy Redemption Codes' })

    const disabled = sidebarFor({ personal: { enabled: true, store: false } })
    expect(
      disabled.result.current
        .flatMap((group) => group.items)
        .some((item) => item.url === '/wallet/store')
    ).toBe(false)
  })

  it('keeps the store entry hidden when the user hides it in personal settings', () => {
    const { result } = sidebarFor(
      { personal: { enabled: true, topup: true, store: true } },
      { personal: { enabled: true, store: false } }
    )
    const urls = result.current
      .flatMap((group) => group.items)
      .map((item) => item.url)
    expect(urls).toContain('/wallet')
    expect(urls).not.toContain('/wallet/store')
  })

  it('reports store visibility for entries outside the sidebar', () => {
    function visibility(admin?: object, user?: object) {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      client.setQueryData(['status'], {
        SidebarModulesAdmin: admin ? JSON.stringify(admin) : '',
      })
      useAuthStore.getState().auth.setUser({
        id: 1,
        username: 'alice',
        role: 1,
        permissions: { sidebar_settings: true },
        sidebar_modules: user ? JSON.stringify(user) : '',
      })
      function Wrapper(props: { children: ReactNode }) {
        return (
          <QueryClientProvider client={client}>
            {props.children}
          </QueryClientProvider>
        )
      }
      return renderHook(() => useIsSidebarModuleVisible('/wallet/store'), {
        wrapper: Wrapper,
      }).result.current
    }

    expect(visibility()).toBe(true)
    expect(visibility({ personal: { enabled: true, store: false } })).toBe(
      false
    )
    expect(visibility(undefined, { personal: { store: false } })).toBe(false)
    expect(
      visibility(
        { personal: { enabled: false, store: true } },
        { personal: { enabled: true, store: true } }
      )
    ).toBe(false)
  })
})

describe('audit log sidebar entry', () => {
  it('admin settings default Audit Logs to visible and preserve its independent toggle when saved', () => {
    const config = parseSidebarModulesAdmin(
      '{"console":{"enabled":true,"log":true}}'
    )
    expect(config.console.audit).toBe(true)
    config.console.audit = false
    const saved = parseSidebarModulesAdmin(serializeSidebarModulesAdmin(config))
    const { result } = sidebarFor(saved)
    const titles = result.current
      .flatMap((group) => group.items)
      .map((item) => item.title)
    expect(titles).not.toContain('Audit Logs')
    expect(titles).toContain('Usage Logs')
  })

  it('legacy configurations show a separate Audit Logs link immediately after Usage Logs', () => {
    const { result } = sidebarFor(
      { console: { enabled: true, log: true } },
      { console: { enabled: true, log: true } }
    )
    const items =
      result.current.find((group) => group.id === 'general')?.items ?? []
    const usageIndex = items.findIndex((item) => item.title === 'Usage Logs')
    expect(items[usageIndex + 1]).toMatchObject({
      title: 'Audit Logs',
      url: '/usage-logs/audit',
    })
    const selected = items.filter((item) =>
      checkIsActive('/usage-logs/audit', item)
    )
    expect(selected.map((item) => item.title)).toEqual(['Audit Logs'])
  })

  it.each([
    [{ console: { enabled: true, audit: false } }, undefined],
    [{ console: { enabled: false } }, { console: { audit: true } }],
    [undefined, { console: { enabled: true, audit: false } }],
    [undefined, { console: { enabled: false } }],
  ])(
    'admin and personal visibility rules can hide Audit Logs (%j, %j)',
    (admin, user) => {
      const { result } = sidebarFor(admin, user)
      expect(
        result.current
          .flatMap((group) => group.items)
          .some((item) => item.title === 'Audit Logs')
      ).toBe(false)
    }
  )

  it('hiding Usage Logs does not hide the independently configured Audit Logs entry', () => {
    const { result } = sidebarFor({ console: { enabled: true, log: false } })
    const titles = result.current
      .flatMap((group) => group.items)
      .map((item) => item.title)
    expect(titles).not.toContain('Usage Logs')
    expect(titles).toContain('Audit Logs')
  })
})

describe('model pricing badge', () => {
  function issue(modelName: string, pluginKey: string): ModelPricingIssue {
    return {
      model_name: modelName,
      plugin_key: pluginKey,
      plugin_name: pluginKey,
      reason: 'unconfigured',
    }
  }

  /** Lists the sidebar entries of the current view that carry a badge. */
  function BadgedEntries() {
    const { navGroups } = useSidebarView()
    const entries = navGroups
      .flatMap((group) => group.items)
      .flatMap((item) => [item, ...(item.items ?? [])])
      .filter((item) => item.badge)
    return (
      <ul aria-label='Badged entries'>
        {entries.map((item) => (
          <li key={item.title}>{`${item.title}: ${item.badge}`}</li>
        ))}
      </ul>
    )
  }

  async function renderSidebar(
    path: string,
    role: number,
    issues: () => ModelPricingIssue[]
  ) {
    const get = vi.spyOn(api, 'get').mockImplementation(async (url) => ({
      data: {
        success: true,
        data: url === '/api/option/model_pricing/issues' ? issues() : {},
      },
    }))
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    client.setQueryData(['status'], { SidebarModulesAdmin: '' })
    useAuthStore.getState().auth.setUser({ id: 1, username: 'root', role })
    const router = createRouter({
      routeTree: createRootRoute({ component: BadgedEntries }),
      history: createMemoryHistory({ initialEntries: [path] }),
    })
    await router.load()
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    return { client, get }
  }

  function badgedEntries() {
    return screen
      .getByRole('list', { name: 'Badged entries' })
      .querySelectorAll('li')
  }

  it('counts each task model once on the System Settings entry of the main sidebar', async () => {
    await renderSidebar('/dashboard/overview', ROLE.SUPER_ADMIN, () => [
      issue('kling-v3', 'kling'),
      issue('shared-video', 'alpha'),
      issue('shared-video', 'beta'),
    ])

    expect(await screen.findByText('System Settings: 2')).toBeInTheDocument()
    expect(badgedEntries()).toHaveLength(1)
  })

  it('inside System Settings shows the count on Billing & Payment and Model Pricing', async () => {
    await renderSidebar('/system-settings/site', ROLE.SUPER_ADMIN, () => [
      issue('kling-v3', 'kling'),
    ])

    expect(await screen.findByText('Model Pricing: 1')).toBeInTheDocument()
    expect(screen.getByText('Billing & Payment: 1')).toBeInTheDocument()
    expect(badgedEntries()).toHaveLength(2)
  })

  it('follows plugin changes and saved prices without a page reload', async () => {
    let issues = [issue('kling-v3', 'kling')]
    const { client } = await renderSidebar(
      '/dashboard/overview',
      ROLE.SUPER_ADMIN,
      () => issues
    )
    await screen.findByText('System Settings: 1')

    // A plugin action refreshes the count it may have changed.
    issues = [issue('kling-v3', 'kling'), issue('vidu-q3', 'vidu')]
    await act(() =>
      client.invalidateQueries({ queryKey: MODEL_PRICING_ISSUES_QUERY_KEY })
    )
    expect(await screen.findByText('System Settings: 2')).toBeInTheDocument()

    // Every pricing save runs this invalidation.
    issues = []
    await act(() => invalidateModelPricing(client))
    await waitFor(() => expect(badgedEntries()).toHaveLength(0))
  })

  it('never asks for the count below the super administrator role', async () => {
    const { get } = await renderSidebar(
      '/dashboard/overview',
      ROLE.ADMIN,
      () => [issue('kling-v3', 'kling')]
    )

    expect(
      await screen.findByRole('list', { name: 'Badged entries' })
    ).toBeInTheDocument()
    expect(get).not.toHaveBeenCalledWith('/api/option/model_pricing/issues')
    expect(badgedEntries()).toHaveLength(0)
  })
})
