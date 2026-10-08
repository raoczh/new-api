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
import { MessagesSquare, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePagination, useDataTable } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/use-debounce'
import { createServerError } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getTickets } from './api'
import { TicketConversation } from './components/ticket-conversation'
import { TicketCreateDialog } from './components/ticket-create-dialog'
import { TicketList } from './components/ticket-list'
import { TICKET_PAGE_SIZE } from './constants'
import { ticketQueryKeys } from './lib/query-keys'
import type { Ticket, TicketScope } from './types'

const EMPTY_TICKETS: Ticket[] = []

type TicketsWorkspaceProps = {
  scope: TicketScope
  /** Ticket opened in the conversation panel, kept in the URL. */
  selectedId: number | null
  onSelectedIdChange: (id: number | null) => void
}

export function TicketsWorkspace(props: TicketsWorkspaceProps) {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState(0)
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: TICKET_PAGE_SIZE,
  })
  const [createOpen, setCreateOpen] = useState(false)
  const debouncedKeyword = useDebounce(keyword.trim(), 400)

  useEffect(() => {
    setPagination((previous) => ({ ...previous, pageIndex: 0 }))
  }, [debouncedKeyword, status])

  const params = {
    p: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
    status,
    keyword: debouncedKeyword,
  }
  const listQuery = useQuery({
    queryKey: ticketQueryKeys.list(props.scope, params),
    queryFn: async () => {
      const res = await getTickets(props.scope, params)
      if (!res.success || !res.data) {
        throw createServerError(res, t('We could not load tickets.'))
      }
      return res.data
    },
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })

  const tickets = listQuery.data?.items ?? EMPTY_TICKETS
  const { table } = useDataTable({
    data: tickets,
    columns: [],
    totalCount: listQuery.data?.total ?? 0,
    manualPagination: true,
    columnFilters: [],
    pagination,
    onPaginationChange: setPagination,
    columnVisibilityStorageKey: false,
    columnSizingStorageKey: false,
  })

  const isSelf = props.scope === 'self'
  const hasSelection = props.selectedId !== null

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {isSelf ? t('My Tickets') : t('Ticket Management')}
        </SectionPageLayout.Title>
        {isSelf && (
          <SectionPageLayout.Actions>
            <Button size='sm' onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden='true' />
              {t('New Ticket')}
            </Button>
          </SectionPageLayout.Actions>
        )}
        <SectionPageLayout.Content>
          <div className='bg-card flex h-full min-h-[28rem] overflow-hidden rounded-xl border'>
            <aside
              className={cn(
                'min-h-0 w-full flex-col md:flex md:w-80 md:shrink-0 md:border-e lg:w-96',
                hasSelection ? 'hidden' : 'flex'
              )}
              aria-label={t('Ticket list')}
            >
              <TicketList
                scope={props.scope}
                tickets={tickets}
                isLoading={listQuery.isLoading}
                error={listQuery.error}
                onRetry={() => void listQuery.refetch()}
                selectedId={props.selectedId}
                onSelect={props.onSelectedIdChange}
                keyword={keyword}
                onKeywordChange={setKeyword}
                status={status}
                onStatusChange={setStatus}
                pagination={<DataTablePagination table={table} compact />}
              />
            </aside>
            <div
              className={cn(
                'min-h-0 min-w-0 flex-1 flex-col md:flex',
                hasSelection ? 'flex' : 'hidden'
              )}
            >
              {props.selectedId !== null ? (
                <TicketConversation
                  key={props.selectedId}
                  scope={props.scope}
                  ticketId={props.selectedId}
                  onBack={() => props.onSelectedIdChange(null)}
                />
              ) : (
                <EmptyState
                  icon={MessagesSquare}
                  title={t('Select a ticket to view the conversation')}
                  description={
                    isSelf
                      ? t(
                          'Need help? Create a new ticket and we will reply here.'
                        )
                      : undefined
                  }
                  action={
                    isSelf ? (
                      <Button size='sm' onClick={() => setCreateOpen(true)}>
                        <Plus aria-hidden='true' />
                        {t('New Ticket')}
                      </Button>
                    ) : undefined
                  }
                  className='m-auto w-full bg-transparent'
                />
              )}
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      {isSelf && (
        <TicketCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(ticket) => props.onSelectedIdChange(ticket.id)}
        />
      )}
    </>
  )
}
