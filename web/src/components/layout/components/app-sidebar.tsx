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
import { ArrowUpLeft, Layers } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useSidebar } from '@/components/ui/sidebar'
import { useSidebarView } from '@/hooks/use-sidebar-view'

import { checkIsActive } from '../lib/url-utils'
import type { NavGroup as NavGroupData, SidebarView } from '../types'
import { NavGroup } from './nav-group'

/** A quiet navigation rail; full page labels live in the section panels. */
export function AppSidebar() {
  const { t } = useTranslation()
  const { key, view, navGroups } = useSidebarView()
  const { isMobile, openMobile, setOpenMobile } = useSidebar()
  const pathname = useLocation({ select: (location) => location.pathname })
  const groups = navGroups.filter((group) => group.items.length > 0)

  useEffect(() => {
    if (!isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
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
          <nav
            className='tc-navigation-panel min-h-0 flex-1 overflow-y-auto p-3'
            aria-label={t('Navigation')}
          >
            {view && (
              <Button
                role='link'
                variant='ghost'
                className='mb-3 w-full justify-start'
                render={
                  <Link
                    to={view.parent.to}
                    onClick={() => setOpenMobile(false)}
                  />
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
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <WorkspaceRail key={key} groups={groups} view={view} pathname={pathname} />
  )
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

function WorkspaceRail(props: {
  groups: NavGroupData[]
  view: SidebarView | null
  pathname: string
}) {
  const { t } = useTranslation()
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  useEffect(() => setOpenGroup(null), [props.pathname])
  const sections = props.view
    ? props.groups.flatMap((group) =>
        group.items.map((item) => ({
          title: item.title,
          icon: item.icon,
          items: item.items ?? [item],
        }))
      )
    : props.groups.map((group) => ({
        ...group,
        icon:
          group.items.find((item) => item.title === group.title)?.icon ??
          group.items[0]?.icon,
      }))

  return (
    <aside className='tc-navigation-rail'>
      <nav aria-label={t('Navigation')} className='tc-rail-sections'>
        {props.view && (
          <Button
            role='link'
            variant='ghost'
            className='tc-rail-entry tc-rail-back'
            aria-label={t(props.view.parent.label)}
            render={<Link to={props.view.parent.to} />}
          >
            <ArrowUpLeft aria-hidden='true' />
            <span>{t('Back')}</span>
          </Button>
        )}
        {sections.map((section) => {
          const Icon = section.icon ?? Layers
          const active = section.items.some(
            (item) =>
              checkIsActive(props.pathname, item) ||
              ('type' in item &&
                item.type === 'chat-presets' &&
                props.pathname.startsWith('/chat/'))
          )
          return (
            <Popover
              key={section.title}
              open={openGroup === section.title}
              onOpenChange={(open) => setOpenGroup(open ? section.title : null)}
            >
              <PopoverTrigger
                render={
                  <Button
                    variant='ghost'
                    className='tc-rail-entry'
                    data-current={active || undefined}
                    aria-label={section.title}
                  />
                }
              >
                <Icon aria-hidden='true' />
                <span>{section.title}</span>
              </PopoverTrigger>
              <PopoverContent
                side='inline-end'
                align='start'
                sideOffset={14}
                collisionPadding={16}
                className='tc-navigation-panel tc-rail-panel'
              >
                <PopoverTitle className='tc-rail-panel-title'>
                  {section.title}
                </PopoverTitle>
                <NavGroup
                  title={section.title}
                  items={section.items}
                  onNavigate={() => setOpenGroup(null)}
                />
              </PopoverContent>
            </Popover>
          )
        })}
      </nav>
      <WorkspaceAttribution />
    </aside>
  )
}
