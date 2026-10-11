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
import { Download, ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { formatTimestampToDate } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { downloadTicketAttachment, getTicketAttachment } from '../api'
import type { TicketAttachment, TicketMessage, TicketScope } from '../types'

type TicketMessageBubbleProps = {
  message: TicketMessage
  scope: TicketScope
  /** Sent from the viewer's side: aligned right with the primary color. */
  own: boolean
}

export function TicketMessageBubble(props: TicketMessageBubbleProps) {
  const { t } = useTranslation()
  const sender = props.message.is_admin
    ? t('Support')
    : props.message.username || t('User')

  return (
    <li
      className={cn(
        'flex flex-col gap-1',
        props.own ? 'items-end' : 'items-start'
      )}
    >
      <span className='text-muted-foreground px-1 text-xs'>
        {sender} · {formatTimestampToDate(props.message.created_at)}
      </span>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap sm:max-w-[75%]',
          props.own
            ? 'bg-primary text-primary-foreground rounded-ee-sm'
            : 'bg-card text-card-foreground rounded-es-sm border'
        )}
      >
        {props.message.content}
        {props.message.attachments && props.message.attachments.length > 0 && (
          <ul className='mt-2 space-y-1 border-t border-current/20 pt-2'>
            {props.message.attachments.map((attachment) => (
              <TicketAttachmentItem
                key={attachment.id}
                attachment={attachment}
                scope={props.scope}
                ticketId={props.message.ticket_id}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

type TicketAttachmentItemProps = {
  attachment: TicketAttachment
  scope: TicketScope
  ticketId: number
}

function TicketAttachmentItem(props: TicketAttachmentItemProps) {
  const { t } = useTranslation()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const isImage = props.attachment.content_type.startsWith('image/')
  const filename = props.attachment.filename || t('File')

  useEffect(() => {
    if (!isImage) return

    let objectUrl: string | null = null
    let cancelled = false
    void getTicketAttachment(props.scope, props.ticketId, props.attachment.id)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch(() => setPreviewFailed(true))

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [isImage, props.attachment.id, props.scope, props.ticketId])

  const download = () =>
    downloadTicketAttachment(
      props.scope,
      props.ticketId,
      props.attachment
    ).catch((error: unknown) =>
      handleServerError(error, t('Failed to download attachment'))
    )

  return (
    <li className='flex min-w-0 items-center gap-2'>
      {isImage &&
        (previewUrl ? (
          <button
            type='button'
            className='focus-visible:ring-ring size-16 shrink-0 overflow-hidden rounded-md border outline-none focus-visible:ring-2'
            aria-label={`${t('Preview image')}: ${filename}`}
            onClick={() => setPreviewOpen(true)}
          >
            <img
              src={previewUrl}
              alt={filename}
              className='size-full object-cover'
            />
          </button>
        ) : (
          <span
            className='bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-md border'
            title={previewFailed ? t('Image preview unavailable') : undefined}
          >
            <ImageIcon className='size-5' aria-hidden='true' />
          </span>
        ))}
      <Button
        type='button'
        variant='link'
        size='sm'
        className='h-auto min-w-0 justify-start gap-1 px-0 text-current'
        onClick={() => void download()}
      >
        <span className='min-w-0 truncate'>{filename}</span>
        <Download className='size-3.5 shrink-0' aria-hidden='true' />
        <span className='text-xs opacity-75'>
          ({t('{{bytes}} bytes', { bytes: props.attachment.size })})
        </span>
      </Button>
      {isImage && previewUrl && (
        <Dialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={filename}
          contentClassName='sm:max-w-4xl'
          bodyClassName='flex justify-center'
        >
          <img
            src={previewUrl}
            alt={filename}
            className='max-h-[80vh] max-w-full object-contain'
          />
        </Dialog>
      )}
    </li>
  )
}
