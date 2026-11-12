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
import { Grid2X2, Rows3, Table2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import {
  DATA_TABLE_VIEW_MODES,
  type DataTableViewMode,
} from '../hooks/use-data-table-view-mode'

export type DataTableViewModeToggleProps<TMode extends string> = {
  value: TMode
  onChange: (mode: TMode) => void
  className?: string
  /**
   * Modes to offer, in display order. Defaults to the standard card and table
   * pair; a view that adds its own mode (for example the model square's
   * vendor-grouped list) passes the full list here.
   */
  modes?: readonly TMode[]
}

type ModeMeta = {
  icon: React.ComponentType<{ className?: string }>
  /** i18n key naming the mode. */
  labelKey: string
}

const MODE_META: Record<string, ModeMeta> = {
  [DATA_TABLE_VIEW_MODES.CARD]: { icon: Grid2X2, labelKey: 'Card view' },
  [DATA_TABLE_VIEW_MODES.TABLE]: { icon: Table2, labelKey: 'Table view' },
  list: { icon: Rows3, labelKey: 'List view' },
}

const DEFAULT_MODES: readonly DataTableViewMode[] = [
  DATA_TABLE_VIEW_MODES.CARD,
  DATA_TABLE_VIEW_MODES.TABLE,
]

/**
 * Reusable icon segmented control for switching a data table between its view
 * modes. Shared, accessible version of the local control used by the model
 * square (`pricing-toolbar.tsx`).
 */
export function DataTableViewModeToggle<TMode extends string>(
  props: DataTableViewModeToggleProps<TMode>
) {
  const { t } = useTranslation()
  const modes: readonly TMode[] =
    props.modes ?? (DEFAULT_MODES as readonly TMode[])

  return (
    <div
      role='group'
      aria-label={t('View mode')}
      className={cn(
        'bg-muted/60 inline-flex h-8 items-center rounded-lg border p-0.5',
        props.className
      )}
    >
      {modes.map((mode) => {
        const meta = MODE_META[mode] ?? { icon: Table2, labelKey: mode }
        const Icon = meta.icon
        const label = t(meta.labelKey)
        const isActive = mode === props.value
        return (
          <Tooltip key={mode}>
            <TooltipTrigger
              render={
                <Button
                  type='button'
                  variant={isActive ? 'default' : 'ghost'}
                  size='icon-sm'
                  onClick={() => props.onChange(mode)}
                  aria-label={label}
                  aria-pressed={isActive}
                  className='h-full w-7'
                >
                  <Icon className='size-3.5' />
                </Button>
              }
            />
            <TooltipContent side='bottom' className='text-xs'>
              {label}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
