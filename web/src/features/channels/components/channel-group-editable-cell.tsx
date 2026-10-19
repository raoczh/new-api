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
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { GroupBadge } from '@/components/group-badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { updateChannel } from '../api'
import { ERROR_MESSAGES } from '../constants'
import { channelsQueryKeys, parseGroupsList } from '../lib'
import type { Channel } from '../types'
import { useChannels } from './channels-provider'

const SENSITIVE_MASK = '••••'
const MAX_VISIBLE_GROUPS = 2

export type ChannelGroupOption = {
  label: string
  value: string
  suffix?: ReactNode
}

type ChannelGroupEditableCellProps = {
  channel: Channel
  groupOptions: ChannelGroupOption[]
  groupRatios?: Record<string, number>
  /** Card view stretches the trigger to the footer width. */
  layout?: 'table' | 'card'
}

/**
 * Inline multi-group editor for a channel row.
 *
 * The channel `group` field is a comma-separated list, so the popover stays
 * open while groups are toggled and saves the whole list on every change.
 * Mirrors the API key group cell: a compact trigger in the table, a searchable
 * command list, an immediate PUT, a confirmation toast, and a list refresh.
 */
export function ChannelGroupEditableCell({
  channel,
  groupOptions,
  groupRatios,
  layout = 'table',
}: ChannelGroupEditableCellProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { sensitiveVisible } = useChannels()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [saving, setSaving] = useState(false)
  const groups = parseGroupsList(channel.group ?? '')
  const optionValues = useMemo(
    () => new Set(groupOptions.map((option) => option.value)),
    [groupOptions]
  )
  const selectedGroups = useMemo(() => new Set(groups), [groups])
  const visibleGroups = groups.slice(0, MAX_VISIBLE_GROUPS)
  const hiddenGroupCount = groups.length - visibleGroups.length

  const filteredOptions = useMemo(() => {
    const search = searchValue.trim().toLowerCase()
    if (!search) return groupOptions
    return groupOptions.filter(
      (option) =>
        option.value.toLowerCase().includes(search) ||
        option.label.toLowerCase().includes(search)
    )
  }, [groupOptions, searchValue])

  const saveGroups = async (nextGroups: string[]) => {
    if (saving) return
    setSaving(true)
    try {
      const response = await updateChannel(channel.id, {
        group: nextGroups.join(','),
      })
      if (!response.success) {
        handleServerError(response, t(ERROR_MESSAGES.UPDATE_FAILED))
        return
      }
      toast.success(
        t('Group changed to {{group}}', {
          group: nextGroups.join(', '),
        })
      )
      await queryClient.invalidateQueries({
        queryKey: channelsQueryKeys.lists(),
      })
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.UPDATE_FAILED))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (value: string) => {
    const next = selectedGroups.has(value)
      ? groups.filter((group) => group !== value)
      : [...groups, value]
    if (next.length === 0) {
      toast.error(t(ERROR_MESSAGES.REQUIRED_GROUP))
      return
    }
    const nextSet = new Set(next)
    // Keep the option order so the persisted string is stable, then append
    // any legacy/custom group that is not in the current option list.
    const ordered = groupOptions
      .map((option) => option.value)
      .filter((option) => nextSet.has(option))
    const extras = next.filter((group) => !optionValues.has(group))
    void saveGroups([...ordered, ...extras])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type='button'
            role='combobox'
            aria-label={t('Change group for {{name}}', { name: channel.name })}
            aria-expanded={open}
            aria-busy={saving}
            title={groups.join(', ')}
            disabled={saving}
            className={cn(
              'group/group-cell flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors',
              'hover:bg-muted/60 focus-visible:ring-ring/50 data-popup-open:bg-muted/60 outline-none focus-visible:ring-[3px]',
              'disabled:cursor-progress disabled:opacity-70',
              layout === 'card' ? '-ml-1.5 w-full' : '-ml-1.5 w-full max-w-50'
            )}
          />
        }
      >
        <span className='flex min-w-0 flex-1 items-center gap-1 overflow-hidden'>
          {visibleGroups.length > 0 ? (
            visibleGroups.map((group) => (
              <GroupBadge
                key={group}
                group={group}
                label={sensitiveVisible ? undefined : SENSITIVE_MASK}
                ratio={sensitiveVisible ? groupRatios?.[group] : undefined}
                size='sm'
              />
            ))
          ) : (
            <span className='text-muted-foreground text-xs'>-</span>
          )}
          {hiddenGroupCount > 0 && (
            <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
              +{hiddenGroupCount}
            </span>
          )}
        </span>
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
      </PopoverTrigger>
      <PopoverContent
        className='w-64 overflow-hidden rounded-xl p-0 shadow-lg'
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('Search...')}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className='max-h-[360px]'>
            <CommandEmpty>{t('No group found.')}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => {
                const selected = selectedGroups.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleToggle(option.value)}
                    className='data-[selected=true]:bg-muted items-center gap-3 rounded-lg px-3 py-2'
                  >
                    <Check
                      aria-hidden='true'
                      className={cn(
                        'size-4 shrink-0',
                        selected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className='min-w-0 flex-1 truncate'>
                      {sensitiveVisible ? option.label : SENSITIVE_MASK}
                    </span>
                    {option.suffix}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
