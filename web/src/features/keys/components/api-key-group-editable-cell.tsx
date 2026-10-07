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
import { Check, ChevronsUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { TruncatedCell } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useMediaQuery } from '@/hooks'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { updateApiKey } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import type { ApiKey } from '../types'
import { useApiKeys } from './api-keys-provider'
import type { ApiKeyGroupOption } from './api-key-group-combobox'
import {
  AUTO_GROUP_FRAME_CLASS_NAME,
  AutoGroupFlowBorder,
  GroupRatioBadge,
  type GroupRatio,
} from './auto-group-visuals'

type ApiKeyGroupEditableCellProps = {
  apiKey: ApiKey
  groupOptions: ApiKeyGroupOption[]
  ratio?: GroupRatio
  shouldReduceMotion: boolean
}

export function ApiKeyGroupEditableCell(props: ApiKeyGroupEditableCellProps) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const { triggerRefresh } = useApiKeys()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const group = props.apiKey.group?.trim() || ''
  const isAuto = group === 'auto'

  const filteredOptions = useMemo(() => {
    const search = searchValue.trim().toLowerCase()
    if (!search) return props.groupOptions

    return props.groupOptions.filter((option) => {
      const ratioText = String(option.ratio ?? '').toLowerCase()
      return (
        option.value.toLowerCase().includes(search) ||
        option.label.toLowerCase().includes(search) ||
        option.desc?.toLowerCase().includes(search) ||
        ratioText.includes(search)
      )
    })
  }, [props.groupOptions, searchValue])

  const handleSelect = async (selectedValue: string) => {
    if (selectedValue === group) {
      setOpen(false)
      setSearchValue('')
      return
    }

    setIsUpdating(true)
    try {
      const payload = {
        id: props.apiKey.id,
        name: props.apiKey.name,
        remain_quota: props.apiKey.remain_quota,
        expired_time: props.apiKey.expired_time,
        unlimited_quota: props.apiKey.unlimited_quota,
        model_limits_enabled: props.apiKey.model_limits_enabled,
        model_limits: props.apiKey.model_limits || '',
        allow_ips: props.apiKey.allow_ips || '',
        group: selectedValue,
        auto_groups: selectedValue === 'auto' ? (props.apiKey.auto_groups || []) : [],
        cross_group_retry: selectedValue === 'auto' ? true : false,
      }

      const result = await updateApiKey(payload)
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.API_KEY_UPDATED))
        triggerRefresh()
      } else {
        handleServerError(result, t(ERROR_MESSAGES.UPDATE_FAILED))
      }
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsUpdating(false)
      setOpen(false)
      setSearchValue('')
    }
  }

  if (isAuto) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <div
              data-api-key-group-cell='auto'
              tabIndex={0}
              className={cn(
                'ml-0 flex items-center gap-3 overflow-visible text-xs',
                isMobile ? 'w-full justify-between' : 'max-w-50'
              )}
            />
          }
        >
          <StatusBadge
            label={t('Cross-group')}
            variant='info'
            copyable={false}
            className='px-0'
          />
          <GroupRatioBadge
            ratio={props.ratio}
            isAuto
            shouldReduceMotion={props.shouldReduceMotion}
          />
        </TooltipTrigger>
        <TooltipContent>
          <span className='text-xs'>
            {t(
              'Automatically selects the best available group with circuit breaker mechanism'
            )}
          </span>
        </TooltipContent>
      </Tooltip>
    )
  }

  const ratio =
    group && typeof props.ratio === 'number' ? props.ratio : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='ghost'
            role='combobox'
            aria-expanded={open}
            disabled={isUpdating}
            className={cn(
              'hover:bg-muted/50 h-auto w-full justify-start gap-2 px-2 py-1.5 font-normal',
              isMobile && 'justify-between'
            )}
          />
        }
      >
        <TruncatedCell
          className={isMobile ? 'w-full' : 'max-w-50'}
          tabIndex={-1}
          tooltipContent={group || t('Follow user group')}
          tooltipClassName='break-all'
        >
          <GroupBadge
            group={group}
            ratio={ratio}
            ratioLabel={group ? undefined : t('Inherited')}
            className='px-0'
            containerClassName={cn('gap-3', isMobile && 'w-full justify-between')}
          />
        </TruncatedCell>
        <ChevronsUpDown
          aria-hidden='true'
          className='ml-auto size-3.5 shrink-0 opacity-50'
        />
      </PopoverTrigger>
      <PopoverContent
        className='data-closed:zoom-out-100 data-open:zoom-in-100 data-[side=bottom]:slide-in-from-top-0 data-[side=left]:slide-in-from-right-0 data-[side=right]:slide-in-from-left-0 data-[side=top]:slide-in-from-bottom-0 w-[var(--anchor-width)] min-w-[280px] overflow-hidden rounded-xl p-0 shadow-lg data-closed:duration-75 data-open:duration-100'
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
                const isAutoOption = option.value === 'auto'

                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    data-auto-group-effect={isAutoOption ? 'option' : undefined}
                    onSelect={() => handleSelect(option.value)}
                    className={cn(
                      'data-[selected=true]:bg-muted items-start gap-3 rounded-lg px-3 py-3 transition-colors',
                      isAutoOption &&
                        cn(
                          AUTO_GROUP_FRAME_CLASS_NAME,
                          'border-primary/35 data-[selected=true]:border-primary/55'
                        )
                    )}
                  >
                    {isAutoOption && (
                      <AutoGroupFlowBorder
                        shouldReduceMotion={props.shouldReduceMotion}
                      />
                    )}
                    <Check
                      aria-hidden='true'
                      className={cn(
                        'mt-0.5 size-4',
                        group === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate font-medium'>
                        {option.label}
                      </span>
                      {option.desc && (
                        <span className='text-muted-foreground block truncate text-xs'>
                          {option.desc}
                        </span>
                      )}
                    </span>
                    <GroupRatioBadge
                      ratio={option.ratio}
                      isAuto={isAutoOption}
                      shouldReduceMotion={props.shouldReduceMotion}
                    />
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
