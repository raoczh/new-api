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
import { CircleHelp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFAQ } from '@/features/dashboard/hooks/use-status-data'
import { useStatus } from '@/hooks/use-status'

/**
 * Global help entry in the sidebar footer. It keeps support content out of the
 * dashboard while preserving the FAQ and contact methods configured by the
 * administrator.
 */
export function HelpPopover() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { items: faqItems } = useFAQ()

  const email = status?.contact_email?.trim()
  const wechatQR = status?.contact_wechat_qrcode?.trim()
  const qqGroup = status?.contact_qq_group?.trim()
  const hasContact = Boolean(email || wechatQR || qqGroup)
  const hasFAQ = faqItems.length > 0

  if (!hasContact && !hasFAQ) return null

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant='ghost'
            className='tc-sidebar-action'
            aria-label={t('Support')}
          />
        }
      >
        <CircleHelp aria-hidden='true' />
        <span>{t('Support')}</span>
      </PopoverTrigger>
      <PopoverContent
        side='top'
        align='start'
        className='w-80 max-w-[calc(100vw-2rem)] p-0'
        aria-label={t('Support')}
      >
        <div className='border-b px-4 py-3'>
          <div className='text-sm font-semibold'>{t('Support')}</div>
          <p className='text-muted-foreground text-xs'>
            {hasFAQ
              ? t('Answers for common access and billing questions')
              : t('Contact support')}
          </p>
        </div>

        <ScrollArea className='max-h-[min(24rem,60vh)]'>
          {hasFAQ && (
            <Accordion className='w-full px-4'>
              {faqItems.map((item, index) => (
                <AccordionItem
                  key={item.id ?? `faq-${index}`}
                  value={`help-faq-${item.id ?? index}`}
                  className='border-border/60'
                >
                  <AccordionTrigger className='text-start text-sm hover:no-underline'>
                    <Markdown className='text-sm leading-relaxed font-medium'>
                      {item.question}
                    </Markdown>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Markdown className='text-muted-foreground text-sm'>
                      {item.answer}
                    </Markdown>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {hasContact && (
            <div className='space-y-3 border-t px-4 py-3'>
              <p className='text-muted-foreground text-xs font-medium'>
                {t('Contact support')}
              </p>
              {email && (
                <div className='min-w-0 space-y-1'>
                  <p className='text-muted-foreground text-xs'>
                    {t('Contact Email')}
                  </p>
                  <a
                    className='text-sm font-medium break-all hover:underline'
                    href={`mailto:${email}`}
                  >
                    {email}
                  </a>
                </div>
              )}
              {wechatQR && (
                <div className='space-y-1'>
                  <p className='text-muted-foreground text-xs'>
                    {t('WeChat Group QR Code')}
                  </p>
                  <img
                    src={wechatQR}
                    alt={t('WeChat Group QR Code')}
                    className='size-32 rounded-sm border bg-white object-contain p-1'
                  />
                </div>
              )}
              {qqGroup && (
                <div className='min-w-0 space-y-1'>
                  <p className='text-muted-foreground text-xs'>
                    {t('QQ Group')}
                  </p>
                  <p className='text-sm font-medium break-all'>{qqGroup}</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
