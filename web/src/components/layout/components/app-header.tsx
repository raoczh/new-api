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
import { Menu, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationCenter } from '@/components/notification-center'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useSidebar } from '@/components/ui/sidebar'
import { useNotifications } from '@/hooks/use-notifications'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'

import { defaultTopNavLinks } from '../config/top-nav.config'
import type { TopNavLink } from '../types'
import { Header } from './header'
import { SystemBrand } from './system-brand'
import { TopNav } from './top-nav'

/**
 * General application Header component
 * Integrates navigation bar, notifications, configuration and profile functions
 *
 * @example
 * // Basic usage
 * <AppHeader />
 *
 * @example
 * // Custom navigation links
 * <AppHeader navLinks={customLinks} />
 *
 * @example
 * // Hide the top navigation bar
 * <AppHeader showTopNav={false} />
 *
 * @example
 * // Fully customize left and right content
 * <AppHeader
 *   leftContent={<CustomLeft />}
 *   rightContent={<CustomRight />}
 * />
 */
type AppHeaderProps = {
  /**
   * Custom navigation links, uses default global navigation or dynamically generated from backend if not provided
   */
  navLinks?: TopNavLink[]
  /**
   * Whether to show top navigation bar
   * @default true
   */
  showTopNav?: boolean
  /**
   * Left content, overrides TopNav if provided
   */
  leftContent?: React.ReactNode
  /**
   * Custom right content, overrides default right content if provided
   */
  rightContent?: React.ReactNode
  /**
   * Whether to show notification button
   * @default true
   */
  showNotifications?: boolean
  /**
   * Whether to show profile dropdown
   * @default true
   */
  showProfileDropdown?: boolean
}

export function AppHeader({
  navLinks = defaultTopNavLinks,
  showTopNav = true,
  leftContent,
  rightContent,
  showNotifications = true,
  showProfileDropdown = true,
}: AppHeaderProps) {
  const { t } = useTranslation()
  const { isMobile, openMobile, setOpenMobile } = useSidebar()
  const [previousIsMobile, setPreviousIsMobile] = useState(isMobile)
  // Prioritize dynamically generated links from backend
  const dynamicLinks = useTopNavLinks()
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks

  // Notifications hook; a new notice opens the dialog after sign-in.
  const notifications = useNotifications({ autoOpenUnreadNotice: true })

  // Close the announcement dialog before mounting the other layout's trigger.
  if (previousIsMobile !== isMobile) {
    setPreviousIsMobile(isMobile)
    notifications.setPopoverOpen(false)
  }

  const tools = (
    <>
      {showTopNav && <TopNav links={links} />}
      {showNotifications && (
        <NotificationCenter
          open={notifications.popoverOpen}
          onOpenChange={notifications.setPopoverOpen}
          hasUnreadAnnouncements={notifications.hasUnreadAnnouncements}
          activeTab={notifications.activeTab}
          onTabChange={notifications.setActiveTab}
          notice={notifications.notice}
          announcements={notifications.announcements}
          loading={notifications.loading}
        />
      )}
      <LanguageSwitcher />
      <ThemeSwitch />
    </>
  )

  return (
    <Header>
      <SystemBrand variant='inline' />

      {leftContent ? (
        <div className='ms-2 flex items-center'>{leftContent}</div>
      ) : null}

      {rightContent ?? (
        <div className='tc-masthead-actions'>
          {isMobile && (
            <Button
              id='workspace-menu-trigger'
              variant='ghost'
              size='icon'
              aria-label={t('Toggle navigation menu')}
              aria-expanded={openMobile}
              aria-controls='workspace-navigation'
              onClick={() => setOpenMobile(true)}
            >
              <Menu aria-hidden='true' />
            </Button>
          )}
          {isMobile ? (
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={t('Actions')}
                  />
                }
              >
                <MoreHorizontal aria-hidden='true' />
              </PopoverTrigger>
              <PopoverContent align='end' className='w-64 p-4'>
                <PopoverTitle>{t('Actions')}</PopoverTitle>
                <div className='grid grid-cols-3 justify-items-center gap-3'>
                  {tools}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            tools
          )}
          {showProfileDropdown && <ProfileDropdown />}
        </div>
      )}
    </Header>
  )
}
