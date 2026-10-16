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
import { ArrowUpRight, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useSystemConfig } from '@/hooks/use-system-config'

interface CapabilitiesHeroProps {
  isAuthenticated: boolean
}

export function CapabilitiesHero(props: CapabilitiesHeroProps) {
  const { t } = useTranslation()
  const config = useSystemConfig()
  const chineseName = config.systemChineseName?.trim()
  const brand = chineseName
    ? `${config.systemName} · ${chineseName}`
    : config.systemName

  return (
    <section className='tc-landing-hero'>
      <div className='tc-landing-grid' aria-hidden='true' />
      <div className='tc-landing-container flex flex-col items-center gap-7 text-center'>
        <span className='tc-landing-eyebrow landing-animate-fade-up'>
          {t('Product Capabilities')} · {brand}
        </span>
        <h1
          className='tc-landing-display landing-animate-fade-up max-w-4xl opacity-0'
          style={{ animationDelay: '80ms' }}
        >
          {t('One control plane')}
          <br />
          <span className='tc-landing-gradient-text'>
            {t('for every model you call')}
          </span>
        </h1>
        <p
          className='text-muted-foreground landing-animate-fade-up max-w-2xl text-lg leading-relaxed opacity-0'
          style={{ animationDelay: '160ms' }}
        >
          {t(
            'Protocol compatibility, routing, access control, billing and logs, built into one gateway you can adopt without rewriting code.'
          )}
        </p>
        <div
          className='landing-animate-fade-up flex flex-wrap justify-center gap-3 opacity-0'
          style={{ animationDelay: '220ms' }}
        >
          <Button
            size='lg'
            className='h-12 rounded-full px-6'
            render={
              <Link to={props.isAuthenticated ? '/dashboard' : '/sign-up'} />
            }
          >
            {props.isAuthenticated ? t('Go to Dashboard') : t('Get Started')}
            <ArrowUpRight className='size-4' aria-hidden='true' />
          </Button>
          <Button
            size='lg'
            variant='outline'
            className='h-12 rounded-full px-5'
            render={<Link to='/docs' />}
          >
            <BookOpen className='size-4' aria-hidden='true' />
            {t('Usage Documentation')}
          </Button>
        </div>
      </div>
    </section>
  )
}
