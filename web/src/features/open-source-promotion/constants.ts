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
import type { TFunction } from 'i18next'

import type { StatusBadgeProps } from '@/components/status-badge'

export const PROMOTION_STATUS = {
  PENDING: 'pending',
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
  BLACKLISTED: 'blacklisted',
} as const

export type PromotionStatus =
  (typeof PROMOTION_STATUS)[keyof typeof PROMOTION_STATUS]

export const PROMOTION_STATUS_VALUES = Object.values(PROMOTION_STATUS)

export const PROMOTION_STATUSES: Record<
  string,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string }
> = {
  [PROMOTION_STATUS.PENDING]: { labelKey: 'Pending', variant: 'info' },
  [PROMOTION_STATUS.SENDING]: { labelKey: 'Sending', variant: 'warning' },
  [PROMOTION_STATUS.SENT]: { labelKey: 'Sent', variant: 'success' },
  [PROMOTION_STATUS.FAILED]: { labelKey: 'Failed', variant: 'danger' },
  [PROMOTION_STATUS.BLACKLISTED]: {
    labelKey: 'Blacklisted',
    variant: 'neutral',
  },
}

export const PROMOTION_SOURCES: Record<string, string> = {
  owner: 'Repository owner',
  commit: 'Commit author',
  pr: 'Pull request author',
}

export const PROMOTION_REWARD_FILTER_VALUES = ['rewarded', 'pending'] as const

export const PROMOTION_BOUND_FILTER_VALUES = ['bound', 'unbound'] as const

export function getPromotionStatusOptions(t: TFunction) {
  return Object.entries(PROMOTION_STATUSES).map(([value, config]) => ({
    label: t(config.labelKey),
    value,
  }))
}

export const ERROR_MESSAGES = {
  LOAD_FAILED: 'Failed to load open-source promotion recipients',
  STATS_FAILED: 'Failed to load open-source promotion statistics',
  BLACKLIST_FAILED: 'Failed to blacklist the selected recipients',
  UNBLACKLIST_FAILED: 'Failed to unblacklist the selected recipients',
  SEND_FAILED: 'Failed to enqueue the invitation emails',
  FETCH_FAILED: 'Failed to start the author harvest',
  REGRANT_FAILED: 'Failed to regrant the promotion bonus',
  DELETE_FAILED: 'Failed to delete the recipient',
} as const
