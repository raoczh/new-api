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
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { HtmlContent } from '@/components/html-content'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getEmailPreview } from '@/features/open-source-promotion/api'
import { requireServerSuccess } from '@/lib/server-error-message'

const PREVIEW_LANGUAGES = [
  { value: 'zh-CN', labelKey: 'Chinese' },
  { value: 'en', labelKey: 'English' },
] as const

// The built-in copy is the fallback used when the template fields above are
// empty, so administrators can read it here instead of sending themselves a
// test message.
export function OpenSourcePromotionEmailPreview() {
  const { t } = useTranslation()
  const [language, setLanguage] = useState<string>(PREVIEW_LANGUAGES[0].value)

  const previewQuery = useQuery({
    queryKey: ['open-source-promotion-email-preview'],
    queryFn: async () => requireServerSuccess(await getEmailPreview()),
  })

  const previews = previewQuery.data?.data?.previews ?? []

  let previewContent: ReactNode
  if (previewQuery.isLoading) {
    previewContent = <Skeleton className='h-40 w-full' />
  } else if (previewQuery.isError) {
    previewContent = (
      <p className='text-destructive text-sm'>
        {t('Failed to load the email preview')}
      </p>
    )
  } else {
    previewContent = (
      <Tabs value={language} onValueChange={setLanguage}>
        <TabsList>
          {PREVIEW_LANGUAGES.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {t(option.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
        {PREVIEW_LANGUAGES.map((option) => {
          const preview =
            previews.find((item) => item.language === option.value) ??
            previews[0]
          return (
            <TabsContent
              key={option.value}
              value={option.value}
              className='space-y-3 pt-3'
            >
              <div className='space-y-1'>
                <span className='text-muted-foreground text-xs font-medium'>
                  {t('Subject')}
                </span>
                <p className='text-sm font-medium break-words'>
                  {preview?.subject}
                </p>
              </div>
              <div className='space-y-1'>
                <span className='text-muted-foreground text-xs font-medium'>
                  {t('Body')}
                </span>
                <div className='bg-muted/40 rounded-lg border p-3'>
                  <HtmlContent
                    content={preview?.body ?? ''}
                    className='text-sm'
                  />
                </div>
              </div>
            </TabsContent>
          )
        })}
      </Tabs>
    )
  }

  return (
    <section className='min-w-0 space-y-3 rounded-xl border p-4'>
      <div className='space-y-1'>
        <h4 className='text-sm font-semibold'>{t('Built-in email template')}</h4>
        <p className='text-muted-foreground text-sm'>
          {t(
            'This is the copy used when the subject and body fields above are empty. Sample values fill in the placeholders.'
          )}
        </p>
      </div>
      {previewContent}
    </section>
  )
}
