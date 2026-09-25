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
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeSwitch } from '@/components/theme-switch'
import { TokenComeBrand, TokenComeBridge } from '@/components/tokencome-brand'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

type AuthLayoutProps = { children: React.ReactNode }

export function AuthLayout(props: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='tc-auth-shell relative flex min-h-svh flex-col'>
      <header className='relative flex shrink-0 items-center justify-between gap-3 border-b px-4 py-4 sm:px-8'>
        <Link to='/' className='flex min-w-0 items-center gap-3 rounded-lg'>
          <TokenComeBrand compact />
          <span className='flex min-w-0 items-center gap-1.5 border-s ps-3'>
            {loading ? (
              <Skeleton className='size-5' />
            ) : (
              <img
                src={logo}
                alt={t('Logo')}
                className='size-5 rounded object-contain'
              />
            )}
            <span className='text-muted-foreground max-w-24 truncate text-xs'>
              {systemName}
            </span>
          </span>
        </Link>
        <div className='flex shrink-0 items-center gap-1'>
          <LanguageSwitcher />
          <ThemeSwitch />
        </div>
      </header>
      <div className='relative grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
        <aside className='tc-auth-aside hidden flex-col justify-center border-e px-12 py-16 lg:flex xl:px-20'>
          <div className='mx-auto w-full max-w-lg'>
            <p className='text-brand mb-5 text-xs font-semibold tracking-widest uppercase'>
              {t('AI gateway workspace')}
            </p>
            <h2 className='text-5xl leading-tight font-semibold tracking-tight'>
              {t('One gateway.')}
              <br />
              {t('Every possibility.')}
            </h2>
            <p className='text-muted-foreground mt-6 max-w-sm text-base leading-7'>
              {t(
                'Connect AI models, manage access, and understand your usage in one workspace.'
              )}
            </p>
            <TokenComeBridge className='mt-8 w-full' />
          </div>
        </aside>
        <main className='flex min-w-0 flex-col justify-center px-5 py-10 sm:px-8 lg:py-16'>
          <div className='mx-auto flex w-full max-w-[440px] flex-col gap-3'>
            {props.children}
          </div>
        </main>
      </div>
    </div>
  )
}
