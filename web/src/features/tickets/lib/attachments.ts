import {
  TICKET_ATTACHMENT_MAX_COUNT,
  TICKET_ATTACHMENT_MAX_SIZE,
} from '../constants'

export type PendingTicketAttachment = {
  id: string
  file: File
}

export function appendTicketAttachments(
  current: PendingTicketAttachment[],
  incoming: File[]
): {
  attachments: PendingTicketAttachment[]
  hasOversizedFile: boolean
  exceedsCount: boolean
} {
  const validFiles = incoming.filter(
    (file) => file.size <= TICKET_ATTACHMENT_MAX_SIZE
  )
  const combined = [
    ...current,
    ...validFiles.map((file) => ({ id: crypto.randomUUID(), file })),
  ]
  return {
    attachments: combined.slice(0, TICKET_ATTACHMENT_MAX_COUNT),
    hasOversizedFile: validFiles.length !== incoming.length,
    exceedsCount: combined.length > TICKET_ATTACHMENT_MAX_COUNT,
  }
}
