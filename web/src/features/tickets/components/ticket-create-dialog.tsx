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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import { createTicket } from '../api'
import { ticketQueryKeys } from '../lib/query-keys'
import { getTicketFormSchema, type TicketFormValues } from '../lib/ticket-form'
import type { Ticket } from '../types'

const TICKET_CREATE_FORM_ID = 'ticket-create-form'

type TicketCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (ticket: Ticket) => void
}

export function TicketCreateDialog(props: TicketCreateDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(getTicketFormSchema(t)),
    defaultValues: { title: '', content: '' },
  })

  useEffect(() => {
    if (!props.open) form.reset({ title: '', content: '' })
  }, [props.open, form])

  const createMutation = useMutation({
    mutationFn: async (values: TicketFormValues) => {
      const res = await createTicket(values)
      if (!res.success || !res.data) {
        throw createServerError(res, t('Failed to submit ticket'))
      }
      return res.data
    },
    onSuccess: async (ticket) => {
      toast.success(t('Ticket submitted'))
      await queryClient.invalidateQueries({
        queryKey: ticketQueryKeys.scope('self'),
      })
      props.onCreated(ticket)
      props.onOpenChange(false)
    },
    onError: (error) => handleServerError(error, t('Failed to submit ticket')),
  })

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!createMutation.isPending) props.onOpenChange(open)
      }}
      title={t('New Ticket')}
      description={t(
        'Describe your issue and our support team will reply as soon as possible.'
      )}
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form={TICKET_CREATE_FORM_ID}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? t('Submitting...') : t('Submit')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={TICKET_CREATE_FORM_ID}
          className='space-y-4'
          onSubmit={form.handleSubmit((values) =>
            createMutation.mutate(values)
          )}
        >
          <FormField
            control={form.control}
            name='title'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Title')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('Briefly summarize your issue')}
                    autoComplete='off'
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='content'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Description')}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder={t(
                      'Include details such as the model, request time and error message'
                    )}
                    className='min-h-36'
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
