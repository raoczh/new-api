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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import {
  defaultBillingSettings,
  getGroupDefaults,
  getModelDefaults,
} from '@/features/system-settings/billing/section-defaults'
import { SettingsPageProvider } from '@/features/system-settings/components/settings-page-context'
import {
  getOptionValue,
  useSystemOptions,
} from '@/features/system-settings/hooks/use-system-options'
import { RatioSettingsCard } from '@/features/system-settings/models/ratio-settings-card'

/**
 * Group settings, promoted out of System Settings > Billing into its own
 * administrative page: group ratios, per-group dedicated ratios (special ratio
 * rules), vendor bindings, visibility, and automatic routing order.
 */
export function GroupManagement() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useSystemOptions()
  // The group editor saves through the settings page action slot.
  const [actionsContainer, setActionsContainer] =
    useState<HTMLDivElement | null>(null)
  const [titleStatusContainer, setTitleStatusContainer] =
    useState<HTMLSpanElement | null>(null)

  const settings = useMemo(
    () => getOptionValue(data?.data, defaultBillingSettings),
    [data?.data]
  )

  return (
    <SettingsPageProvider
      actionsContainer={actionsContainer}
      titleStatusContainer={titleStatusContainer}
    >
      {/* The editor has no scroll area of its own, so the page body scrolls.
          `fixedContent` is for list pages whose table scrolls internally. */}
      <SectionPageLayout>
        <SectionPageLayout.Title>
          <span className='inline-flex max-w-full min-w-0 items-center gap-2 align-middle'>
            <span className='truncate'>{t('Group Management')}</span>
            <span
              ref={setTitleStatusContainer}
              className='inline-flex min-w-0 shrink-0 items-center'
            />
          </span>
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <div
            ref={setActionsContainer}
            className='flex flex-wrap items-center justify-end gap-2'
          />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='bg-card @container/settings mx-auto flex min-h-0 w-full max-w-none flex-col gap-6 rounded-xl border p-4 sm:p-6'>
            {isLoading && <LoadingState />}
            {isError && !data && (
              <ErrorState
                title={t('Failed to load settings')}
                onRetry={() => void refetch()}
              />
            )}
            {data && (
              <RatioSettingsCard
                titleKey='Group Management'
                modelDefaults={getModelDefaults(settings)}
                groupDefaults={getGroupDefaults(settings)}
                toolPricesDefault={settings['tool_price_setting.prices']}
                visibleTabs={['groups']}
              />
            )}
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    </SettingsPageProvider>
  )
}
