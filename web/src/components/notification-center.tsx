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
import type { TFunction } from 'i18next'
import { Bell, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { RichContent } from '@/components/rich-content'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'

interface AnnouncementItem {
  id?: number | string
  type?: string
  content?: string
  extra?: string
  publishDate?: string | Date
}

interface NotificationCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasUnreadAnnouncements: boolean
  activeTab: 'notice' | 'announcements'
  onTabChange: (tab: 'notice' | 'announcements') => void
  notice: string
  announcements: AnnouncementItem[]
  loading: boolean
  className?: string
}

/**
 * Get relative time string from a date
 */
function getRelativeTime(publishDate: string | Date, t: TFunction): string {
  const now = new Date()
  const pubDate = new Date(publishDate)

  // If invalid date, return original string
  if (Number.isNaN(pubDate.getTime())) {
    return typeof publishDate === 'string' ? publishDate : ''
  }

  const diffMs = now.getTime() - pubDate.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  // If future time, show specific date
  if (diffMs < 0) return formatDateTimeObject(pubDate)

  // Return relative time based on difference
  if (diffSeconds < 60) return t('Just now')
  if (diffMinutes < 60) {
    return diffMinutes === 1
      ? t('1 minute ago')
      : t('{{count}} minutes ago', { count: diffMinutes })
  }
  if (diffHours < 24) {
    return diffHours === 1
      ? t('1 hour ago')
      : t('{{count}} hours ago', { count: diffHours })
  }
  if (diffDays < 7) {
    return diffDays === 1
      ? t('1 day ago')
      : t('{{count}} days ago', { count: diffDays })
  }
  if (diffWeeks < 4) {
    return diffWeeks === 1
      ? t('1 week ago')
      : t('{{count}} weeks ago', { count: diffWeeks })
  }
  if (diffMonths < 12) {
    return diffMonths === 1
      ? t('1 month ago')
      : t('{{count}} months ago', { count: diffMonths })
  }
  if (diffYears < 2) return t('1 year ago')

  // Over 2 years, show specific date
  return formatDateTimeObject(pubDate)
}

function getAnnouncementRenderKey(announcement: AnnouncementItem): string {
  if (announcement.id !== undefined && announcement.id !== null) {
    return `id:${announcement.id}`
  }

  return JSON.stringify({
    content: announcement.content ?? '',
    extra: announcement.extra ?? '',
    publishDate: announcement.publishDate ?? '',
    type: announcement.type ?? '',
  })
}

/**
 * Empty state component
 */
function EmptyState(props: {
  icon: React.ReactNode
  title: string
  description?: string
}) {
  return (
    <Empty className='min-h-56 border-0 p-4'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>{props.icon}</EmptyMedia>
        <EmptyTitle>{props.title}</EmptyTitle>
        {props.description ? (
          <EmptyDescription>{props.description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  )
}

/**
 * Notice tab content
 */
function NoticeContent(props: {
  notice: string
  loading: boolean
  t: TFunction
}) {
  if (props.loading) {
    return (
      <EmptyState
        icon={<Bell />}
        title={props.t('Loading...')}
        description={props.t('Latest platform updates and notices')}
      />
    )
  }

  if (!props.notice) {
    return (
      <EmptyState
        icon={<Bell />}
        title={props.t('No announcements at this time')}
      />
    )
  }

  return (
    <ScrollArea className='h-[min(56vh,30rem)] pr-3'>
      <RichContent breaks content={props.notice} />
    </ScrollArea>
  )
}

/**
 * System announcements as a vertical timeline: one dot per announcement, linked
 * by a rail so the list reads chronologically like the reference design.
 */
function AnnouncementsTimeline(props: {
  announcements: AnnouncementItem[]
  loading: boolean
  t: TFunction
}) {
  if (props.loading) {
    return (
      <EmptyState
        icon={<Megaphone />}
        title={props.t('Loading...')}
        description={props.t('Latest platform updates and notices')}
      />
    )
  }

  if (props.announcements.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone />}
        title={props.t('No system announcements')}
      />
    )
  }

  return (
    <ScrollArea className='h-[min(56vh,30rem)] pe-3'>
      <ol className='flex flex-col ps-1'>
        {props.announcements.map((item, index) => {
          const publishDate = item.publishDate
            ? new Date(item.publishDate)
            : null
          const relativeTime = publishDate
            ? getRelativeTime(publishDate, props.t)
            : ''
          const absoluteTime = publishDate
            ? formatDateTimeObject(publishDate)
            : ''
          const isLast = index === props.announcements.length - 1

          return (
            <li
              key={getAnnouncementRenderKey(item)}
              className='relative flex gap-4 pb-5 last:pb-0'
            >
              {!isLast && (
                <span
                  aria-hidden='true'
                  className='bg-border absolute start-[5px] top-5 bottom-0 w-px'
                />
              )}
              <span
                aria-hidden='true'
                className={cn(
                  'ring-card relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-4',
                  getAnnouncementColorClass(item.type)
                )}
              />
              <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
                <div className='text-sm leading-relaxed'>
                  <RichContent breaks content={item.content || ''} />
                </div>
                {item.extra ? (
                  <div className='text-muted-foreground text-xs'>
                    <RichContent breaks content={item.extra} />
                  </div>
                ) : null}
                {absoluteTime ? (
                  <div className='text-muted-foreground/80 text-xs tabular-nums'>
                    {relativeTime ? `${relativeTime} · ` : null}
                    {absoluteTime}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </ScrollArea>
  )
}

/**
 * Notification bell that opens the centred announcement dialog.
 */
export function NotificationCenter(props: NotificationCenterProps) {
  const { t } = useTranslation()

  return (
    <>
      <Button
        variant='ghost'
        size='icon'
        className={cn('relative size-9', props.className)}
        aria-label={t('Notifications')}
        aria-expanded={props.open}
        onClick={() => props.onOpenChange(true)}
      >
        <Bell className='size-[1.2rem]' />
        {props.hasUnreadAnnouncements ? (
          <span
            data-slot='notification-dot'
            aria-hidden='true'
            className='bg-destructive ring-card absolute end-1.5 top-1.5 size-2 rounded-full ring-2'
          />
        ) : null}
      </Button>

      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={t('Announcements')}
        description={t('Latest platform updates and notices')}
        contentClassName='sm:max-w-2xl'
        contentHeight='auto'
        bodyClassName='space-y-4'
        footer={
          <Button size='sm' onClick={() => props.onOpenChange(false)}>
            {t('Close')}
          </Button>
        }
      >
        <Tabs
          value={props.activeTab}
          onValueChange={props.onTabChange as (value: string) => void}
        >
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='notice' className='gap-1.5'>
              <Bell className='size-3.5' />
              {t('Notice')}
            </TabsTrigger>
            <TabsTrigger value='announcements' className='gap-1.5'>
              <Megaphone className='size-3.5' />
              {t('System Announcements')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='notice' className='mt-3'>
            <NoticeContent
              notice={props.notice}
              loading={props.loading}
              t={t}
            />
          </TabsContent>

          <TabsContent value='announcements' className='mt-3'>
            <AnnouncementsTimeline
              announcements={props.announcements}
              loading={props.loading}
              t={t}
            />
          </TabsContent>
        </Tabs>
      </Dialog>
    </>
  )
}
