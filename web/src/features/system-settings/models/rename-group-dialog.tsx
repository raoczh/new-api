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
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { handleServerError } from '@/lib/handle-server-error'

import { renameGroups } from '../api'
import { getGroupNameError } from './group-name'

export type RenameGroupTarget = {
  id: number
  name: string
}

type RenameGroupDialogProps = {
  target: RenameGroupTarget | null
  existingNames: string[]
  onOpenChange: (open: boolean) => void
  onRenamed: () => Promise<void>
}

export function RenameGroupDialog(props: RenameGroupDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (props.target) setName(props.target.name)
  }, [props.target])

  const trimmed = name.trim()
  const unchanged = trimmed === props.target?.name
  const nameError = unchanged
    ? null
    : getGroupNameError(trimmed, props.existingNames)

  const onSubmit = async () => {
    if (!props.target || unchanged || nameError) return
    setIsSubmitting(true)
    try {
      const res = await renameGroups([{ id: props.target.id, name: trimmed }])
      if (!res.success) {
        handleServerError(res, t('Failed to rename group'))
        return
      }
      await props.onRenamed()
      toast.success(t('Group renamed'))
      props.onOpenChange(false)
    } catch (error: unknown) {
      handleServerError(error, t('Failed to rename group'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={props.target !== null}
      onOpenChange={props.onOpenChange}
      title={t('Rename group')}
      description={t(
        'Existing API keys, users, channels, subscriptions and group settings follow the new name.'
      )}
      contentClassName='sm:max-w-lg'
      footerClassName='mt-4'
      contentHeight='auto'
      bodyClassName='space-y-2'
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={() => void onSubmit()}
            disabled={unchanged || nameError !== null || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : null}
            {t('Rename')}
          </Button>
        </>
      }
    >
      <Input
        value={name}
        aria-label={t('New group name')}
        placeholder={t('New group name')}
        aria-invalid={nameError !== null}
        autoComplete='off'
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void onSubmit()
        }}
      />
      {nameError ? (
        <p className='text-destructive text-sm'>
          {t(nameError.key, nameError.params)}
        </p>
      ) : null}
    </Dialog>
  )
}
