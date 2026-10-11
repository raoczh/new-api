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
import { ArrowLeftRightIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { hasPermission } from '@/lib/admin-permissions'
import { handleServerError } from '@/lib/handle-server-error'
import { ROLE } from '@/lib/roles'
import {
  createServerError,
  getServerErrorMessage,
} from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { switchLogChannelAffinity } from '../api'
import type { UsageLog } from '../data/schema'
import { parseLogOther } from '../lib/format'
import type { ChannelAffinitySwitchRequest } from '../types'

export function ChannelSwitchAction(props: { log: UsageLog }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const client = useQueryClient()
  const canOperate = useAuthStore(
    (state) =>
      (state.auth.user?.role ?? ROLE.GUEST) >= ROLE.ADMIN &&
      hasPermission(state.auth.user, 'channel', 'operate')
  )
  const affinity = parseLogOther(props.log.other)?.admin_info?.channel_affinity
  const available = Boolean(
    affinity?.rule_name && affinity?.key_fp && props.log.channel > 0
  )
  const mutation = useMutation({
    mutationFn: async (target: ChannelAffinitySwitchRequest) => {
      const response = await switchLogChannelAffinity(target)
      if (!response.success) {
        throw createServerError(response, t('Failed to switch channel'))
      }
    },
    onSuccess: () => {
      setOpen(false)
      toast.success(
        t('Session binding cleared. The next request will avoid this channel.')
      )
      void client.invalidateQueries({ queryKey: ['logs'] })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to switch channel'), {
        title: t(getServerErrorMessage(error, t('Failed to switch channel'))),
      }),
  })

  if (!canOperate || (props.log.type !== 2 && props.log.type !== 5)) return null

  return (
    <>
      <Button
        variant='outline'
        size='icon-sm'
        disabled={!available || mutation.isPending}
        aria-label={t('Switch channel')}
        title={
          available
            ? t('Clear cache and switch channel')
            : t('No session binding is available for this request')
        }
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon
          icon={ArrowLeftRightIcon}
          strokeWidth={2}
          aria-hidden='true'
        />
      </Button>
      <ConfirmDialog
        open={open && canOperate}
        onOpenChange={(value) => {
          if (!mutation.isPending) setOpen(value)
        }}
        title={t('Clear cache and switch channel')}
        desc={t(
          'Clear this session binding and avoid channel #{{channel}} on its next request? Running and completed requests will not be replayed.',
          { channel: props.log.channel }
        )}
        isLoading={mutation.isPending}
        handleConfirm={() => {
          if (
            !available ||
            !affinity?.rule_name ||
            !affinity.key_fp ||
            mutation.isPending
          ) {
            return
          }
          mutation.mutate({
            cache_key_hash: affinity.cache_key_hash,
            rule_name: affinity.rule_name,
            model: affinity.model || props.log.model_name,
            using_group: affinity.using_group || '',
            key_fp: affinity.key_fp,
            channel_id: props.log.channel,
          })
        }}
      />
    </>
  )
}
