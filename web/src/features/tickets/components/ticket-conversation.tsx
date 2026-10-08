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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Lock, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import { closeTicket, getTicket, replyTicket } from '../api'
import { TICKET_CONTENT_MAX_LENGTH, TICKET_STATUS } from '../constants'
import { ticketQueryKeys } from '../lib/query-keys'
import type { TicketScope } from '../types'
import { TicketMessageBubble } from './ticket-message-bubble'
import { TicketStatusBadge } from './ticket-status-badge'

type TicketConversationProps = {
  scope: TicketScope
  ticketId: number
  /** Shown on narrow screens where the list and conversation do not fit side by side. */
  onBack: () => void
}

export function TicketConversation(props: TicketConversationProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [closeOpen, setCloseOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const detailQuery = useQuery({
    queryKey: ticketQueryKeys.detail(props.scope, props.ticketId),
    queryFn: async () => {
      const res = await getTicket(props.scope, props.ticketId)
      if (!res.success || !res.data) {
        throw createServerError(res, t('We could not load this ticket.'))
      }
      return res.data
    },
    // Keep the conversation fresh while it is open so replies from the
    // other side appear without a manual refresh.
    refetchInterval: 30_000,
  })

  const messageCount = detailQuery.data?.messages.length ?? 0
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messageCount])

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ticketQueryKeys.scope(props.scope),
    })

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await replyTicket(props.scope, props.ticketId, content)
      if (!res.success) throw createServerError(res, t('Failed to send reply'))
    },
    onSuccess: async () => {
      setDraft('')
      await invalidate()
    },
    onError: (error) => handleServerError(error, t('Failed to send reply')),
  })

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await closeTicket(props.scope, props.ticketId)
      if (!res.success) {
        throw createServerError(res, t('Failed to close ticket'))
      }
    },
    onSuccess: async () => {
      toast.success(t('Ticket closed'))
      setCloseOpen(false)
      await invalidate()
    },
    onError: (error) => handleServerError(error, t('Failed to close ticket')),
  })

  const ticket = detailQuery.data?.ticket
  const closed = ticket?.status === TICKET_STATUS.CLOSED
  const trimmedDraft = draft.trim()
  const canSend =
    trimmedDraft.length > 0 &&
    draft.length <= TICKET_CONTENT_MAX_LENGTH &&
    !replyMutation.isPending

  const submitReply = () => {
    if (canSend) replyMutation.mutate(trimmedDraft)
  }

  return (
    <section
      className='flex min-h-0 flex-1 flex-col'
      aria-label={ticket?.title ?? t('Ticket')}
    >
      <header className='flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4'>
        <Button
          variant='ghost'
          size='icon-sm'
          className='md:hidden'
          aria-label={t('Back to ticket list')}
          onClick={props.onBack}
        >
          <ArrowLeft aria-hidden='true' />
        </Button>
        <div className='min-w-0 flex-1'>
          {ticket ? (
            <>
              <h2 className='truncate text-sm font-semibold'>{ticket.title}</h2>
              <p className='text-muted-foreground truncate text-xs'>
                #{ticket.id}
                {props.scope === 'admin' && ` · ${ticket.username}`}
              </p>
            </>
          ) : (
            <Skeleton className='h-8 w-48' />
          )}
        </div>
        {ticket && <TicketStatusBadge status={ticket.status} />}
        {ticket && !closed && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => setCloseOpen(true)}
            disabled={closeMutation.isPending}
          >
            {t('Close Ticket')}
          </Button>
        )}
      </header>

      <div
        ref={scrollRef}
        className='bg-muted/20 min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4'
        aria-live='polite'
        aria-busy={detailQuery.isFetching}
      >
        {detailQuery.isLoading && (
          <div className='space-y-4'>
            <Skeleton className='h-16 w-2/3' />
            <Skeleton className='ms-auto h-16 w-2/3' />
          </div>
        )}
        {detailQuery.isError && (
          <ErrorState
            title={t('We could not load this ticket.')}
            description={detailQuery.error.message}
            onRetry={() => void detailQuery.refetch()}
          />
        )}
        {detailQuery.data && (
          <ol className='space-y-4'>
            {detailQuery.data.messages.map((message) => (
              <TicketMessageBubble
                key={message.id}
                message={message}
                // A message is "mine" when it was sent from the same side as the viewer.
                own={message.is_admin === (props.scope === 'admin')}
              />
            ))}
          </ol>
        )}
      </div>

      <footer className='shrink-0 border-t p-3 sm:px-4'>
        {closed ? (
          <p className='text-muted-foreground flex items-center justify-center gap-2 py-2 text-sm'>
            <Lock className='size-4' aria-hidden='true' />
            {t('This ticket is closed and can no longer be replied to.')}
          </p>
        ) : (
          <form
            className='flex flex-col gap-2'
            onSubmit={(event) => {
              event.preventDefault()
              submitReply()
            }}
          >
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  (event.ctrlKey || event.metaKey) &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault()
                  submitReply()
                }
              }}
              placeholder={t('Type your reply...')}
              aria-label={t('Reply')}
              aria-invalid={draft.length > TICKET_CONTENT_MAX_LENGTH}
              disabled={!ticket}
              className='max-h-48 min-h-20 resize-none'
            />
            <div className='flex items-center justify-between gap-2'>
              <span className='text-muted-foreground text-xs'>
                {t('Press Ctrl+Enter to send')} · {draft.length}/
                {TICKET_CONTENT_MAX_LENGTH}
              </span>
              <Button type='submit' size='sm' disabled={!canSend || !ticket}>
                <Send aria-hidden='true' />
                {replyMutation.isPending ? t('Sending...') : t('Send')}
              </Button>
            </div>
          </form>
        )}
      </footer>

      <ConfirmDialog
        open={closeOpen}
        onOpenChange={(open) => {
          if (!closeMutation.isPending) setCloseOpen(open)
        }}
        title={t('Close Ticket')}
        desc={t('After closing, no one can reply to this ticket. Continue?')}
        isLoading={closeMutation.isPending}
        confirmText={t('Close Ticket')}
        handleConfirm={() => closeMutation.mutate()}
      />
    </section>
  )
}
