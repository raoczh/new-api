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
import { ArrowRight, Bot, Building2, Code2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { SectionHeading } from '@/features/home/components/section-heading'

export function UseCases() {
  const { t } = useTranslation()

  const cases = [
    {
      icon: Code2,
      title: t('AI coding tools'),
      description: t(
        'Run Claude Code, Codex, Cursor-style IDEs and CLI agents on one key.'
      ),
      slug: 'config/claude-code',
    },
    {
      icon: Bot,
      title: t('Products and agents'),
      description: t(
        'Ship features on several models and switch between them without a release.'
      ),
      slug: 'api/index',
    },
    {
      icon: Building2,
      title: t('Team platforms'),
      description: t(
        'Hand out scoped keys per project and keep spending visible in one place.'
      ),
      slug: 'guides/billing',
    },
  ]

  return (
    <section className='tc-landing-section'>
      <div className='tc-landing-container flex flex-col gap-14'>
        <SectionHeading
          eyebrow={t('Use cases')}
          title={t('One gateway, many workloads')}
        />
        <div className='tc-quotes'>
          {cases.map((item, index) => (
            <AnimateInView
              key={item.title}
              delay={index * 80}
              className='tc-landing-card tc-landing-card-hover flex flex-col gap-5 p-7'
            >
              <span className='tc-landing-icon'>
                <item.icon />
              </span>
              <div className='flex flex-1 flex-col gap-2'>
                <h3 className='text-lg font-semibold tracking-tight'>
                  {item.title}
                </h3>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {item.description}
                </p>
              </div>
              <Link
                to='/docs/$'
                params={{ _splat: item.slug }}
                className='text-foreground/80 hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors'
              >
                {t('Read the guide')}
                <ArrowRight className='size-4' aria-hidden='true' />
              </Link>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
