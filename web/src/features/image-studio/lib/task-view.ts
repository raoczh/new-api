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
import { formatTimestampRelative } from '@/lib/format'

import { IMAGE_STUDIO_STATUS } from '../constants'
import type { ImageStudioTask, ImageStudioTaskStatus } from '../types'

/**
 * Headline for a record in the history grid. Status wins over the prompt,
 * because "queued" is the thing the user needs to understand right now.
 */
export function taskStatusLabelKey(status: ImageStudioTaskStatus): string {
  switch (status) {
    case IMAGE_STUDIO_STATUS.QUEUED:
      return 'Queued'
    case IMAGE_STUDIO_STATUS.RUNNING:
      return 'Generating'
    case IMAGE_STUDIO_STATUS.SUCCEEDED:
      return 'Completed'
    case IMAGE_STUDIO_STATUS.FAILED:
      return 'Failed'
    case IMAGE_STUDIO_STATUS.CANCELED:
      return 'Canceled'
    case IMAGE_STUDIO_STATUS.EXPIRED:
      return 'Expired'
    default:
      return 'Unknown'
  }
}

export function isActiveTask(task: ImageStudioTask): boolean {
  return (
    task.status === IMAGE_STUDIO_STATUS.QUEUED ||
    task.status === IMAGE_STUDIO_STATUS.RUNNING
  )
}

export function hasVisibleImages(task: ImageStudioTask): boolean {
  return task.status === IMAGE_STUDIO_STATUS.SUCCEEDED && task.images.length > 0
}

export function describeTaskTime(timestamp: number, locale?: string): string {
  return formatTimestampRelative(timestamp, 'seconds', locale)
}

export function describeElapsed(milliseconds: number): string {
  if (!milliseconds || milliseconds < 0) return '-'
  const seconds = milliseconds / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}m ${rest}s`
}

/** One-line summary of the generation settings shown under a record. */
export function describeTaskParams(task: ImageStudioTask): string {
  const parts: string[] = []
  if (task.params?.size) parts.push(String(task.params.size))
  if (task.params?.quality) parts.push(String(task.params.quality))
  if (typeof task.params?.n === 'number' && task.params.n > 1) {
    parts.push(`×${task.params.n}`)
  }
  return parts.join(' · ')
}

/**
 * A stable filename for downloads: prompt excerpt plus id, sanitised so the
 * browser does not mangle it and so no path separators leak in.
 */
export function taskDownloadName(task: ImageStudioTask, index: number): string {
  const excerpt = task.prompt
    .slice(0, 24)
    .replaceAll(/[\\/:*?"<>|\s]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  const suffix = task.images.length > 1 ? `-${index + 1}` : ''
  const base = excerpt || task.id.slice(0, 8)
  return `${base}${suffix}.${extensionFromUrl(task.images[index])}`
}

function extensionFromUrl(url?: string): string {
  if (!url) return 'png'
  const match = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(url)
  const extension = match?.[1]?.toLowerCase()
  if (!extension) return 'png'
  if (extension === 'jpg') return 'jpg'
  return extension
}
