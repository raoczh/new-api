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
import type { Table } from '@tanstack/react-table'
import { Ban, Gift, Mail, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import type { PromotionRecipient } from '../types'
import { usePromotion } from './promotion-provider'

type BulkAction = 'blacklist' | 'unblacklist' | 'send' | 'regrant' | 'delete'

export function PromotionBulkActions({
  table,
}: {
  table: Table<PromotionRecipient>
}) {
  const { t } = useTranslation()
  const { triggerRefresh } = usePromotion()
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null)
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selected = selectedRows.map((row) => row.original)

  const mutation = useMutation({
    mutationFn: async ({
      action,
      rows,
    }: {
      action: BulkAction
      rows: PromotionRecipient[]
    }) => {
      const ids = rows.map((row) => row.id)
      switch (action) {
        case 'blacklist': {
          const result = await blacklistRecipients(ids)
          if (!result.success) throw createServerError(result)
          return t('{{count}} recipients blacklisted', {
            count: result.data?.affected ?? 0,
          })
        }
        case 'unblacklist': {
          const result = await unblacklistRecipients(ids)
          if (!result.success) throw createServerError(result)
          return t('{{count}} recipients removed from the blacklist', {
            count: result.data?.affected ?? 0,
          })
        }
        case 'send': {
          const result = await sendRecipients(ids)
          if (!result.success) throw createServerError(result)
          return t('{{count}} invitation emails queued', { count: ids.length })
        }
        case 'regrant': {
          const result = await regrantRecipients(ids)
          if (!result.success) throw createServerError(result)
          return t('Bonus granted to {{count}} recipients', {
            count: result.data?.granted ?? 0,
          })
        }
        case 'delete': {
          for (const id of ids) {
            const result = await deleteRecipient(id)
            if (!result.success) throw createServerError(result)
          }
          return t('{{count}} recipients deleted', { count: ids.length })
        }
      }
    },
    onSuccess: (message) => {
      toast.success(message)
      table.resetRowSelection()
      setPendingAction(null)
      triggerRefresh()
    },
    onError: (error) => {
      const fallbackByAction: Record<string, string> = {
        blacklist: ERROR_MESSAGES.BLACKLIST_FAILED,
        unblacklist: ERROR_MESSAGES.UNBLACKLIST_FAILED,
        send: ERROR_MESSAGES.SEND_FAILED,
        regrant: ERROR_MESSAGES.REGRANT_FAILED,
        delete: ERROR_MESSAGES.DELETE_FAILED,
      }
      handleServerError(error, t(fallbackByAction[pendingAction ?? ''] ?? ''))
    },
  })

  const runAction = (action: BulkAction) => {
    if (selected.length === 0) return
    mutation.mutate({ action, rows: selected })
  }

  const confirmBulk = (action: BulkAction) => {
    if (selected.length === 0) return
    setPendingAction(action)
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName={t('recipient')}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                aria-label={t('Send selected recipients')}
                disabled={mutation.isPending}
                onClick={() => confirmBulk('send')}
              />
            }
          >
            <Mail aria-hidden='true' />
          </TooltipTrigger>
          <TooltipContent>{t('Send selected recipients')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                aria-label={t('Grant the bonus to selected recipients')}
                disabled={mutation.isPending}
                onClick={() => confirmBulk('regrant')}
              />
            }
          >
            <Gift aria-hidden='true' />
          </TooltipTrigger>
          <TooltipContent>
            {t('Grant the bonus to selected recipients')}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                aria-label={t('Remove selected from the blacklist')}
                disabled={mutation.isPending}
                onClick={() => confirmBulk('unblacklist')}
              />
            }
          >
            <Undo2 aria-hidden='true' />
          </TooltipTrigger>
          <TooltipContent>
            {t('Remove selected from the blacklist')}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                aria-label={t('Blacklist selected recipients')}
                disabled={mutation.isPending}
                onClick={() => confirmBulk('blacklist')}
              />
            }
          >
            <Ban aria-hidden='true' />
          </TooltipTrigger>
          <TooltipContent>{t('Blacklist selected recipients')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='destructive'
                size='icon'
                className='size-8'
                aria-label={t('Delete selected recipients')}
                disabled={mutation.isPending}
                onClick={() => confirmBulk('delete')}
              />
            }
          >
            <Trash2 aria-hidden='true' />
          </TooltipTrigger>
          <TooltipContent>{t('Delete selected recipients')}</TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(value) => !value && setPendingAction(null)}
        title={t('Confirm the bulk action?')}
        desc={t('{{count}} recipients are selected.', { count: selected.length })}
        confirmText={pendingAction === 'delete' ? t('Delete') : t('Continue')}
        destructive={pendingAction === 'delete'}
        isLoading={mutation.isPending}
        handleConfirm={() => pendingAction && runAction(pendingAction)}
      />
    </>
  )
}
