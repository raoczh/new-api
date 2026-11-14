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
import { PencilLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { ApiKey } from '../types'
import { ApiKeyGroupCell } from './api-key-group-cell'
import { useApiKeys } from './api-keys-provider'
import type { GroupRatio } from './auto-group-visuals'

type ApiKeyGroupEditableCellProps = {
  apiKey: ApiKey
  ratio?: GroupRatio
  shouldReduceMotion: boolean
}

/**
 * The lines of a key in the list. Clicking them opens the edit dialog on that
 * key, where one line or several can be ticked and ordered.
 */
export function ApiKeyGroupEditableCell(props: ApiKeyGroupEditableCellProps) {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useApiKeys()
  const group = props.apiKey.group?.trim() || ''
  const ownLines = props.apiKey.auto_groups ?? []

  let summary = group || t('Follow user group')
  if (group === 'auto') {
    summary =
      ownLines.length > 0
        ? ownLines.join(' → ')
        : t('Follows the site-wide line order')
  }

  return (
    <button
      type='button'
      aria-label={t('Edit lines of {{name}}', { name: props.apiKey.name })}
      title={summary}
      onClick={() => {
        setCurrentRow(props.apiKey)
        setOpen('update')
      }}
      className={cn(
        'group/group-cell -ml-1.5 flex w-full max-w-50 min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors',
        'hover:bg-muted/60 focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]'
      )}
    >
      <ApiKeyGroupCell
        group={group}
        ratio={props.ratio}
        lineCount={ownLines.length}
        shouldReduceMotion={props.shouldReduceMotion}
        interactive={false}
      />
      <PencilLine
        aria-hidden='true'
        className='text-muted-foreground ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover/group-cell:opacity-100 group-focus-visible/group-cell:opacity-100'
      />
    </button>
  )
}
