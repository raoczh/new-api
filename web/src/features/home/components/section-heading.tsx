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
import type { ReactNode } from 'react'

import { AnimateInView } from '@/components/animate-in-view'
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  align?: 'center' | 'start'
  className?: string
}

/** Eyebrow, title and lead paragraph shared by every landing section. */
export function SectionHeading(props: SectionHeadingProps) {
  const centered = props.align !== 'start'
  return (
    <AnimateInView
      className={cn(
        'flex max-w-2xl flex-col gap-4',
        centered && 'mx-auto items-center text-center',
        props.className
      )}
    >
      <span className='tc-landing-eyebrow'>{props.eyebrow}</span>
      <h2 className='tc-landing-title'>{props.title}</h2>
      {props.description && (
        <p className='text-muted-foreground text-base leading-relaxed md:text-lg'>
          {props.description}
        </p>
      )}
    </AnimateInView>
  )
}
