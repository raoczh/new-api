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
import { CherryStudio } from '@lobehub/icons'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ShieldCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { TokenComeBrand } from '@/components/tokencome-brand'
import { Button } from '@/components/ui/button'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { useGatewayFacts } from '../../hooks'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

const ROUTE_TARGETS = [
  { icon: 'OpenAI', name: 'OpenAI', y: 34 },
  { icon: 'Claude.Color', name: 'Claude', y: 90 },
  { icon: 'Gemini.Color', name: 'Gemini', y: 146 },
  { icon: 'DeepSeek.Color', name: 'DeepSeek', y: 202 },
] as const

/** The primary action depends on the session and whether sign-up is open. */
function getPrimaryCta(isAuthenticated: boolean, registerEnabled: boolean) {
  if (isAuthenticated) {
    return { to: '/dashboard', label: 'Go to Dashboard' } as const
  }
  if (registerEnabled) return { to: '/sign-up', label: 'Get Started' } as const
  return { to: '/sign-in', label: 'Sign in' } as const
}

/** A decorative request preview: one endpoint fanning out to providers. */
function ConsolePreview() {
  const { t } = useTranslation()
  const facts = useGatewayFacts()
  return (
    <div className='relative' aria-hidden='true'>
      <div className='tc-landing-card tc-hero-console'>
        <div className='tc-hero-console-bar'>
          <span className='tc-hero-console-dots'>
            <span />
            <span />
            <span />
          </span>
          <span className='truncate'>{facts.host}/v1</span>
        </div>
        <div className='grid gap-4 p-5'>
          <div className='bg-muted/50 rounded-lg px-3 py-2 font-mono text-xs leading-relaxed'>
            <span className='text-(--tc-brand-accent)'>POST</span>{' '}
            <span className='text-muted-foreground'>/v1/chat/completions</span>
            <br />
            <span className='text-muted-foreground'>model:</span>{' '}
            {facts.sampleModels.claude}
          </div>
          <svg viewBox='0 0 360 236' className='h-auto w-full' fill='none'>
            {ROUTE_TARGETS.map((target) => (
              <path
                key={target.name}
                d={`M64 118C150 118 160 ${target.y} 236 ${target.y}`}
                stroke='var(--tc-brand-accent)'
                strokeOpacity='0.55'
                strokeWidth='1.5'
                className='tc-route-line'
              />
            ))}
            <rect
              x='8'
              y='92'
              width='56'
              height='52'
              rx='14'
              fill='var(--card)'
              stroke='var(--tc-brand-accent)'
            />
            <path
              d='M26 118h20m-7-7 7 7-7 7'
              stroke='var(--tc-brand-accent)'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
            {ROUTE_TARGETS.map((target) => (
              <foreignObject
                key={target.name}
                x='236'
                y={target.y - 20}
                width='124'
                height='40'
              >
                <div className='bg-card border-border flex h-10 items-center gap-2 rounded-xl border px-2.5 text-xs font-medium'>
                  {getLobeIcon(target.icon, 18)}
                  <span className='truncate'>{target.name}</span>
                </div>
              </foreignObject>
            ))}
          </svg>
          <div className='flex items-center justify-between border-t pt-4 text-xs'>
            <span className='text-muted-foreground inline-flex items-center gap-2'>
              <span className='tc-pulse-dot' />
              {t('Routed to a healthy channel')}
            </span>
            <span className='font-mono'>200 OK</span>
          </div>
        </div>
      </div>
      <FloatCard
        className='-top-5 -left-6'
        icon={<ShieldCheck />}
        title={t('Automatic failover')}
        description={t('Retries on another channel')}
      />
      <FloatCard
        className='tc-hero-float-delayed -right-4 -bottom-6'
        icon={<Activity />}
        title={t('Every call metered')}
        description={t('Tokens, cost and latency per request')}
      />
    </div>
  )
}

function FloatCard(props: {
  className: string
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div
      className={cn(
        'tc-landing-card tc-hero-float hidden sm:block',
        props.className
      )}
    >
      <div className='flex items-center gap-2.5 text-xs'>
        <span className='tc-landing-icon size-8! rounded-lg!'>
          {props.icon}
        </span>
        <div>
          <div className='font-semibold'>{props.title}</div>
          <div className='text-muted-foreground'>{props.description}</div>
        </div>
      </div>
    </div>
  )
}

