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
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

import type { DocGroup, DocLanguage } from '../types'
import { DocPageLink } from './doc-page-link'

type DocSidebarProps = {
  groups: DocGroup[]
  activeSlug: string
  language: DocLanguage
}

function DocNavList(props: DocSidebarProps & { onNavigate?: () => void }) {
  return (
    <div className='space-y-6'>
      {props.groups.map((group) => (
        <div key={group.id}>
          <p className='text-foreground mb-2 text-xs font-semibold tracking-wide uppercase'>
            {group.title[props.language]}
          </p>
          <ul className='space-y-0.5'>
            {group.pages.map((page) => {
              const active = page.slug === props.activeSlug
              return (
                <li key={page.slug}>
                  <DocPageLink
                    slug={page.slug}
                    aria-current={active ? 'page' : undefined}
                    onClick={props.onNavigate}
                    className={cn(
                      'block rounded-md px-2 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )}
                  >
                    {page.title[props.language]}
                  </DocPageLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * Grouped page list: a sticky column on large screens, a collapsible menu
 * above the content on small screens.
 */
export function DocSidebar(props: DocSidebarProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <nav
        className='hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-2'
        aria-label={t('Usage Documentation')}
      >
        <DocNavList {...props} />
      </nav>
      <Collapsible open={open} onOpenChange={setOpen} className='lg:hidden'>
        <CollapsibleTrigger
          render={
            <Button variant='outline' className='w-full justify-between' />
          }
        >
          {t('Documentation menu')}
          <ChevronDown
            className={cn('size-4 transition-transform', open && 'rotate-180')}
            aria-hidden='true'
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <nav
            className='mt-3 rounded-md border p-4'
            aria-label={t('Usage Documentation')}
          >
            <DocNavList {...props} onNavigate={() => setOpen(false)} />
          </nav>
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
