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
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatNumber } from '@/lib/format'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getUserGroups, updateUserGroups } from '../../api'
import type { AdminUserGroupOption, AdminUserGroups } from '../../types'

interface UserGroupsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: number; username: string } | null
  onSuccess?: () => void
}

/** Largest ratio the server accepts for one user in one group. */
const MAX_USER_GROUP_RATIO = 1000

/** A typed ratio is a plain decimal between 0 and the limit; empty means none. */
function parseRatio(text: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(text.trim())) return null
  const ratio = Number(text)
  return ratio <= MAX_USER_GROUP_RATIO ? ratio : null
}

interface UserGroupsFormProps {
  userId: number
  /** What is saved for the user right now. */
  saved: AdminUserGroups
  formId: string
  onSavingChange: (saving: boolean) => void
  onSaved: () => void
}

/**
 * Every group of the site as one list. A tick means the user can use the
 * group; ticking or clearing one only records the difference from what the
 * user's own group already gives, which is what the edit drawer shows as
 * extra visible and hidden groups.
 */
function UserGroupsForm(props: UserGroupsFormProps) {
  const { t } = useTranslation()
  const [group, setGroup] = useState(props.saved.group)
  const [extra, setExtra] = useState(props.saved.extra_usable_groups ?? [])
  const [hidden, setHidden] = useState(props.saved.hidden_usable_groups ?? [])
  const [ratioTexts, setRatioTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(props.saved.group_ratios ?? {}).map(([name, ratio]) => [
        name,
        String(ratio),
      ])
    )
  )

  // The defaults depend on the own group, so picking another one asks the
  // server what that group would give before anything is saved.
  const preview = useQuery({
    queryKey: ['users', props.userId, 'groups', 'preview', group],
    enabled: group !== props.saved.group,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      requireServerSuccess(await getUserGroups(props.userId, group)),
  })
  const shown =
    group === props.saved.group
      ? props.saved
      : (preview.data?.data ?? props.saved)

  const isUsable = (item: AdminUserGroupOption) => {
    if (item.name === group) return true
    if (hidden.includes(item.name)) return false
    return item.default_usable || extra.includes(item.name)
  }

  const toggleUsable = (item: AdminUserGroupOption) => {
    const without = (names: string[]) =>
      names.filter((name) => name !== item.name)
    if (isUsable(item)) {
      setExtra(without(extra))
      setHidden(item.default_usable ? [...without(hidden), item.name] : hidden)
      return
    }
    setHidden(without(hidden))
    setExtra(item.default_usable ? extra : [...without(extra), item.name])
  }

  const invalidRatioGroups = Object.entries(ratioTexts)
    .filter(([, text]) => text.trim() !== '' && parseRatio(text) === null)
    .map(([name]) => name)
  const isInvalid = invalidRatioGroups.length > 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isInvalid) return
    const groupRatios: Record<string, number> = {}
    for (const [name, text] of Object.entries(ratioTexts)) {
      const ratio = parseRatio(text)
      if (ratio !== null) groupRatios[name] = ratio
    }
    props.onSavingChange(true)
    try {
      const result = await updateUserGroups(props.userId, {
        group,
        extra_usable_groups: extra,
        // The own group is always usable, so it is never sent as hidden.
        hidden_usable_groups: hidden.filter((name) => name !== group),
        group_ratios: groupRatios,
      })
      if (result.success) {
        toast.success(t('Groups updated'))
        props.onSaved()
      } else {
        toast.error(result.message || t('Failed to update groups'))
      }
    } catch (error) {
      toast.error(getServerErrorMessage(error))
    } finally {
      props.onSavingChange(false)
    }
  }

  const usableCount = shown.groups.filter(isUsable).length

  return (
    <form id={props.formId} onSubmit={handleSubmit} className='space-y-5'>
      <div className='space-y-2'>
        <Label>{t('Own group')}</Label>
        <Combobox
          options={shown.groups
            .filter((item) => item.has_ratio)
            .map((item) => ({ value: item.name, label: item.name }))}
          value={group}
          onValueChange={(value) => value && setGroup(value)}
          className='w-full sm:max-w-sm'
          placeholder={t('Select a group')}
        />
        <p className='text-muted-foreground text-xs'>
          {t(
            'The own group decides which groups are usable by default and their default ratio.'
          )}
        </p>
      </div>

      <div className='space-y-2'>
        <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1'>
          <Label>{t('Groups this user can use')}</Label>
          <span className='text-muted-foreground text-xs tabular-nums'>
            {t('{{count}} of {{total}} usable', {
              count: usableCount,
              total: shown.groups.length,
            })}
          </span>
        </div>
        <ul className='divide-y rounded-lg border'>
          {shown.groups.map((item) => {
            const usable = isUsable(item)
            const isOwnGroup = item.name === group
            const ratioText = ratioTexts[item.name] ?? ''
            const ratioInvalid = invalidRatioGroups.includes(item.name)
            const checkboxId = `${props.formId}-usable-${item.name}`
            return (
              <li
                key={item.name}
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5',
                  !usable && 'bg-muted/40'
                )}
              >
                <Checkbox
                  id={checkboxId}
                  checked={usable}
                  disabled={isOwnGroup}
                  onCheckedChange={() => toggleUsable(item)}
                />
                <label
                  htmlFor={checkboxId}
                  className='min-w-0 flex-1 basis-48 cursor-pointer'
                >
                  <span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                    <span
                      className={cn(
                        'font-mono text-sm break-all',
                        !usable && 'text-muted-foreground'
                      )}
                    >
                      {item.name}
                    </span>
                    {isOwnGroup && (
                      <StatusBadge
                        label={t('Own group')}
                        variant='info'
                        copyable={false}
                      />
                    )}
                    {!isOwnGroup && usable && !item.default_usable && (
                      <StatusBadge
                        label={t('Added for this user')}
                        variant='success'
                        copyable={false}
                      />
                    )}
                    {!isOwnGroup && !usable && item.default_usable && (
                      <StatusBadge
                        label={t('Blocked for this user')}
                        variant='warning'
                        copyable={false}
                      />
                    )}
                  </span>
                  {item.desc && item.desc !== item.name && (
                    <span className='text-muted-foreground block text-xs break-words'>
                      {t(item.desc)}
                    </span>
                  )}
                </label>
                {item.has_ratio && (
                  <div className='flex shrink-0 items-center gap-2'>
                    <span className='text-muted-foreground text-xs tabular-nums'>
                      {t('Default ratio')} ×{formatNumber(item.default_ratio)}
                    </span>
                    <Input
                      inputMode='decimal'
                      value={ratioText}
                      onChange={(event) =>
                        setRatioTexts({
                          ...ratioTexts,
                          [item.name]: event.target.value,
                        })
                      }
                      placeholder={formatNumber(item.default_ratio)}
                      aria-label={t('Ratio of {{group}} for this user', {
                        group: item.name,
                      })}
                      aria-invalid={ratioInvalid}
                      className='h-8 w-24 text-sm tabular-nums'
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Type a ratio to charge this user differently in that group; leave it empty to use the default. Changes apply from the next request after saving.'
          )}
        </p>
        {isInvalid && (
          <p className='text-destructive text-sm' role='alert'>
            {t('A ratio must be a number from 0 to {{max}}.', {
              max: MAX_USER_GROUP_RATIO,
            })}
          </p>
        )}
      </div>
    </form>
  )
}

/**
 * Group settings for one user: which group they belong to, which groups they
 * can use, and the ratio they are charged in each, all in one list.
 */
export function UserGroupsDialog(props: UserGroupsDialogProps) {
  const { t } = useTranslation()
  const formId = useId()
  const userId = props.user?.id ?? 0
  const username = props.user?.username ?? ''
  const [saving, setSaving] = useState(false)

  const groups = useQuery({
    queryKey: ['users', userId, 'groups'],
    enabled: props.open && userId > 0,
    // The form starts from what was loaded; reloading behind the administrator
    // would throw away what they have ticked so far.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
    queryFn: async () => requireServerSuccess(await getUserGroups(userId)),
  })
  const saved = groups.data?.data

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Groups of {{username}}', { username })}
      description={t(
        'Tick the groups this user can use. What you change here is the same setting as the extra visible and hidden groups in the edit form.'
      )}
      contentClassName='sm:max-w-3xl'
      contentHeight='min(70vh, 42rem)'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            type='button'
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form={formId} disabled={saving || !saved}>
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
      {props.open && saved && (
        <UserGroupsForm
          key={groups.dataUpdatedAt}
          userId={userId}
          saved={saved}
          formId={formId}
          onSavingChange={setSaving}
          onSaved={() => {
            props.onSuccess?.()
            props.onOpenChange(false)
          }}
        />
      )}
    </Dialog>
  )
}
