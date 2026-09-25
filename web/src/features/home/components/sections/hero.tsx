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
import { ArrowRight, BookOpen, Cable, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { TokenComeBridge, TokenComeBrand } from '@/components/tokencome-brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

const MoreIcon = MoreHorizontal

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'

  return (
    <section
      className={cn(
        'tc-home-hero relative px-5 pt-28 pb-16 sm:px-8 lg:pt-36 lg:pb-24',
        props.className
      )}
    >
      <div className='relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16'>
        <div className='min-w-0'>
          <Badge variant='outline' className='mb-6 gap-2 px-3 py-1.5'>
            <Cable className='text-brand size-3.5' aria-hidden='true' />
            {t('AI Application Infrastructure Foundation')}
          </Badge>
          <h1 className='max-w-2xl text-5xl leading-[1.07] font-semibold tracking-[-0.045em] sm:text-6xl xl:text-7xl'>
            {t('One gateway.')}
            <br />
            <span className='text-brand'>{t('Every possibility.')}</span>
          </h1>
          <p className='text-muted-foreground mt-6 max-w-xl text-base leading-7 sm:text-lg'>
            {t(
              'Connect AI models, manage access, and understand your usage in one workspace.'
            )}
          </p>
          <div className='mt-8 flex flex-wrap items-center gap-3'>
            <Button
              size='lg'
              className='h-11 px-5'
              render={
                <Link to={props.isAuthenticated ? '/dashboard' : '/sign-up'} />
              }
            >
              {props.isAuthenticated ? t('Go to Dashboard') : t('Get Started')}
              <ArrowRight className='size-4' aria-hidden='true' />
            </Button>
            {!props.isAuthenticated && (
              <Button
                size='lg'
                variant='outline'
                className='h-11 px-5'
                render={<Link to='/pricing' />}
              >
                {t('View Pricing')}
              </Button>
            )}
            <Button
              size='lg'
              variant='ghost'
              className='h-11 px-4'
              render={
                docsUrl.startsWith('http') ? (
                  <a href={docsUrl} target='_blank' rel='noopener noreferrer' />
                ) : (
                  <Link to={docsUrl} />
                )
              }
            >
              <BookOpen className='size-4' aria-hidden='true' />
              {t('Docs')}
            </Button>
          </div>
          {/* Supported Apps (参考图二样式，进行卡片化和信息扩充设计，增加视觉高度) */}
          <div
            className='landing-animate-fade-up mt-10 w-full max-w-xl opacity-0'
            style={{ animationDelay: '240ms' }}
          >
            <div className='mb-4 flex flex-col gap-1'>
              <span className='text-muted-foreground text-[10px] font-bold tracking-[0.15em] uppercase'>
                {t('Supported Applications')}
              </span>
              <p className='text-muted-foreground text-xs leading-relaxed'>
                {t(
                  'Supports one-click configuration and perfectly adapts to NewAPI multi-protocol configuration.'
                )}
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-3'>
              {/* Cherry Studio */}
              <a
                href='https://cherry-ai.com'
                target='_blank'
                rel='noopener noreferrer'
                className='group border-border/40 bg-muted/15 text-foreground/80 hover:border-border hover:bg-muted/30 hover:text-foreground flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-[0_1px_2.5px_rgba(0,0,0,0.01)] backdrop-blur-xs transition-all duration-300 hover:scale-[1.02]'
              >
                <CherryStudio.Color size={24} className='shrink-0' />
                <span>Cherry Studio</span>
              </a>

              {/* CC Switch */}
              <a
                href='https://ccswitch.io'
                target='_blank'
                rel='noopener noreferrer'
                className='group border-border/40 bg-muted/15 text-foreground/80 hover:border-border hover:bg-muted/30 hover:text-foreground flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-[0_1px_2.5px_rgba(0,0,0,0.01)] backdrop-blur-xs transition-all duration-300 hover:scale-[1.02]'
              >
                <img
                  src='https://ccswitch.io/favicon.png'
                  alt='CC Switch'
                  className='size-6 shrink-0 rounded-md object-contain'
                  onError={(e) => {
                    // Fallback to a styled text avatar if the remote favicon fails to load in sandbox or local environments
                    e.currentTarget.style.display = 'none'
                    const fallback = e.currentTarget.nextSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
                <span
                  style={{ display: 'none' }}
                  className='size-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-[10px] font-bold text-blue-600 dark:bg-blue-400/10 dark:text-blue-400'
                >
                  CC
                </span>
                <span>CC Switch</span>
              </a>

              {/* "更多" */}
              <div className='group border-border/40 bg-muted/15 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground flex cursor-default items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-[0_1px_2.5px_rgba(0,0,0,0.01)] backdrop-blur-xs transition-all duration-300 hover:scale-[1.02]'>
                <MoreIcon />
                <span>{t('More Apps')}</span>
              </div>
            </div>
          </div>
        </div>
        <div className='tc-gateway-panel bg-card relative overflow-hidden rounded-xl border p-6 sm:p-8'>
          <div className='flex flex-wrap items-center justify-between gap-4 border-b pb-5'>
            <TokenComeBrand />
            <span className='text-muted-foreground text-xs'>
              {t('Multi-protocol Compatible')}
            </span>
          </div>
          <TokenComeBridge className='my-6 w-full' />
          <div className='grid grid-cols-3 gap-2 text-center font-mono text-xs'>
            {['OpenAI', 'Claude', 'Gemini'].map((name) => (
              <span
                key={name}
                className='bg-muted/40 rounded-lg border px-2 py-3'
              >
                {name}
              </span>
            ))}
          </div>
          <div className='mt-6 grid gap-3 border-t pt-5 text-sm'>
            {[t('Access control'), t('Load Balancing'), t('Usage Logs')].map(
              (label) => (
                <div key={label} className='flex items-center gap-3'>
                  <span className='bg-brand h-px w-5' aria-hidden='true' />
                  {label}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
