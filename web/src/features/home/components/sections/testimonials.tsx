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
import { Quote } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

import { SectionHeading } from '../section-heading'

/**
 * Typical developer scenarios, attributed by role rather than by name so the
 * page never presents invented people as real customers.
 */
export function Testimonials() {
  const { t } = useTranslation()

  const quotes = [
    {
      quote: t(
        'We moved from three provider SDKs to one Base URL. Switching models is now a config change, not a release.'
      ),
      role: t('Backend engineer'),
      context: t('SaaS product team'),
    },
    {
      quote: t(
        'Claude Code, Codex and Cherry Studio all run on one key. The usage log shows exactly where tokens go.'
      ),
      role: t('Independent developer'),
      context: t('AI coding workflows'),
    },
    {
      quote: t(
        'Each project gets its own scoped key and quota, so a runaway script can no longer drain the whole budget.'
      ),
      role: t('Engineering lead'),
      context: t('Internal AI platform'),
    },
  ]

  return (
    <section className='tc-landing-section'>
      <div className='tc-landing-container flex flex-col gap-14'>
        <SectionHeading
          eyebrow={t('What developers say')}
          title={t('Built for the way teams ship AI today')}
        />
        <div className='tc-quotes'>
          {quotes.map((item, index) => (
            <AnimateInView
              key={item.role}
              delay={index * 80}
              className='tc-landing-card tc-landing-card-hover flex flex-col gap-6 p-7'
            >
              <Quote
                className='size-6 text-(--tc-brand-accent)'
                aria-hidden='true'
              />
              <blockquote className='flex-1 text-[15px] leading-relaxed'>
                {item.quote}
              </blockquote>
              <div className='border-t pt-4 text-sm'>
                <div className='font-medium'>{item.role}</div>
                <div className='text-muted-foreground'>{item.context}</div>
              </div>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
