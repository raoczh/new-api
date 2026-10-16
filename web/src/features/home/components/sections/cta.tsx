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
import { ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import { useSystemConfig } from '@/hooks/use-system-config'

import { useGatewayFacts } from '../../hooks'

interface CTAProps {
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const facts = useGatewayFacts()
  const showSignUp = !props.isAuthenticated && facts.registerEnabled

  return (
    <section className='tc-landing-container pb-24'>
      <AnimateInView animation='scale-in' className='tc-closing'>
        <div className='relative flex flex-col items-start gap-6 md:max-w-2xl'>
          <h2 className='tc-landing-title'>
            {t('Ship with every model through {{name}}', { name: systemName })}
          </h2>
          <p className='text-base leading-relaxed opacity-70 md:text-lg'>
            {t(
              'Create a key, change the Base URL and make your first call in minutes.'
            )}
          </p>
          <div className='flex flex-wrap gap-3'>
            <Button
              size='lg'
              variant='secondary'
              className='h-12 rounded-full px-6'
              render={<Link to={showSignUp ? '/sign-up' : '/dashboard'} />}
            >
              {showSignUp ? t('Get Started') : t('Go to Dashboard')}
              <ArrowUpRight className='size-4' aria-hidden='true' />
            </Button>
            <Button
              size='lg'
              variant='ghost'
              className='h-12 rounded-full px-5 hover:bg-white/10 hover:text-current'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
            </Button>
          </div>
        </div>
      </AnimateInView>
    </section>
  )
}
