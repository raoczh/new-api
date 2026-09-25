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
import { Link, useLocation } from '@tanstack/react-router'
import { ArrowUpLeft } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useSidebar } from '@/components/ui/sidebar'
import { useSidebarView } from '@/hooks/use-sidebar-view'

import { NavGroup } from './nav-group'

/** Full page navigation, shared by the desktop sidebar and mobile drawer. */
export function AppSidebar() {
  const { t, i18n } = useTranslation()
  const { key, view, navGroups } = useSidebarView()
  const { isMobile, openMobile, setOpenMobile } = useSidebar()
  const pathname = useLocation({ select: (location) => location.pathname })
  const groups = navGroups.filter((group) => group.items.length > 0)
  const navigationRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  useEffect(() => {
    if (!isMobile) scrollToCurrentPage(navigationRef.current)
  }, [pathname, isMobile, i18n.resolvedLanguage])

  const navigation = (
    <>
      <nav
        key={key}
        ref={navigationRef}
        className='tc-navigation-panel tc-sidebar-menu'
        aria-label={t('Navigation')}
      >
        {view && (
          <Button
            role='link'
            variant='ghost'
            className='tc-sidebar-back'
            render={
              <Link to={view.parent.to} onClick={() => setOpenMobile(false)} />
            }
          >
            <ArrowUpLeft aria-hidden='true' />
            {t(view.parent.label)}
          </Button>
        )}
        {groups.map((group) => (
          <NavGroup key={group.id || group.title} {...group} />
        ))}
      </nav>
      <WorkspaceAttribution />
    </>
  )

  if (isMobile) {
    return (
      <Sheet
        open={openMobile}
        onOpenChange={setOpenMobile}
        onOpenChangeComplete={(open) => {
          if (open) scrollToCurrentPage(navigationRef.current)
        }}
      >
        <SheetContent
          side='left'
          id='workspace-navigation'
          className='tc-navigation-drawer w-[22rem] max-w-[calc(100vw-2rem)] gap-0'
          finalFocus={() =>
            document.querySelector<HTMLElement>('#workspace-menu-trigger')
          }
        >
          <SheetHeader className='border-b px-6 py-5'>
            <SheetTitle>{t('Navigation')}</SheetTitle>
            <SheetDescription>{t('AI gateway workspace')}</SheetDescription>
          </SheetHeader>
          {navigation}
        </SheetContent>
      </Sheet>
    )
  }

  return <aside className='tc-workspace-sidebar'>{navigation}</aside>
}

function scrollToCurrentPage(navigation: HTMLElement | null) {
  navigation
    ?.querySelector<HTMLElement>('[aria-current="page"]')
    ?.scrollIntoView({ block: 'nearest' })
}

function WorkspaceAttribution() {
  return (
    <a
      href='https://github.com/QuantumNous/new-api'
      target='_blank'
      rel='noopener noreferrer'
      className='tc-workspace-attribution'
    >
      <span>New API</span> <span>QuantumNous</span>
    </a>
  )
}
