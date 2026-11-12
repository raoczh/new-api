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
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Eye, EyeOff, MinusCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { MultiSelect } from '@/components/multi-select'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatNumber } from '@/lib/format'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'

import { getUserGroups, updateUserGroups } from '../../api'
import type { AdminUserGroupOption } from '../../types'
import { useUsers } from '../users-provider'

interface UserGroupsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: number; username: string } | null
  onSuccess?: () => void
}

/**
 * Group settings for one user, kept out of the edit drawer so an administrator
 * can see at a glance which groups the user may call and at what ratio, and
 * change the group or the per-user overrides without touching anything else.
 */
export function UserGroupsDialog(props: UserGroupsDialogProps) {
  const { t } = useTranslation()
  const { triggerRefresh } = useUsers()
  const userId = props.user?.id ?? 0
  const username = props.user?.username ?? ''

  const groups = useQuery({
    queryKey: ['users', userId, 'groups'],
    enabled: props.open && userId > 0,
    queryFn: async () => requireServerSuccess(await getUserGroups(userId)),
  })

  const [group, setGroup] = useState('')
  const [extraGroups, setExtraGroups] = useState<string[]>([])
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const payload = groups.data?.data
  useEffect(() => {
    if (!payload) return
    setGroup(payload.group)
    setExtraGroups(payload.extra_usable_groups ?? [])
    setHiddenGroups(payload.hidden_usable_groups ?? [])
  }, [payload])

  const options = (payload?.groups ?? []).map((item) => ({
    value: item.name,
    label: item.name,
  }))
  // 只允许改动已经存在的分组，避免把用户指向一个不存在的分组导致请求被拒。
  const knownGroups = new Set(options.map((option) => option.value))
  for (const name of [...extraGroups, ...hiddenGroups]) {
    if (!knownGroups.has(name)) {
      options.push({ value: name, label: name })
    }
  }

  const conflicting = extraGroups.find((name) => hiddenGroups.includes(name))
  const hidesOwnGroup = hiddenGroups.includes(group)
  const isInvalid = !!conflicting || hidesOwnGroup

  const handleSave = async () => {
    if (isInvalid) return
    setSaving(true)
    try {
      const result = await updateUserGroups(userId, {
        group,
        extra_usable_groups: extraGroups,
        hidden_usable_groups: hiddenGroups,
      })
      if (result.success) {
        toast.success(t('Groups updated'))
        triggerRefresh()
        props.onSuccess?.()
        props.onOpenChange(false)
      } else {
        toast.error(result.message || t('Failed to update groups'))
      }
    } catch (error) {
      toast.error(getServerErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const renderGroupRow = (item: AdminUserGroupOption) => {
    const isOwnGroup = item.name === group
    const isExtra = extraGroups.includes(item.name)
    const isHidden = hiddenGroups.includes(item.name)
    return (
      <div
        key={item.name}
        className='flex items-center justify-between gap-3 rounded-md border px-3 py-2'
      >
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='truncate font-mono text-sm'>{item.name}</span>
            {isOwnGroup && (
              <StatusBadge
                label={t('Own group')}
                variant='info'
                copyable={false}
              />
            )}
            {isExtra && (
              <StatusBadge
                icon={Eye}
                label={t('Extra visible')}
                variant='purple'
                copyable={false}
              />
            )}
            {isHidden && (
              <StatusBadge
                icon={EyeOff}
                label={t('Hidden')}
                variant='neutral'
                copyable={false}
              />
            )}
          </div>
          {item.desc && (
            <p className='text-muted-foreground truncate text-xs'>
              {item.desc}
            </p>
          )}
        </div>
        <div className='flex shrink-0 items-center gap-3 text-sm tabular-nums'>
          <span className='text-muted-foreground'>
            {t('Billing ratio')} ×{formatNumber(item.ratio)}
          </span>
          {item.usable ? (
            <CheckCircle2 className='text-success size-4' aria-hidden='true' />
          ) : (
            <MinusCircle
              className='text-muted-foreground size-4'
              aria-hidden='true'
            />
          )}
          <span className='w-16 text-end text-xs'>
            {item.usable ? t('Usable') : t('Not usable')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Groups of {{username}}', { username })}
      description={t(
        'The group decides which models the user can call and at what billing ratio. Extra visible groups are added on top of the ones their group already allows.'
      )}
      contentClassName='sm:max-w-3xl'
      bodyClassName='space-y-5'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            type='button'
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            disabled={saving || groups.isPending || isInvalid}
            onClick={() => void handleSave()}
          >
            {saving ? t('Saving...') : t('Save')}
          </Button>
        </>
      }
    >
      {groups.isPending && <LoadingState />}
      {groups.isError && (
        <ErrorState
          title={t('Failed to load groups')}
          description={getServerErrorMessage(groups.error)}
          onRetry={() => void groups.refetch()}
        />
      )}
      {groups.isSuccess && (
        <>
          <div className='space-y-2'>
            <Label htmlFor='admin-user-group'>{t('Own group')}</Label>
            <Combobox
              options={options}
              value={group}
              onValueChange={(value) => setGroup(value ?? '')}
              className='w-full'
              placeholder={t('Select a group')}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('Groups this user can use')}</Label>
            <ScrollArea className='max-h-64 pr-2'>
              <div className='space-y-2'>
                {(payload?.groups ?? []).map(renderGroupRow)}
              </div>
            </ScrollArea>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>{t('Extra visible groups')}</Label>
              <MultiSelect
                options={options}
                selected={extraGroups}
                onChange={setExtraGroups}
                placeholder={t('Select groups')}
              />
            </div>
            <div className='space-y-2'>
              <Label>{t('Hidden groups')}</Label>
              <MultiSelect
                options={options}
                selected={hiddenGroups}
                onChange={setHiddenGroups}
                placeholder={t('Select groups')}
              />
            </div>
          </div>

          {conflicting && (
            <p className='text-destructive text-sm' role='alert'>
              {t('{{group}} cannot be both extra visible and hidden.', {
                group: conflicting,
              })}
            </p>
          )}
          {hidesOwnGroup && (
            <p className='text-destructive text-sm' role='alert'>
              {t('Cannot hide {{group}}: the user belongs to this group.', {
                group,
              })}
            </p>
          )}
        </>
      )}
    </Dialog>
  )
}
