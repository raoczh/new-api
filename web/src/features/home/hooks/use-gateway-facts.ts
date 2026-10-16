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
import { useMemo } from 'react'

import { usePrimaryApiAddress } from '@/features/keys/hooks/use-api-addresses'
import { getPricing } from '@/features/pricing/api'
import type { PricingModel } from '@/features/pricing/types'
import { useStatus } from '@/hooks/use-status'
import { parseHeaderNavModulesFromStatus } from '@/lib/nav-modules'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

/** Model families used by the code samples, matched against model names. */
const SAMPLE_MODEL_PREFIXES = {
  openai: ['gpt-', 'o4-', 'o3-'],
  claude: ['claude-'],
  gemini: ['gemini-'],
} as const

export type SampleModelFamily = keyof typeof SAMPLE_MODEL_PREFIXES

const DEFAULT_SAMPLE_MODELS: Record<SampleModelFamily, string> = {
  openai: 'gpt-4o-mini',
  claude: 'claude-sonnet-4-5',
  gemini: 'gemini-2.5-flash',
}

function pickSampleModel(
  models: PricingModel[],
  family: SampleModelFamily
): string {
  const prefixes: readonly string[] = SAMPLE_MODEL_PREFIXES[family]
  const match = models.find((model) =>
    prefixes.some((prefix) => model.model_name.startsWith(prefix))
  )
  return match?.model_name ?? DEFAULT_SAMPLE_MODELS[family]
}

/** The site address without a trailing slash or `/v1` suffix. */
export function toGatewayOrigin(address: string): string {
  return address.trim().replace(/\/+$/, '').replace(/\/v1$/, '')
}

/**
 * Public facts about this gateway for the landing pages.
 *
 * Reads the model catalog only when the model square is public for the
 * current visitor, so the landing page never triggers a sign-in redirect.
 * Every value has a fallback; the page renders before the catalog loads.
 */
export function useGatewayFacts() {
  const { status } = useStatus()
  const isAuthenticated = useAuthStore((state) => Boolean(state.auth.user))
  const { address } = usePrimaryApiAddress()
  const modules = parseHeaderNavModulesFromStatus(
    status as Record<string, unknown> | null
  )
  const canReadCatalog =
    modules.pricing.enabled && (!modules.pricing.requireAuth || isAuthenticated)

  const { data } = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => requireServerSuccess(await getPricing()),
    staleTime: 5 * 60 * 1000,
    enabled: canReadCatalog,
    meta: { errorToast: false },
  })

  return useMemo(() => {
    const models = data?.data ?? []
    const usedVendorIds = new Set(models.map((model) => model.vendor_id))
    const vendors = (data?.vendors ?? []).filter((vendor) =>
      usedVendorIds.has(vendor.id)
    )
    const origin = toGatewayOrigin(
      address || (typeof window === 'undefined' ? '' : window.location.origin)
    )

    return {
      origin,
      host: origin.replace(/^https?:\/\//, ''),
      modelCount: models.length,
      vendorCount: vendors.length,
      catalogPublic: canReadCatalog,
      registerEnabled: status?.register_enabled !== false,
      sampleModels: {
        openai: pickSampleModel(models, 'openai'),
        claude: pickSampleModel(models, 'claude'),
        gemini: pickSampleModel(models, 'gemini'),
      } satisfies Record<SampleModelFamily, string>,
    }
  }, [address, canReadCatalog, data, status?.register_enabled])
}
