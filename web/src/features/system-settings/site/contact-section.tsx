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
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const contactSchema = z.object({
  Email: z.string(),
  WeChatQRCode: z.string(),
  QQGroup: z.string(),
})

type ContactFormValues = z.infer<typeof contactSchema>

type ContactSectionProps = {
  defaultValues: ContactFormValues
}

export function ContactSection({ defaultValues }: ContactSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const formDefaults = useMemo<ContactFormValues>(
    () => defaultValues,
    [defaultValues]
  )

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const onSubmit = async (data: ContactFormValues) => {
    const updates: Array<{ key: string; value: string }> = []

    if (data.Email !== defaultValues.Email) {
      updates.push({ key: 'contact.email', value: data.Email })
    }
    if (data.WeChatQRCode !== defaultValues.WeChatQRCode) {
      updates.push({ key: 'contact.wechat_qrcode', value: data.WeChatQRCode })
    }
    if (data.QQGroup !== defaultValues.QQGroup) {
      updates.push({ key: 'contact.qq_group', value: data.QQGroup })
    }

    if (updates.length === 0) {
      return { success: true }
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsSection title={t('Contact Information')}>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Configure contact information displayed on the home page and in legal documents'
        )}
      </p>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormField
            control={form.control}
            name='Email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Contact Email')}</FormLabel>
                <FormControl>
                  <Input placeholder='contact@example.com' {...field} />
                </FormControl>
                <FormDescription>
                  {t('Email address for users to contact support')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='WeChatQRCode'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('WeChat Group QR Code')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='https://example.com/wechat-qr.png'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('URL of WeChat group QR code image')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='QQGroup'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('QQ Group')}</FormLabel>
                <FormControl>
                  <Input placeholder='123456789' {...field} />
                </FormControl>
                <FormDescription>
                  {t('QQ group number for user support')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
