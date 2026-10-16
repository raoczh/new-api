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
import {
  ArrowRight,
  BarChart3,
  KeyRound,
  Layers,
  Route,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { SectionHeading } from '../section-heading'

interface BentoCardProps {
  className: string
  icon: ReactNode
  title: string
  description: string
  delay?: number
  children?: ReactNode
}

function BentoCard(props: BentoCardProps) {
  return (
    <AnimateInView
      delay={props.delay}
      className={cn(
        'tc-landing-card tc-landing-card-hover tc-bento-item',
        props.className
      )}
    >
      <span className='tc-landing-icon'>{props.icon}</span>
      <div className='flex flex-col gap-2'>
        <h3 className='text-lg font-semibold tracking-tight'>{props.title}</h3>
        <p className='text-muted-foreground text-sm leading-relaxed'>
          {props.description}
        </p>
      </div>
      {props.children}
    </AnimateInView>
  )
}

const PROTOCOLS = [
  { icon: 'OpenAI', name: 'OpenAI', path: '/v1/chat/completions' },
  { icon: 'Claude.Color', name: 'Claude', path: '/v1/messages' },
  { icon: 'Gemini.Color', name: 'Gemini', path: '/v1beta/models' },
] as const

const USAGE_BARS = [38, 62, 48, 80, 56, 92, 70] as const

export function Features() {
  const { t } = useTranslation()

  return (
    <section className='tc-landing-section'>
      <div className='tc-landing-container flex flex-col gap-14'>
        <SectionHeading
          eyebrow={t('Capabilities')}
          title={t('Everything between your app and the model')}
          description={t(
            'Access, routing, billing and observability live in one place, so your code only talks to one endpoint.'
          )}
        />
        <div className='tc-bento'>
          <BentoCard
            className='tc-bento-wide'
            icon={<Layers />}
            title={t('Native protocols, one Base URL')}
            description={t(
              'Call OpenAI, Claude and Gemini style APIs with their own SDKs. Only the Base URL and key change.'
            )}
          >
            <div className='tc-bento-visual grid gap-2'>
              {PROTOCOLS.map((protocol) => (
                <div
                  key={protocol.name}
                  className='flex items-center gap-3 font-mono text-xs'
                >
                  {getLobeIcon(protocol.icon, 18)}
                  <span className='w-14 font-sans font-medium'>
                    {protocol.name}
                  </span>
                  <span className='text-muted-foreground truncate'>
                    {protocol.path}
                  </span>
                </div>
              ))}
            </div>
          </BentoCard>
          <BentoCard
            className='tc-bento-narrow'
            delay={80}
            icon={<Route />}
            title={t('Smart routing')}
            description={t(
              'Weight channels, set priorities and retry failed calls on another channel automatically.'
            )}
          />
          <BentoCard
            className='tc-bento-third'
            delay={60}
            icon={<KeyRound />}
            title={t('Scoped API keys')}
            description={t(
              'Limit each key by model, quota, expiry and IP so every project gets only what it needs.'
            )}
          />
          <BentoCard
            className='tc-bento-third'
            delay={120}
            icon={<Wallet />}
            title={t('Transparent billing')}
            description={t(
              'Prices are listed per model and every request is charged from your balance by actual usage.'
            )}
          />
          <BentoCard
            className='tc-bento-third'
            delay={180}
            icon={<BarChart3 />}
            title={t('Usage you can audit')}
            description={t(
              'Each call is logged with model, tokens, cost and latency for review and export.'
            )}
          >
            <div className='tc-bento-visual flex h-20 items-end gap-1.5'>
              {USAGE_BARS.map((height, index) => (
                <span
                  key={height}
                  className='flex-1 rounded-sm bg-(--tc-brand-accent)'
                  style={{ height: `${height}%`, opacity: 0.25 + index * 0.1 }}
                />
              ))}
            </div>
          </BentoCard>
        </div>
        <AnimateInView className='flex justify-center'>
          <Link
            to='/capabilities'
            className='text-foreground/80 hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors'
          >
            {t('Explore all capabilities')}
            <ArrowRight className='size-4' aria-hidden='true' />
          </Link>
        </AnimateInView>
      </div>
    </section>
  )
}
