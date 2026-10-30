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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ListChecks,
  TerminalSquare,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { usePrimaryApiAddress } from '@/features/keys/hooks/use-api-addresses'
import type { ApiKey } from '@/features/keys/types'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getUserModels } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { ROLE } from '@/lib/roles'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { useModelDistribution } from '../../hooks/use-model-distribution'
import { useTokenUsage } from '../../hooks/use-token-usage'
import { PerformanceOverview } from '../models/performance-overview'
import { ModelDistributionChart } from './model-distribution-chart'
import { SummaryCards } from './summary-cards'
import { TokenUsageChart } from './token-usage-chart'

const SETUP_GUIDE_VISIBILITY_STORAGE_KEY =
  'dashboard_overview_setup_guide_expanded'

type DashboardActionPath = '/keys' | '/wallet' | '/playground'

interface StartStep {
  title: string
  description: string
  to: DashboardActionPath
  completed: boolean
}

interface RequestExample {
  endpoint: string
  model: string
  keyName: string
  keyId?: number
  displayKey: string
  ready: boolean
}

function getSavedSetupGuideExpanded(): boolean | null {
  if (typeof window === 'undefined') return null
  const saved = window.localStorage.getItem(SETUP_GUIDE_VISIBILITY_STORAGE_KEY)
  if (saved === 'expanded') return true
  if (saved === 'collapsed') return false
  return null
}

function saveSetupGuideExpanded(expanded: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    SETUP_GUIDE_VISIBILITY_STORAGE_KEY,
    expanded ? 'expanded' : 'collapsed'
  )
}

function getCurrentOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

/**
 * Turn a configured API address into the endpoint shown in the setup guide.
 *
 * The address comes from `api_info`, which the administrator configures as-is,
 * so an entry already ending in `/v1` is completed rather than rewritten. Only
 * addresses that carry no version segment get one appended.
 */
function resolveChatCompletionsEndpoint(address?: string): string {
  const trimmed = address?.trim().replace(/\/+$/, '')
  if (!trimmed) return `${getCurrentOrigin()}/v1/chat/completions`

  if (trimmed.endsWith('/chat/completions')) return trimmed
  return trimmed.endsWith('/v1')
    ? `${trimmed}/chat/completions`
    : `${trimmed}/v1/chat/completions`
}

function getPreferredKey(keys: ApiKey[]): ApiKey | null {
  return keys.find((item) => item.status === 1) ?? keys[0] ?? null
}

function formatDisplayKey(key?: string): string {
  if (!key) return 'sk-...'
  if (key.length <= 14) return key
  return `${key.slice(0, 7)}...${key.slice(-4)}`
}

function buildCurlCommand(args: {
  endpoint: string
  apiKey: string
  model: string
}): string {
  return [
    `curl ${args.endpoint} \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "Authorization: Bearer ${args.apiKey}" \\`,
    `  -d '{"model":"${args.model}","messages":[{"role":"user","content":"Say hello in one sentence."}]}'`,
  ].join('\n')
}

function SetupStep(props: { step: StartStep; index: number }) {
  return (
    <Link
      to={props.step.to}
      className='group border-border/70 bg-card hover:bg-muted/40 focus-visible:ring-ring flex min-w-0 items-start gap-3 rounded-lg border p-3 text-left shadow-xs transition-colors outline-none focus-visible:ring-2'
    >
      <span
        className={cn(
          'bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums',
          props.step.completed && 'border-success/30 bg-success/10 text-success'
        )}
      >
        {props.step.completed ? (
          <Check className='size-4' aria-hidden='true' />
        ) : (
          props.index + 1
        )}
      </span>
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='truncate text-sm font-medium'>{props.step.title}</span>
        <span className='text-muted-foreground line-clamp-2 text-xs leading-relaxed'>
          {props.step.description}
        </span>
      </span>
      <ArrowRight
        className='text-muted-foreground mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-0.5'
        aria-hidden='true'
      />
    </Link>
  )
}

