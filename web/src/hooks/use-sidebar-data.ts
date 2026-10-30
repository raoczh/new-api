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
import {
  ClipboardList,
  FileText,
  Image,
  Key,
  LayoutDashboard,
  ListTodo,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Radio,
  Settings,
  ShoppingBag,
  User,
  Users,
  Video,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SidebarData } from '@/components/layout/types'
import { ROLE } from '@/lib/roles'

/**
 * Root navigation groups for the application sidebar.
 *
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()

  return {
    navGroups: [
      {
        id: 'general',
        title: t('General'),
        items: [
          {
            title: t('Dashboard'),
            url: '/dashboard/overview',
            activeUrls: [
              '/dashboard/overview',
              '/dashboard/models',
              '/dashboard/flow',
              '/dashboard/users',
            ],
            icon: LayoutDashboard,
          },
          {
            title: t('API Keys'),
            url: '/keys',
            icon: Key,
          },
          {
            title: t('Usage Logs'),
            url: '/usage-logs/common',
            icon: FileText,
          },
          {
            title: t('Audit Logs'),
            url: '/usage-logs/audit',
            icon: ClipboardList,
          },
          {
            title: t('Task Logs'),
            url: '/usage-logs/task',
            activeUrls: ['/usage-logs/drawing'],
            configUrls: ['/usage-logs/drawing', '/usage-logs/task'],
            icon: ListTodo,
          },
        ],
      },
      {
        id: 'workbench',
        title: t('Workbench'),
        items: [
          {
            title: t('AI Chat'),
            url: '/playground',
            icon: MessageCircle,
          },
          {
            title: t('Image Studio'),
            url: '/workbench/image',
            icon: Image,
          },
          {
            title: t('Video Studio'),
            url: '/workbench/video',
            icon: Video,
          },
        ],
      },
      {
        id: 'personal',
        title: t('Personal'),
        items: [
          {
            title: t('Wallet'),
            url: '/wallet',
            icon: Wallet,
          },
          {
            title: t('Buy Redemption Codes'),
            url: '/wallet/store',
            configUrls: ['/wallet'],
            icon: ShoppingBag,
          },
          {
            title: t('Profile'),
            url: '/profile',
            icon: User,
          },
          {
            title: t('My Tickets'),
            url: '/tickets',
            icon: LifeBuoy,
          },
        ],
      },
      {
        id: 'admin',
        title: t('Admin'),
        items: [
          {
            title: t('Channels'),
            url: '/channels',
            icon: Radio,
          },
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('Ticket Management'),
            url: '/ticket-management',
            icon: MessagesSquare,
          },
          {
            title: t('Open Source Promotion'),
            url: '/open-source-promotion',
            icon: Megaphone,
          },
          {
            title: t('System Settings'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
            requiredRole: ROLE.SUPER_ADMIN,
          },
        ],
      },
    ],
  }
}
