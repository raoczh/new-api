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
import { Mail, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import { fetchPromotionAuthors, sendAllRecipients } from '../api'
import { ERROR_MESSAGES } from '../constants'
import { usePromotion } from './promotion-provider'

export function PromotionPrimaryButtons() {
  const { t } = useTranslation()
  const { triggerRefresh } = usePromotion()
  const [sendAllOpen, setSendAllOpen] = useState(false)

  const fetchMutation = useMutation({
    mutationFn: async () => {
      const result = await fetchPromotionAuthors()
      if (!result.success) throw createServerError(result)
      return result.data?.enqueued ?? false
    },
    onSuccess: (enqueued) => {
      toast.success(
        enqueued
          ? t('Author harvest started')
          : t('An author harvest task is already running')
      )
      triggerRefresh()
    },
    onError: (error) => {
      handleServerError(error, t(ERROR_MESSAGES.FETCH_FAILED))
    },
  })

  const sendAllMutation = useMutation({
    mutationFn: async () => {
      const result = await sendAllRecipients()
      if (!result.success) throw createServerError(result)
      return result.data
    },
    onSuccess: (data) => {
      setSendAllOpen(false)
      toast.success(
        data?.enqueued
          ? t('{{count}} invitation emails queued', {
              count: data.affected ?? 0,
            })
          : t('An invitation email task is already running')
      )
      triggerRefresh()
    },
    onError: (error) => {
      setSendAllOpen(false)
      handleServerError(error, t(ERROR_MESSAGES.SEND_FAILED))
    },
  })

  const busy = fetchMutation.isPending || sendAllMutation.isPending

  return (
    <>
      <div className='flex flex-wrap gap-2'>
        <Button
          size='sm'
          variant='outline'
          onClick={() => triggerRefresh()}
          disabled={busy}
        >
          <RefreshCw className='h-4 w-4' />
          {t('Refresh')}
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={() => setSendAllOpen(true)}
          disabled={busy}
        >
          <Mail className='h-4 w-4' />
          {t('Send all pending emails')}
        </Button>
        <Button
          size='sm'
          onClick={() => fetchMutation.mutate()}
          disabled={busy}
        >
          <Search className='h-4 w-4' />
          {t('Harvest authors now')}
        </Button>
      </div>

      <ConfirmDialog
        open={sendAllOpen}
        onOpenChange={setSendAllOpen}
        title={t('Send the invitation now?')}
        desc={t(
          'The email is queued and delivered by the background task, keeping the configured interval between messages.'
        )}
        confirmText={t('Send all pending emails')}
        isLoading={sendAllMutation.isPending}
        handleConfirm={() => sendAllMutation.mutate()}
      />
    </>
  )
}
