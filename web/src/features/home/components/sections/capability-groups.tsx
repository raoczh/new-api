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
import {
  BarChart3,
  Check,
  KeyRound,
  Route,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

import { SectionHeading } from '../section-heading'

type CapabilityGroup = {
  icon: LucideIcon
  title: string
  description: string
  points: string[]
}

export function CapabilityGroups() {
  const { t } = useTranslation()

  const groups: CapabilityGroup[] = [
    {
      icon: Route,
      title: t('Routing and reliability'),
      description: t('Keep requests flowing when a provider slows down.'),
      points: [
        t('Channel weights and priorities'),
        t('Automatic retry on another channel'),
        t('Model name mapping per channel'),
        t('Per-group model availability'),
      ],
    },
    {
      icon: KeyRound,
      title: t('Access control'),
      description: t('Give every project exactly the access it needs.'),
      points: [
        t('Multiple API keys per account'),
        t('Model allowlists for each key'),
        t('Quota caps and expiry dates'),
        t('IP allowlists'),
      ],
    },
    {
      icon: Wallet,
      title: t('Billing'),
      description: t('Pay for what you use, with prices you can check.'),
      points: [
        t('Public per-model pricing'),
        t('One balance for every model'),
        t('Online top-up and redemption codes'),
        t('Group pricing ratios'),
      ],
    },
    {
      icon: BarChart3,
      title: t('Observability'),
      description: t('See where every token and every cent went.'),
      points: [
        t('Request logs with tokens and cost'),
        t('Usage charts by model and time'),
        t('Latency and error visibility'),
        t('Log export'),
      ],
    },
  ]

  return (
    <section
      id='capabilities'
      className='tc-landing-section bg-muted/30 border-y'
    >
      <div className='tc-landing-container flex flex-col gap-14'>
        <SectionHeading
          eyebrow={t('Platform')}
          title={t('Everything a production AI stack needs')}
        />
        <div className='grid gap-4 md:grid-cols-2'>
          {groups.map((group, index) => (
            <AnimateInView
              key={group.title}
              delay={(index % 2) * 80}
              className='tc-landing-card tc-landing-card-hover flex flex-col gap-6 p-7 md:p-8'
            >
              <div className='flex items-start gap-4'>
                <span className='tc-landing-icon'>
                  <group.icon />
                </span>
                <div className='flex flex-col gap-1'>
                  <h3 className='text-lg font-semibold tracking-tight'>
                    {group.title}
                  </h3>
                  <p className='text-muted-foreground text-sm'>
                    {group.description}
                  </p>
                </div>
              </div>
              <ul className='grid gap-3 sm:grid-cols-2'>
                {group.points.map((point) => (
                  <li key={point} className='flex items-start gap-2 text-sm'>
                    <Check
                      className='mt-0.5 size-4 shrink-0 text-(--tc-brand-accent)'
                      aria-hidden='true'
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
