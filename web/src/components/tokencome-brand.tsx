/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { ReactNode } from 'react'

import { HeaderLogo } from '@/components/layout/components/header-logo'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

type TokenComeBrandProps = {
  className?: string
  compact?: boolean
  name?: string
  logo?: ReactNode
}

/** Decorative routing diagram, with no service status or metrics. */
export function TokenComeBridge(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox='0 0 420 200'
      fill='none'
      aria-hidden='true'
    >
      <path d='M34 142h352M34 158h352' stroke='var(--border)' />
      <path
        d='M40 142C90 142 104 46 210 46s120 96 170 96'
        stroke='var(--tc-brand-accent)'
        strokeWidth='2'
      />
      <path
        d='M70 142V125M110 142V77M150 142V54M210 142V46M270 142V54M310 142V77M350 142V125'
        stroke='var(--border)'
      />
      <circle
        cx='210'
        cy='142'
        r='13'
        fill='var(--card)'
        stroke='var(--tc-brand-accent)'
      />
      <path
        d='M204 142h12m-5-5 5 5-5 5'
        stroke='var(--tc-brand-accent)'
        strokeWidth='2'
        strokeLinecap='round'
      />
      <circle cx='40' cy='142' r='5' fill='var(--tc-brand-accent)' />
      <circle cx='380' cy='142' r='5' fill='var(--tc-brand-accent)' />
      <circle cx='210' cy='46' r='5' fill='var(--tc-brand-accent)' />
    </svg>
  )
}

/** One identity, sourced from the site's existing configuration. */
export function TokenComeBrand(props: TokenComeBrandProps) {
  const config = useSystemConfig()
  const name = props.name || config.systemName
  return (
    <span
      className={cn(
        'tc-brand inline-flex min-w-0 items-center gap-2',
        props.compact && 'tc-brand-compact',
        props.className
      )}
      aria-label={`${name} · 渡康`}
    >
      <span className='tc-site-logo'>
        {props.logo ?? (
          <HeaderLogo
            src={config.logo}
            alt={name}
            loading={config.loading}
            logoLoaded={config.logoLoaded}
            className='size-full rounded-none object-contain'
          />
        )}
      </span>
      {config.loading ? (
        <Skeleton className='h-5 w-24' />
      ) : (
        <span className='tc-brand-lockup'>
          <span className='tc-brand-name truncate' title={name}>
            {name}
          </span>
          <span className='tc-brand-chinese' lang='zh-CN'>
            渡康
          </span>
        </span>
      )}
    </span>
  )
}
