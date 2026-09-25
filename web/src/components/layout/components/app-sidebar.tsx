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
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useSidebarView } from '@/hooks/use-sidebar-view'

import { checkIsActive } from '../lib/url-utils'
import type { NavGroup as NavGroupData } from '../types'
import { NavGroup } from './nav-group'

/** Reuse permission-filtered navigation and its actions in a horizontal workspace. */
export function AppSidebar() {
  const { t } = useTranslation()
  const { key, view, navGroups } = useSidebarView()
  const pathname = useLocation({ select: (location) => location.pathname })
  const groups = navGroups.filter((group) => group.items.length > 0)
  const active =
    groups.find((group) =>
      group.items.some(
        (item) =>
          checkIsActive(pathname, item) ||
          (item.type === 'chat-presets' && pathname.startsWith('/chat/'))
      )
    ) ??
    groups.find((group) => group.id === 'general') ??
    groups[0]

  return (
    <nav className='tc-workspace-navigation' aria-label={t('Navigation')}>
      <div className='tc-workspace-navigation-inner'>
        {view && (
          <Link to={view.parent.to} className='tc-workspace-back'>
            <ArrowUpLeft className='size-4' aria-hidden='true' />
            {t(view.parent.label)}
          </Link>
        )}
        {active && (
          <WorkspaceGroups
            key={key + pathname}
            groups={groups}
            active={active.id || active.title}
          />
        )}
        <a
          href='https://github.com/QuantumNous/new-api'
          target='_blank'
          rel='noopener noreferrer'
          className='tc-workspace-attribution'
        >
          New API · QuantumNous
        </a>
      </div>
    </nav>
  )
}

function WorkspaceGroups(props: { groups: NavGroupData[]; active: string }) {
  const { t, i18n } = useTranslation()
  const navigationRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(props.active)
  const value = props.groups.some(
    (group) => (group.id || group.title) === selected
  )
    ? selected
    : props.active

  useEffect(() => {
    const navigation = navigationRef.current
    const activeTab = navigation?.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]'
    )
    const activeLink = navigation?.querySelector<HTMLElement>(
      '[data-sidebar="menu-button"][data-active]'
    )
    activeTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    activeLink?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [value, i18n.resolvedLanguage])

  return (
    <Tabs
      ref={navigationRef}
      value={value}
      onValueChange={(value) => setSelected(String(value))}
      className='tc-workspace-tabs'
    >
      <div className='tc-workspace-sections'>
        <span className='tc-navigation-caption'>
          {t('AI gateway workspace')}
        </span>
        <TabsList
          variant='line'
          aria-label={t('Navigation')}
          className='tc-workspace-group-tabs'
        >
          {props.groups.map((group, index) => (
            <TabsTrigger
              key={group.id || group.title}
              value={group.id || group.title}
            >
              <span className='tc-nav-index' aria-hidden='true'>
                {String(index + 1).padStart(2, '0')}
              </span>
              {group.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {props.groups.map((group) => (
        <TabsContent
          key={group.id || group.title}
          value={group.id || group.title}
          className='tc-workspace-links'
        >
          <NavGroup {...group} orientation='horizontal' />
        </TabsContent>
      ))}
    </Tabs>
  )
}
