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
import type { ImageStudioTaskStatus } from './types'

export const IMAGE_STUDIO_ENDPOINTS = {
  CONFIG: '/api/image-studio/config',
  MODELS: '/api/image-studio/models',
  UPLOADS: '/api/image-studio/uploads',
  TASKS: '/api/image-studio/tasks',
  TASK_BATCH: '/api/image-studio/tasks/batch',
} as const

export function taskEndpoint(id: string): string {
  return `${IMAGE_STUDIO_ENDPOINTS.TASKS}/${encodeURIComponent(id)}`
}

export const IMAGE_STUDIO_QUERY_KEYS = {
  config: ['image-studio', 'config'] as const,
  models: ['image-studio', 'models'] as const,
  tasks: ['image-studio', 'tasks'] as const,
  task: (id: string) => ['image-studio', 'task', id] as const,
}

/** Poll interval while a record is still queued or running. */
export const IMAGE_STUDIO_ACTIVE_POLL_MS = 3000
/** Poll interval once everything visible has settled (cheap depth refresh). */
export const IMAGE_STUDIO_IDLE_POLL_MS = 30000

export const IMAGE_STUDIO_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
} as const satisfies Record<string, ImageStudioTaskStatus>

export const IMAGE_STUDIO_ACTIVE_STATUSES: ImageStudioTaskStatus[] = [
  IMAGE_STUDIO_STATUS.QUEUED,
  IMAGE_STUDIO_STATUS.RUNNING,
]

/** Base resolutions offered by the size picker. */
export const IMAGE_STUDIO_SIZE_TIERS = ['1K', '2K', '4K'] as const

/**
 * Ratio presets. The label carries the orientation so the tiles read well in
 * a grid; the value is the plain ratio the size arithmetic consumes.
 */
export const IMAGE_STUDIO_SIZE_RATIOS = [
  { labelKey: 'Square', value: '1:1' },
  { labelKey: 'Landscape 3:2', value: '3:2' },
  { labelKey: 'Portrait 2:3', value: '2:3' },
  { labelKey: 'Wide 16:9', value: '16:9' },
  { labelKey: 'Tall 9:16', value: '9:16' },
  { labelKey: 'Landscape 4:3', value: '4:3' },
  { labelKey: 'Portrait 3:4', value: '3:4' },
  { labelKey: 'Panorama 21:9', value: '21:9' },
] as const

/**
 * Quality is a separate provider hint (`auto`/`low`/`medium`/`high`), not a
 * resolution. 2K and 4K live in the size picker instead.
 */
export const IMAGE_STUDIO_QUALITY_PRESETS = [
  { labelKey: 'Auto', value: 'auto' },
  { labelKey: 'Low quality', value: 'low' },
  { labelKey: 'Medium quality', value: 'medium' },
  { labelKey: 'High', value: 'high' },
] as const

export const IMAGE_STUDIO_FORMATS = [
  { labelKey: 'PNG', value: 'png' },
  { labelKey: 'JPEG', value: 'jpeg' },
  { labelKey: 'WebP', value: 'webp' },
] as const

/** Default parameter draft used by 重置 and by a fresh page load. */
export const DEFAULT_IMAGE_STUDIO_PARAMS = {
  /** `auto` leaves the size to the model, which is what most providers prefer. */
  size: 'auto',
  quality: 'auto',
  n: 1,
  background: '',
  output_format: 'png',
} as const

export const IMAGE_STUDIO_PAGE_SIZE = 12
export const IMAGE_STUDIO_MAX_PROMPT_LENGTH = 8000

/**
 * Style presets appended to the prompt.
 *
 * `promptKey` is an i18n key, not the literal text: a Chinese interface appends
 * Chinese instructions, which is what the user reads and can edit afterwards.
 * Translating the fragment per locale keeps the chip honest — the tooltip shows
 * exactly what will be added, and no hidden English sneaks into the prompt.
 */
export const IMAGE_STUDIO_STYLE_PRESETS = [
  {
    id: 'photographic',
    labelKey: 'Photographic',
    promptKey:
      'photorealistic, natural lighting, 50mm lens, shallow depth of field, ultra detailed',
  },
  {
    id: 'cinematic',
    labelKey: 'Cinematic',
    promptKey:
      'cinematic composition, dramatic lighting, film grain, anamorphic lens flare, color graded',
  },
  {
    id: 'illustration',
    labelKey: 'Illustration',
    promptKey:
      'clean digital illustration, soft shading, expressive line work, vibrant but balanced palette',
  },
  {
    id: 'watercolor',
    labelKey: 'Watercolor',
    promptKey:
      'watercolor painting, wet on wet washes, paper texture, soft edges, gentle pigment bleed',
  },
  {
    id: 'three-d',
    labelKey: '3D Render',
    promptKey:
      '3D render, soft studio lighting, subsurface scattering, physically based materials, octane',
  },
  {
    id: 'flat-design',
    labelKey: 'Flat Design',
    promptKey:
      'flat vector design, bold geometric shapes, minimal detail, strong contrast, no gradients',
  },
  {
    id: 'anime',
    labelKey: 'Anime',
    promptKey:
      'anime key visual, cel shading, crisp outlines, dynamic pose, detailed background',
  },
  {
    id: 'ink',
    labelKey: 'Ink Wash',
    promptKey:
      'traditional ink wash painting, sumi-e brush strokes, negative space, rice paper texture',
  },
] as const

export type ImageStudioStylePresetId =
  (typeof IMAGE_STUDIO_STYLE_PRESETS)[number]['id']