function SupportedApps() {
  const { t } = useTranslation()
  const chip =
    'border-border/60 bg-card/70 text-foreground/80 hover:border-border hover:text-foreground inline-flex items-center gap-2.5 rounded-full border py-1.5 ps-1.5 pe-3.5 text-sm font-medium backdrop-blur transition-colors'
  return (
    <div
      className='landing-animate-fade-up flex flex-col gap-3 opacity-0'
      style={{ animationDelay: '280ms' }}
    >
      <span className='text-muted-foreground text-xs'>
        {t('Supported Applications')}
      </span>
      <div className='flex flex-wrap items-center gap-2'>
        <a
          href='https://cherry-ai.com'
          target='_blank'
          rel='noopener noreferrer'
          className={chip}
        >
          <CherryStudio.Color size={22} className='shrink-0' />
          Cherry Studio
        </a>
        <a
          href='https://ccswitch.io'
          target='_blank'
          rel='noopener noreferrer'
          className={chip}
        >
          <img
            src='https://ccswitch.io/favicon.png'
            alt=''
            className='size-5.5 shrink-0 rounded-full object-contain'
            onError={(event) => {
              event.currentTarget.style.visibility = 'hidden'
            }}
          />
          CC Switch
        </a>
        <Link
          to='/docs/$'
          params={{ _splat: 'config/agents' }}
          className={chip}
        >
          <span className='bg-muted inline-flex size-5.5 items-center justify-center rounded-full text-[10px] font-semibold'>
            +
          </span>
          {t('More Apps')}
        </Link>
      </div>
    </div>
  )
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const facts = useGatewayFacts()
  const cta = getPrimaryCta(
    Boolean(props.isAuthenticated),
    facts.registerEnabled
  )

  return (
    <section className={cn('tc-landing-hero', props.className)}>
      <div className='tc-landing-grid' aria-hidden='true' />
      <div className='tc-landing-container tc-hero-layout'>
        <div className='flex min-w-0 flex-col items-start gap-7'>
          <Link to='/capabilities' className='tc-landing-pill'>
            <span className='tc-landing-pill-tag'>{t('New')}</span>
            <span className='truncate'>
              {t('OpenAI, Claude and Gemini protocols on one endpoint')}
            </span>
            <ArrowRight className='size-3.5 shrink-0' aria-hidden='true' />
          </Link>
          <TokenComeBrand className='tc-home-brand' />
          <h1
            className='tc-landing-display landing-animate-fade-up opacity-0'
            style={{ animationDelay: '80ms' }}
          >
            {t('One gateway.')}
            <br />
            <span className='tc-landing-gradient-text'>
              {t('Every possibility.')}
            </span>
          </h1>
          <p
            className='text-muted-foreground landing-animate-fade-up max-w-xl text-lg leading-relaxed opacity-0'
            style={{ animationDelay: '160ms' }}
          >
            {t(
              'Connect AI models, manage access, and understand your usage in one workspace.'
            )}
          </p>
          <div
            className='landing-animate-fade-up flex flex-wrap items-center gap-3 opacity-0'
            style={{ animationDelay: '220ms' }}
          >
            <Button
              size='lg'
              variant='gradient'
              className='h-12 rounded-full px-6'
              render={<Link to={cta.to} />}
            >
              {t(cta.label)}
              <ArrowUpRight className='size-4' aria-hidden='true' />
            </Button>
            <Button
              size='lg'
              variant='outline'
              className='h-12 rounded-full px-5'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
            </Button>
            <Button
              size='lg'
              variant='ghost'
              className='h-12 rounded-full px-4'
              render={<Link to='/docs' />}
            >
              <BookOpen className='size-4' aria-hidden='true' />
              {t('Usage Documentation')}
            </Button>
          </div>
          <SupportedApps />
        </div>
        <div
          className='landing-animate-fade-left min-w-0 opacity-0'
          style={{ animationDelay: '200ms' }}
        >
          <ConsolePreview />
        </div>
      </div>
    </section>
  )
}
