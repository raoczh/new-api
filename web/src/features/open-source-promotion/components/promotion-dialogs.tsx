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
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import {
  blacklistRecipients,
  deleteRecipient,
  regrantRecipients,
  sendRecipients,
  unblacklistRecipients,
} from '../api'
import { ERROR_MESSAGES } from '../constants'
import { usePromotion } from './promotion-provider'

export function PromotionDialogs() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, setCurrentRow, triggerRefresh } =
    usePromotion()

  const close = () => {
    setOpen(null)
    setCurrentRow(null)
  }

  const mutation = useMutation({
    mutationFn: async ({
      type,
      id,
    }: {
      type: 'blacklist' | 'unblacklist' | 'send' | 'regrant' | 'delete'
      id: number
    }) => {
      switch (type) {
        case 'blacklist': {
          const result = await blacklistRecipients([id])
          if (!result.success) throw createServerError(result)
          return t('Recipient blacklisted')
        }
        case 'unblacklist': {
          const result = await unblacklistRecipients([id])
          if (!result.success) throw createServerError(result)
          return t('Recipient removed from the blacklist')
        }
        case 'send': {
          const result = await sendRecipients([id])
          if (!result.success) throw createServerError(result)
          return t('Invitation email queued')
        }
        case 'regrant': {
          const result = await regrantRecipients([id])
          if (!result.success) throw createServerError(result)
          return t('Bonus granted to {{count}} recipients', {
            count: result.data?.granted ?? 0,
          })
        }
        case 'delete': {
          const result = await deleteRecipient(id)
          if (!result.success) throw createServerError(result)
          return t('Recipient deleted')
        }
      }
    },
    onSuccess: (message) => {
      toast.success(message)
      close()
      triggerRefresh()
    },
    onError: (error) => {
      const fallbackByType: Record<string, string> = {
        blacklist: ERROR_MESSAGES.BLACKLIST_FAILED,
        unblacklist: ERROR_MESSAGES.UNBLACKLIST_FAILED,
        send: ERROR_MESSAGES.SEND_FAILED,
        regrant: ERROR_MESSAGES.REGRANT_FAILED,
        delete: ERROR_MESSAGES.DELETE_FAILED,
      }
      handleServerError(error, t(fallbackByType[open ?? ''] ?? ''))
    },
  })

  const confirm = () => {
    if (!currentRow || !open) return
    mutation.mutate({ type: open, id: currentRow.id })
  }

  const busy = mutation.isPending

  return (
    <>
      <ConfirmDialog
        open={open === 'blacklist'}
        onOpenChange={(value) => !value && close()}
        title={t('Add to blacklist?')}
        desc={t(
          'The selected address will no longer receive automatic or manual invitation emails.'
        )}
        confirmText={t('Add to blacklist')}
        destructive
        isLoading={busy}
        handleConfirm={confirm}
      />

      <ConfirmDialog
        open={open === 'unblacklist'}
        onOpenChange={(value) => !value && close()}
        title={t('Remove from blacklist?')}
        desc={t('The address becomes eligible for invitation emails again.')}
        confirmText={t('Remove from blacklist')}
        isLoading={busy}
        handleConfirm={confirm}
      />

      <ConfirmDialog
        open={open === 'send'}
        onOpenChange={(value) => !value && close()}
        title={t('Send the invitation now?')}
        desc={t(
          'The email is queued and delivered by the background task, keeping the configured interval between messages.'
        )}
        confirmText={t('Send now')}
        isLoading={busy}
        handleConfirm={confirm}
      />

      <ConfirmDialog
        open={open === 'regrant'}
        onOpenChange={(value) => !value && close()}
        title={t('Grant the bonus again?')}
        desc={t(
          'The bonus is credited with the current reward amount. Addresses already rewarded are skipped.'
        )}
        confirmText={t('Grant bonus')}
        isLoading={busy}
        handleConfirm={confirm}
      />

      <ConfirmDialog
        open={open === 'delete'}
        onOpenChange={(value) => !value && close()}
        title={t('Delete this recipient?')}
        desc={t(
          'The harvested record is removed. The account and any granted bonus are kept.'
        )}
        confirmText={t('Delete')}
        destructive
        isLoading={busy}
        handleConfirm={confirm}
      />
    </>
  )
}
