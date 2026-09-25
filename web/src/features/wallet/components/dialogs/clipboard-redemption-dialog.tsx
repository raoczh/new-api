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
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { formatQuota } from '@/lib/format'

interface ClipboardRedemptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  code: string
  quota: number | null
  processing: boolean
  onConfirm: () => void
}

export function ClipboardRedemptionDialog(
  props: ClipboardRedemptionDialogProps
) {
  const { t } = useTranslation()

  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={(open) => {
        if (!props.processing) props.onOpenChange(open)
      }}
      title={t('Redemption code detected')}
      desc={
        <div className='space-y-3'>
          <p>{t('A valid redemption code was found in your clipboard.')}</p>
          <div className='bg-muted/50 rounded-lg border px-3 py-2 font-mono text-xs break-all'>
            {props.code}
          </div>
          <p className='text-sm'>
            {t('Redeem {{quota}} quota from this code now?', {
              quota: formatQuota(props.quota ?? 0),
            })}
          </p>
        </div>
      }
      cancelBtnText={t('Keep code')}
      confirmText={t('Redeem this code')}
      handleConfirm={props.onConfirm}
      isLoading={props.processing}
    />
  )
}