function RequestPreview(props: { example: RequestExample }) {
  const { t } = useTranslation()
  const [isCopying, setIsCopying] = useState(false)
  const { copyToClipboard } = useCopyToClipboard({ notify: false })
  const previewCurl = buildCurlCommand({
    endpoint: props.example.endpoint,
    apiKey: props.example.displayKey,
    model: props.example.model,
  })
  const previewLines = previewCurl.split('\n')

  const handleCopyRequest = async () => {
    if (!props.example.keyId || isCopying) return

    setIsCopying(true)
    try {
      const result = await fetchTokenKey(props.example.keyId)
      const key = result.success && result.data?.key ? result.data.key : ''
      if (!key) {
        handleServerError(result, t('Failed to copy to clipboard'))
        return
      }

      const realCurl = buildCurlCommand({
        endpoint: props.example.endpoint,
        apiKey: `sk-${key}`,
        model: props.example.model,
      })
      const copied = await copyToClipboard(realCurl)
      if (copied) {
        toast.success(t('Copied to clipboard'))
      } else {
        toast.error(t('Failed to copy to clipboard'))
      }
    } catch (error) {
      handleServerError(error, t('Failed to copy to clipboard'))
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <div className='bg-muted/30 border-border/70 min-w-0 rounded-lg border p-3'>
      <div className='flex items-center justify-between gap-3 border-b pb-2.5'>
        <div className='flex min-w-0 items-center gap-2'>
          <IconBadge tone='info' size='sm'>
            <TerminalSquare />
          </IconBadge>
          <div className='min-w-0'>
            <div className='truncate text-sm font-medium'>
              {t('First API request')}
            </div>
            <div className='text-muted-foreground truncate text-xs'>
              {props.example.ready
                ? props.example.keyName
                : t('Create an API key to unlock the real request')}
            </div>
          </div>
        </div>
        {props.example.ready ? (
          <Button
            variant='outline'
            size='sm'
            className='h-7 shrink-0 gap-1.5 px-2 text-xs'
            disabled={isCopying}
            onClick={handleCopyRequest}
            aria-label={t('Copy ready-to-run curl')}
          >
            <Copy data-icon='inline-start' />
            {isCopying ? t('Loading') : t('Copy')}
          </Button>
        ) : (
          <Button
            size='sm'
            variant='outline'
            className='shrink-0'
            render={<Link to='/keys' />}
          >
            {t('Create API Key')}
          </Button>
        )}
      </div>

      <div className='bg-background/70 mt-2.5 rounded-md border p-2.5 font-mono text-[11px] leading-relaxed'>
        <div className='mb-2 flex items-center gap-1.5'>
          <span className='bg-destructive size-1.5 rounded-full' />
          <span className='bg-warning size-1.5 rounded-full' />
          <span className='bg-success size-1.5 rounded-full' />
        </div>
        <div className='flex min-w-0 flex-col gap-1 overflow-hidden'>
          {previewLines.map((line) => (
            <code
              key={line}
              className='text-muted-foreground truncate'
              title={line}
            >
              {line}
            </code>
          ))}
        </div>
      </div>
    </div>
  )
}

export function OverviewDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const [guideExpanded, setGuideExpanded] = useState<boolean>(
    () => getSavedSetupGuideExpanded() ?? true
  )

  const timeRange = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const start = now - 24 * 3600
    return { start, end: now }
  }, [])

  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)

  // Administrators see whole-site throughput in the overview, matching the
  // totals shown by the admin dashboard rather than their own usage only.
  const tokenUsageQuery = useTokenUsage(timeRange.start, timeRange.end, isAdmin)
  const modelDistQuery = useModelDistribution(
    timeRange.start,
    timeRange.end,
    isAdmin
  )

  const requestCount = Number(user?.request_count ?? 0)
  const remainQuota = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)

  const apiKeysQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'api-keys'],
    queryFn: async () => {
      const result = requireServerSuccess(await getApiKeys({ p: 1, size: 10 }))
      return result.success ? (result.data?.items ?? []) : []
    },
    staleTime: 60 * 1000,
  })

  const modelsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'user-models'],
    queryFn: async () => {
      const result = requireServerSuccess(await getUserModels())
      return result.success ? (result.data ?? []) : []
    },
    staleTime: 5 * 60 * 1000,
  })

  const preferredKey = useMemo(
    () => getPreferredKey(apiKeysQuery.data ?? []),
    [apiKeysQuery.data]
  )

  const serverAddress = usePrimaryApiAddress().address

  const startSteps = useMemo<StartStep[]>(
    () => [
      {
        title: t('Create API Key'),
        description: t('Create a key for your app or service'),
        to: '/keys',
        completed: Boolean(preferredKey),
      },
      {
        title: t('Add credits'),
        description: t('Keep enough balance before production traffic'),
        to: '/wallet',
        completed: remainQuota > 0 || usedQuota > 0,
      },
      {
        title: t('Send a request'),
        description: t('Verify routing with Playground or your client'),
        to: '/playground',
        completed: requestCount > 0,
      },
    ],
    [preferredKey, remainQuota, requestCount, t, usedQuota]
  )

  const requestExample = useMemo<RequestExample>(() => {
    const endpoint = resolveChatCompletionsEndpoint(serverAddress)
    const model = modelsQuery.data?.[0] ?? 'gpt-4o-mini'
    const keyName = preferredKey?.name ?? t('No API key yet')
    const ready = Boolean(preferredKey?.id && model)

    return {
      endpoint,
      model,
      keyName,
      keyId: preferredKey?.id,
      displayKey: preferredKey
        ? formatDisplayKey(`sk-${preferredKey.key}`)
        : 'sk-...',
      ready,
    }
  }, [modelsQuery.data, preferredKey, serverAddress, t])

  const completedStepCount = startSteps.filter((step) => step.completed).length
  const setupComplete = completedStepCount === startSteps.length
  const setupStatusReady = apiKeysQuery.isFetched && Boolean(user)
  const showSetupGuide = setupStatusReady && !setupComplete && guideExpanded
  const showSetupSummary = setupStatusReady && !setupComplete && !guideExpanded

  const handleGuideToggle = () => {
    const nextExpanded = !guideExpanded
    setGuideExpanded(nextExpanded)
    saveSetupGuideExpanded(nextExpanded)
  }

  return (
    <div className='flex flex-col gap-4 sm:gap-5'>
      <SummaryCards
        tokenUsage={tokenUsageQuery.data}
        modelDistribution={modelDistQuery.data}
        usageLoading={tokenUsageQuery.isLoading || modelDistQuery.isLoading}
      />

      {isAdmin && <PerformanceOverview />}

      {showSetupGuide && (
        <Card className='gap-0 overflow-hidden p-0 shadow-(--tc-shadow-sm)'>
          <div className='border-border/70 border-b px-4 py-4 sm:px-5'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div className='flex min-w-0 flex-col gap-1'>
                <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
                  <ListChecks className='size-3.5' aria-hidden='true' />
                  {t('Get started')}
                </div>
                <h2 className='text-lg font-semibold tracking-tight'>
                  {t('Build on your API gateway in minutes')}
                </h2>
                <p className='text-muted-foreground max-w-xl text-sm leading-relaxed'>
                  {t(
                    'A focused home for keys, balance, routing, and service health.'
                  )}
                </p>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-muted-foreground bg-muted/40 rounded-md border px-2 py-1 text-xs tabular-nums'>
                  {t('Setup progress: {{completed}}/{{total}}', {
                    completed: completedStepCount,
                    total: startSteps.length,
                  })}
                </span>
                <Button variant='ghost' size='sm' onClick={handleGuideToggle}>
                  <ChevronUp data-icon='inline-start' />
                  {t('Hide setup guide')}
                </Button>
              </div>
            </div>
          </div>
          <div className='grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_22rem]'>
            <div className='grid content-start gap-2 sm:grid-cols-3 xl:grid-cols-1'>
              {startSteps.map((step, index) => (
                <SetupStep key={step.title} step={step} index={index} />
              ))}
            </div>
            <RequestPreview example={requestExample} />
          </div>
        </Card>
      )}

      {showSetupSummary && (
        <Card className='flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-(--tc-shadow-sm)'>
          <div className='flex min-w-0 items-center gap-3'>
            <IconBadge tone='chart-1' size='sm'>
              <ListChecks />
            </IconBadge>
            <div className='min-w-0'>
              <div className='flex items-center gap-2'>
                <h2 className='truncate text-sm font-semibold'>
                  {t('Setup guide')}
                </h2>
                <span className='text-muted-foreground bg-muted/40 rounded-md border px-2 py-0.5 text-xs tabular-nums'>
                  {t('Setup progress: {{completed}}/{{total}}', {
                    completed: completedStepCount,
                    total: startSteps.length,
                  })}
                </span>
              </div>
              <p className='text-muted-foreground line-clamp-1 text-xs'>
                {t('Setup guide is collapsed. Expand it anytime.')}
              </p>
            </div>
          </div>
          <Button
            variant='outline'
            size='sm'
            className='shrink-0'
            onClick={handleGuideToggle}
          >
            <ChevronDown data-icon='inline-start' />
            {t('Show setup guide')}
          </Button>
        </Card>
      )}

      <div className='grid gap-4 lg:grid-cols-2'>
        <ModelDistributionChart
          data={modelDistQuery.data}
          loading={modelDistQuery.isLoading}
        />
        <TokenUsageChart
          data={tokenUsageQuery.data}
          startTimestamp={timeRange.start}
          endTimestamp={timeRange.end}
          loading={tokenUsageQuery.isLoading}
        />
      </div>
    </div>
  )
}
