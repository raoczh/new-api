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
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useStatus } from '@/hooks/use-status'
import { getNotice } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useNotificationStore } from '@/stores/notification-store'

function hashString(input: string): string {
  let hash = 0
  if (!input) return '0'

  for (let i = 0; i < input.length; i += 1) {
    const chr = input.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }

  return hash.toString(36)
}

/**
 * Generate a unique key for an announcement
 * Prefer backend id, fall back to a content hash so edits register
 */
function getAnnouncementKey(item: Record<string, unknown>): string {
  if (!item) return ''

  if (item.id !== undefined && item.id !== null) {
    return `id:${item.id}`
  }

  const fingerprint = JSON.stringify({
    publishDate: (item?.publishDate as string) || '',
    content: ((item?.content as string) || '').trim(),
    extra: ((item?.extra as string) || '').trim(),
    type: (item?.type as string) || '',
    title: ((item?.title as string) || '').trim(),
    link: ((item?.link as string) || '').trim(),
  })
  return `hash:${hashString(fingerprint)}`
}

type NotificationTab = 'notice' | 'announcements'

type UseNotificationsOptions = {
  /**
   * Open the announcement dialog automatically once per session when an
   * unread notice arrives. System announcements never auto-open; they only
   * light the bell dot.
   */
  autoOpenUnreadNotice?: boolean
}

/**
 * Hook to manage the announcement dialog (Notice + system announcements).
 * Provides the bell dot state and read-status management.
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<NotificationTab>('notice')

  // Fetch Notice from API
  const {
    data: noticeResponse,
    isLoading: noticeLoading,
    refetch: refetchNotice,
  } = useQuery({
    queryKey: ['notice'],
    queryFn: async () => requireServerSuccess(await getNotice()),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Fetch Announcements from status
  const { status, loading: statusLoading } = useStatus()
  const announcementsEnabled = status?.announcements_enabled ?? false
  const announcements = useMemo<Record<string, unknown>[]>(() => {
    if (!announcementsEnabled) return []
    return ((status?.announcements || []) as Record<string, unknown>[]).slice(
      0,
      20
    )
  }, [announcementsEnabled, status?.announcements])

  // Notification store
  const {
    lastReadNotice,
    markNoticeRead,
    markAnnouncementsRead,
    isAnnouncementRead,
  } = useNotificationStore()

  // Extract notice content
  const noticeContent = noticeResponse?.success
    ? (noticeResponse.data || '').trim()
    : ''

  const unreadNotice = !!noticeContent && noticeContent !== lastReadNotice

  const unreadAnnouncementsCount = useMemo(
    () =>
      announcements.filter(
        (item: Record<string, unknown>) =>
          !isAnnouncementRead(getAnnouncementKey(item))
      ).length,
    [announcements, isAnnouncementRead]
  )

  const markAnnouncementsAsRead = useCallback(() => {
    if (announcements.length > 0) {
      markAnnouncementsRead(
        announcements.map((item: Record<string, unknown>) =>
          getAnnouncementKey(item)
        )
      )
    }
  }, [announcements, markAnnouncementsRead])

  const openDialog = useCallback(
    (tab: NotificationTab = activeTab) => {
      // Opening the centre counts as reading what it shows.
      if (noticeContent) markNoticeRead(noticeContent)
      if (tab === 'announcements') markAnnouncementsAsRead()
      setActiveTab(tab)
      setDialogOpen(true)
    },
    [activeTab, markAnnouncementsAsRead, markNoticeRead, noticeContent]
  )

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openDialog(activeTab)
        return
      }
      setDialogOpen(false)
    },
    [activeTab, openDialog]
  )

  const handleTabChange = useCallback(
    (tab: NotificationTab) => {
      setActiveTab(tab)
      if (tab === 'announcements') markAnnouncementsAsRead()
    },
    [markAnnouncementsAsRead]
  )

  // A new notice pops the dialog once per session; announcements only use the
  // bell dot, so returning users are not interrupted for the timeline.
  const autoOpenedRef = useRef(false)
  const autoOpenUnreadNotice = options.autoOpenUnreadNotice ?? false
  useEffect(() => {
    if (!autoOpenUnreadNotice || autoOpenedRef.current) return
    if (noticeLoading || !unreadNotice) return
    autoOpenedRef.current = true
    openDialog('notice')
  }, [autoOpenUnreadNotice, noticeLoading, openDialog, unreadNotice])

  return {
    // Data
    notice: noticeContent,
    announcements,
    loading: noticeLoading || statusLoading,

    // Bell dot: system announcements stay unread until the timeline is opened.
    hasUnreadAnnouncements: unreadAnnouncementsCount > 0,

    // Dialog state
    popoverOpen: dialogOpen,
    setPopoverOpen: handleDialogOpenChange,
    activeTab,
    setActiveTab: handleTabChange,

    // Actions
    openPopover: openDialog,
    closePopover: () => setDialogOpen(false),
    refetchNotice,
  }
}
