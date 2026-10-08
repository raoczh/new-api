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
import { ArrowRight, KeyRound, ShoppingBag } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'

interface QuickStartAction {
  key: string
  title: string
  description: string
  to: '/wallet/store' | '/keys'
  icon: typeof KeyRound
  tone: IconBadgeTone
}

/**
 * The two-step account setup path, kept visible so a new user always knows
 * where to top up and where to get a key. The collapsible setup guide covers
 * the deeper walkthrough instead of repeating these two entries.
 */
export function QuickStartActions() {
  const { t } = useTranslation()

  const actions: QuickStartAction[] = [
    {
      key: 'topup',
      title: t('Buy redemption codes'),
      description: t('Top up your balance before sending production traffic'),
      to: '/wallet/store',
      icon: ShoppingBag,
      tone: 'warning',
    },
    {
      key: 'createKey',
      title: t('Create API Key'),
      description: t('Create a key for your app or service'),
      to: '/keys',
      icon: KeyRound,
      tone: 'success',
    },
  ]

  return (
    <section aria-label={t('Quick start')}>
      <div className='mb-2 flex flex-col gap-0.5'>
        <h3 className='text-sm font-semibold'>{t('Quick start')}</h3>
        <p className='text-muted-foreground text-xs'>
          {t('Two steps to send your first request')}
        </p>
      </div>
      <div className='grid gap-3 sm:grid-cols-2'>
        {actions.map((action) => {
          const Icon = action.icon

          return (
            <div
              key={action.key}
              className='bg-card flex items-center gap-3 rounded-lg border p-4 shadow-xs'
            >
              <IconBadge tone={action.tone} size='md'>
                <Icon />
              </IconBadge>
              <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                <span className='truncate text-sm font-medium'>
                  {action.title}
                </span>
                <span className='text-muted-foreground line-clamp-2 text-xs leading-relaxed'>
                  {action.description}
                </span>
              </div>
              <Button
                variant='outline'
                size='sm'
                className='shrink-0'
                render={<Link to={action.to} />}
              >
                {t('Go')}
                <ArrowRight data-icon='inline-end' />
              </Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
