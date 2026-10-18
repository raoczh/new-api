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
import { MessageSquarePlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import { groupConversations, sortConversations } from '../../lib'
import type { ConversationGroupKey, PlaygroundConversation } from '../../types'

const GROUP_LABEL_KEYS: Record<ConversationGroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  previous7Days: 'Previous 7 days',
  older: 'Older',
}

type PlaygroundHistoryPanelProps = {
  activeConversationId: string
  conversations: PlaygroundConversation[]
  disabled?: boolean
  onCreate: () => void
  onDelete: (conversationId: string) => void
  onSelect: (conversationId: string) => void
}

export function PlaygroundHistoryPanel({
  activeConversationId,
  conversations,
  disabled = false,
  onCreate,
  onDelete,
  onSelect,
}: PlaygroundHistoryPanelProps) {
  const { t } = useTranslation()
  const [pendingDelete, setPendingDelete] =
    useState<PlaygroundConversation | null>(null)
  const groups = useMemo(
    () => groupConversations(sortConversations(conversations)),
    [conversations]
  )

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5'>
        <h2 className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
          {t('History')}
        </h2>
        <Button
          className='gap-1.5'
          disabled={disabled}
          onClick={onCreate}
          size='sm'
          variant='ghost'
        >
          <MessageSquarePlusIcon className='size-4' aria-hidden='true' />
          {t('New chat')}
        </Button>
      </div>

      <ScrollArea className='min-h-0 flex-1'>
        <div className='flex flex-col gap-4 p-2'>
          {groups.length === 0 && (
            <p className='text-muted-foreground px-2 py-6 text-center text-sm'>
              {t('No conversations yet')}
            </p>
          )}

          {groups.map((group) => (
            <section
              className='flex flex-col gap-1'
              key={group.key}
              aria-label={t(GROUP_LABEL_KEYS[group.key])}
            >
              <h3 className='text-muted-foreground px-2 text-xs font-medium'>
                {t(GROUP_LABEL_KEYS[group.key])}
              </h3>
              {group.items.map((conversation) => {
                const isActive = conversation.id === activeConversationId

                return (
                  <div
                    className={cn(
                      'group/item flex items-center gap-1 rounded-md pr-1 transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted/60'
                    )}
                    key={conversation.id}
                  >
                    <button
                      aria-current={isActive ? 'true' : undefined}
                      className='min-w-0 flex-1 truncate px-2 py-1.5 text-start text-sm disabled:cursor-default'
                      disabled={disabled}
                      onClick={() => onSelect(conversation.id)}
                      type='button'
                    >
                      {conversation.title || t('Untitled conversation')}
                    </button>
                    <Button
                      aria-label={t('Delete conversation')}
                      className='text-muted-foreground hover:text-destructive size-7 shrink-0 opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100'
                      disabled={disabled}
                      onClick={() => setPendingDelete(conversation)}
                      size='icon-sm'
                      variant='ghost'
                    >
                      <Trash2Icon className='size-3.5' aria-hidden='true' />
                    </Button>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      </ScrollArea>

      <ConfirmDialog
        destructive
        desc={t(
          'This conversation will be deleted. This cannot be undone.'
        )}
        confirmText={t('Delete')}
        handleConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id)
          setPendingDelete(null)
        }}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={t('Delete this conversation?')}
      />
    </div>
  )
}
