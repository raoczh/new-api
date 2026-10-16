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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Markdown } from '@/components/ui/markdown'
import { useFAQ } from '@/features/dashboard/hooks/use-status-data'

import { SectionHeading } from '../section-heading'

type FaqEntry = { key: string; question: string; answer: string }

/** Admin-configured FAQ entries win; built-in answers fill an empty list. */
export function Faq() {
  const { t } = useTranslation()
  const { items } = useFAQ()

  const defaults: FaqEntry[] = [
    {
      key: 'compat',
      question: t('Do I need to change my code?'),
      answer: t(
        'No. Keep the official SDK you already use and replace the Base URL and API key. Request and response formats stay the same.'
      ),
    },
    {
      key: 'protocols',
      question: t('Which API formats are supported?'),
      answer: t(
        'OpenAI Chat Completions and Responses, Anthropic Messages and Gemini generateContent, plus image, audio and embedding endpoints.'
      ),
    },
    {
      key: 'billing',
      question: t('How am I billed?'),
      answer: t(
        'You top up a balance and each request is charged by actual usage at the price listed for that model. Logs show the cost of every call.'
      ),
    },
    {
      key: 'keys',
      question: t('Can I limit what a key can do?'),
      answer: t(
        'Yes. Each API key can be limited to specific models, a quota, an expiry date and allowed IP addresses.'
      ),
    },
    {
      key: 'tools',
      question: t('Does it work with Claude Code, Codex and other tools?'),
      answer: t(
        'Yes. Any tool that lets you set a Base URL works. The docs include step-by-step setup for popular coding tools and clients.'
      ),
    },
  ]

  const entries: FaqEntry[] = items.length
    ? items.map((item, index) => ({
        key: String(item.id ?? index),
        question: item.question,
        answer: item.answer,
      }))
    : defaults

  return (
    <section className='tc-landing-section'>
      <div className='tc-landing-container tc-faq-layout'>
        <div className='tc-faq-aside flex flex-col gap-6'>
          <SectionHeading
            align='start'
            eyebrow={t('FAQ')}
            title={t('Questions, answered')}
            description={t(
              'Anything else? The documentation covers setup, errors and billing in detail.'
            )}
          />
          <Link
            to='/docs'
            className='text-foreground/80 hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors'
          >
            {t('Usage Documentation')}
            <ArrowRight className='size-4' aria-hidden='true' />
          </Link>
        </div>
        <AnimateInView className='tc-landing-card px-6 py-2 md:px-8'>
          <Accordion>
            {entries.map((entry) => (
              <AccordionItem key={entry.key} value={entry.key}>
                <AccordionTrigger className='py-5 text-base hover:no-underline'>
                  {entry.question}
                </AccordionTrigger>
                <AccordionContent>
                  <Markdown className='text-muted-foreground pb-4 text-sm leading-relaxed'>
                    {entry.answer}
                  </Markdown>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimateInView>
      </div>
    </section>
  )
}
