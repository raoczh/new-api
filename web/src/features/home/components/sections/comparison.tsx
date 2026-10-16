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
import { Check, Minus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

import { SectionHeading } from '../section-heading'

interface CompareColumnProps {
  title: string
  items: string[]
  highlight?: boolean
  delay?: number
}

function CompareColumn(props: CompareColumnProps) {
  const Icon = props.highlight ? Check : Minus
  return (
    <AnimateInView
      delay={props.delay}
      className={cn(
        'tc-landing-card flex flex-col gap-6 p-7 md:p-9',
        props.highlight && 'tc-compare-highlight'
      )}
    >
      <h3 className='text-lg font-semibold tracking-tight'>{props.title}</h3>
      <ul className='flex flex-col gap-4'>
        {props.items.map((item) => (
          <li key={item} className='flex items-start gap-3 text-sm'>
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                props.highlight
                  ? 'text-(--tc-brand-accent)'
                  : 'text-muted-foreground'
              )}
              aria-hidden='true'
            />
            <span className={cn(!props.highlight && 'text-muted-foreground')}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </AnimateInView>
  )
}

export function Comparison() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()

  return (
    <section className='tc-landing-section'>
      <div className='tc-landing-container flex flex-col gap-14'>
        <SectionHeading
          eyebrow={t('Why a gateway')}
          title={t('Stop wiring every provider by hand')}
          description={t(
            'Direct integrations multiply keys, invoices and SDKs. A gateway keeps them behind one contract.'
          )}
        />
        <div className='tc-compare'>
          <CompareColumn
            title={t('Integrating each provider directly')}
            items={[
              t('One account, key and invoice per provider'),
              t('Different SDKs and request formats to maintain'),
              t('An outage means editing code and redeploying'),
              t('Spend is scattered across dashboards'),
            ]}
          />
          <CompareColumn
            highlight
            delay={100}
            title={t('Through {{name}}', { name: systemName })}
            items={[
              t('One balance and one key for every model'),
              t('Keep the official SDKs; change only the Base URL'),
              t('Failed calls retry on another channel'),
              t('Every request logged with tokens and cost'),
            ]}
          />
        </div>
      </div>
    </section>
  )
}
