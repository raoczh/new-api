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
import { cn } from '@/lib/utils'

type TokenComeBrandProps = {
  className?: string
  compact?: boolean
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
      <rect
        x='180'
        y='104'
        width='60'
        height='60'
        rx='12'
        fill='var(--card)'
        stroke='var(--tc-brand-accent)'
      />
      <path
        d='M193 121h34M210 121v27M198 148h24'
        stroke='var(--foreground)'
        strokeWidth='3'
        strokeLinecap='round'
      />
      <circle cx='40' cy='142' r='5' fill='var(--tc-brand-accent)' />
      <circle cx='380' cy='142' r='5' fill='var(--tc-brand-accent)' />
      <circle cx='210' cy='46' r='5' fill='var(--tc-brand-accent)' />
    </svg>
  )
}

/** The visual site identity. Configured system branding remains alongside it. */
export function TokenComeBrand(props: TokenComeBrandProps) {
  return (
    <span
      className={cn(
        'tc-brand inline-flex min-w-0 items-center gap-2',
        props.compact && 'tc-brand-compact',
        props.className
      )}
      aria-label='Token Come 渡康'
    >
      <span className='tc-brand-mark' aria-hidden='true'>
        <svg viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'>
          <path
            d='M5 8.5h22M16 8.5v15'
            stroke='currentColor'
            strokeWidth='2.5'
            strokeLinecap='round'
          />
          <path
            d='M7 23.5h8.5M17 23.5h8'
            stroke='currentColor'
            strokeWidth='2.5'
            strokeLinecap='round'
          />
          <path
            d='M17 8.5v15'
            stroke='var(--tc-brand-accent)'
            strokeWidth='2.5'
            strokeLinecap='round'
          />
          <circle cx='16' cy='8.5' r='2.25' fill='var(--tc-brand-accent)' />
        </svg>
      </span>
      <span className='tc-brand-copy'>
        <span className='tc-brand-name'>Token Come</span>
        <span className='tc-brand-cn'>渡康</span>
      </span>
    </span>
  )
}
