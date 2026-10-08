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
import { ChevronsUpDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getApiKey, updateApiKey } from '../api'
import { ERROR_MESSAGES } from '../constants'
import type { ApiKey } from '../types'
import { ApiKeyGroupCell } from './api-key-group-cell'
import {
  ApiKeyGroupCombobox,
  type ApiKeyGroupOption,
} from './api-key-group-combobox'
import { useApiKeys } from './api-keys-provider'
import type { GroupRatio } from './auto-group-visuals'

type ApiKeyGroupEditableCellProps = {
  apiKey: ApiKey
  groupOptions: ApiKeyGroupOption[]
  ratio?: GroupRatio
  shouldReduceMotion: boolean
}

export function ApiKeyGroupEditableCell(props: ApiKeyGroupEditableCellProps) {
  const { t } = useTranslation()
  const { triggerRefresh } = useApiKeys()
  const [saving, setSaving] = useState(false)
  const group = props.apiKey.group?.trim() || ''

  const handleGroupChange = async (nextGroup: string) => {
    if (nextGroup === group || saving) return
    setSaving(true)
    try {
      // The update endpoint replaces every editable field, so start from the
      // latest stored key instead of a list row that may hold a stale quota.
      const latest = requireServerSuccess(await getApiKey(props.apiKey.id)).data
      if (!latest) throw new Error(t(ERROR_MESSAGES.UPDATE_FAILED))
      const result = await updateApiKey({
        id: latest.id,
        name: latest.name,
        remain_quota: latest.remain_quota,
        expired_time: latest.expired_time,
        unlimited_quota: latest.unlimited_quota,
        model_limits_enabled: latest.model_limits_enabled,
        model_limits: latest.model_limits || '',
        allow_ips: latest.allow_ips || '',
        group: nextGroup,
        // Matches the drawer: switching to Auto follows the global order with
        // cross-group retry on; the backend clears both for other groups.
        auto_groups: [],
        cross_group_retry: nextGroup === 'auto',
      })
      if (!result.success) {
        handleServerError(result, t(ERROR_MESSAGES.UPDATE_FAILED))
        return
      }
      toast.success(
        t('Group changed to {{group}}', {
          group: nextGroup || t('Follow user group'),
        })
      )
      triggerRefresh()
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.UPDATE_FAILED))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ApiKeyGroupCombobox
      options={props.groupOptions}
      value={group}
      onValueChange={(value) => void handleGroupChange(value)}
      disabled={saving}
      contentClassName='min-w-72'
      trigger={
        <button
          type='button'
          aria-label={t('Change group for {{name}}', {
            name: props.apiKey.name,
          })}
          aria-busy={saving}
          title={group || t('Follow user group')}
          className={cn(
            'group/group-cell -ml-1.5 flex w-full max-w-50 min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors',
            'hover:bg-muted/60 focus-visible:ring-ring/50 data-popup-open:bg-muted/60 outline-none focus-visible:ring-[3px]',
            'disabled:cursor-progress disabled:opacity-70'
          )}
        >
          <ApiKeyGroupCell
            group={group}
            ratio={props.ratio}
            crossGroupRetry={props.apiKey.cross_group_retry}
            shouldReduceMotion={props.shouldReduceMotion}
            interactive={false}
          />
          {saving ? (
            <Loader2
              aria-hidden='true'
              className='text-muted-foreground ml-auto size-3.5 shrink-0 animate-spin'
            />
          ) : (
            <ChevronsUpDown
              aria-hidden='true'
              className='text-muted-foreground ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover/group-cell:opacity-100 group-focus-visible/group-cell:opacity-100 group-data-popup-open/group-cell:opacity-100'
            />
          )}
        </button>
      }
    />
  )
}
