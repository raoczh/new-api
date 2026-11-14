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
import { Link } from '@tanstack/react-router'
import { MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useIsSidebarModuleVisible } from '@/hooks/use-sidebar-config'
import { cn } from '@/lib/utils'

export interface StartChatActionProps {
  modelName: string
  /**
   * Group that serves the model. Passing it keeps the chat on a group that
   * actually offers the model instead of the reader's default group.
   */
  group?: string
  /** Matches the buttons it sits next to; a dialog footer uses `default`. */
  size?: 'sm' | 'default'
  className?: string
}

/**
 * Takes the reader from a model's details straight into the chat with that
 * model selected. Chatting in the browser needs no key and no setup, which is
 * the shortest path from "what is this model" to "let me try it". Hidden when
 * the chat is turned off for this site.
 */
export function StartChatAction(props: StartChatActionProps) {
  const { t } = useTranslation()
  const chatVisible = useIsSidebarModuleVisible('/playground')

  if (!chatVisible || !props.modelName) return null

  return (
    <Button
      role='link'
      size={props.size ?? 'sm'}
      className={cn('shrink-0', props.className)}
      render={
        <Link
          to='/playground'
          search={{
            model: props.modelName,
            ...(props.group ? { group: props.group } : {}),
          }}
        />
      }
    >
      <MessageSquare data-icon='inline-start' aria-hidden='true' />
      {t('Start chatting')}
    </Button>
  )
}
