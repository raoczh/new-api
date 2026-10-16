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
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

import { SectionHeading } from '../section-heading'

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      title: t('Create an account'),
      description: t('Sign up and open the console in under a minute.'),
    },
    {
      title: t('Add balance'),
      description: t('Top up once; every model draws from the same balance.'),
    },
    {
      title: t('Create an API key'),
      description: t('Scope it by model, quota and expiry for each project.'),
    },
    {
      title: t('Change the Base URL'),
      description: t(
        'Point your SDK or tool at this gateway and start calling models.'
      ),
    },
  ]

  return (
    <section className='tc-landing-section bg-muted/30 border-y'>
      <div className='tc-landing-container flex flex-col gap-14'>
        <SectionHeading
          eyebrow={t('How It Works')}
          title={t('From sign-up to first call in four steps')}
        />
        <ol className='tc-steps'>
          {steps.map((step, index) => (
            <AnimateInView
              as='li'
              key={step.title}
              delay={index * 80}
              className='tc-landing-card flex flex-col gap-3 p-6'
            >
              <span className='tc-step-index'>
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className='font-semibold tracking-tight'>{step.title}</h3>
              <p className='text-muted-foreground text-sm leading-relaxed'>
                {step.description}
              </p>
            </AnimateInView>
          ))}
        </ol>
      </div>
    </section>
  )
}
