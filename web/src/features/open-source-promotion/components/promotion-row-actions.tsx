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
import { Ban, Gift, Mail, Trash2, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActionMenu } from '@/components/data-table'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

import type { PromotionRecipient } from '../types'
import { usePromotion } from './promotion-provider'

export function PromotionRowActions({ row }: { row: PromotionRecipient }) {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = usePromotion()
  const blacklisted = row.status === 'blacklisted'

  return (
    <DataTableRowActionMenu ariaLabel={t('Open menu')} modal={false}>
      <DropdownMenuItem
        onClick={() => {
          setCurrentRow(row)
          setOpen('send')
        }}
      >
        {t('Send now')}
        <Mail className='ml-auto size-4' />
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={row.rewarded_at > 0 || row.bound_user_id <= 0}
        onClick={() => {
          if (row.rewarded_at > 0 || row.bound_user_id <= 0) return
          setCurrentRow(row)
          setOpen('regrant')
        }}
      >
        {t('Grant bonus again')}
        <Gift className='ml-auto size-4' />
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => {
          setCurrentRow(row)
          setOpen(blacklisted ? 'unblacklist' : 'blacklist')
        }}
      >
        {blacklisted ? t('Remove from blacklist') : t('Add to blacklist')}
        {blacklisted ? (
          <Undo2 className='ml-auto size-4' />
        ) : (
          <Ban className='ml-auto size-4' />
        )}
      </DropdownMenuItem>
      <DropdownMenuItem
        variant='destructive'
        onClick={() => {
          setCurrentRow(row)
          setOpen('delete')
        }}
      >
        {t('Delete')}
        <Trash2 className='ml-auto size-4' />
      </DropdownMenuItem>
    </DataTableRowActionMenu>
  )
}
