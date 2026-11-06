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
import { DEFAULT_IMAGE_STUDIO_PARAMS } from '../constants'
import type { ImageStudioTaskParams } from '../types'

/**
 * The editable parameter draft. It is a superset of what providers accept:
 * every field is optional so a model that ignores, say, `background` does not
 * break the request, and booleans are kept as booleans here and translated on
 * submit.
 */
export interface ImageStudioParamDraft {
  size: string
  quality: string
  n: number
  transparent: boolean
  outputFormat: string
  sizeMode?: 'exact' | 'resolution'
  resolution?: string
  aspectRatio?: string
  outputCompression?: number
  frameCount?: number
  frameDurationMs?: number
}

/** Sentinels meaning "do not forward this field; let the model decide". */
export const AUTO_IMAGE_STUDIO_SIZE = 'auto'
export const AUTO_IMAGE_STUDIO_QUALITY = 'auto'

export function createDefaultParamDraft(
  zhiqiEngine = false
): ImageStudioParamDraft {
  if (zhiqiEngine) {
    return {
      size: '',
      sizeMode: 'resolution',
      resolution: '',
      aspectRatio: '',
      quality: '',
      n: 1,
      transparent: false,
      outputFormat: '',
    }
  }
  return {
    size: DEFAULT_IMAGE_STUDIO_PARAMS.size,
    quality: DEFAULT_IMAGE_STUDIO_PARAMS.quality,
    n: DEFAULT_IMAGE_STUDIO_PARAMS.n,
    transparent: false,
    outputFormat: DEFAULT_IMAGE_STUDIO_PARAMS.output_format,
  }
}

/**
 * Translate the draft into the provider payload.
 *
 * `auto` means "let the model decide", so the key is omitted rather than sent
 * as the literal string. That matters twice: an older DALL·E endpoint rejects
 * `size: "auto"`, and quality only exists on the newer image models. If a user
 * picked an explicit value, it is forwarded untouched.
 *
 * `transparent` maps onto `background: "transparent"` because that is the name
 * every OpenAI-compatible image API understands; leaving it blank is the same
 * as omitting the field, so providers keep their own default.
 */
export function draftToParams(
  draft: ImageStudioParamDraft
): ImageStudioTaskParams {
  const params: ImageStudioTaskParams = {
    n: draft.n,
    output_format: draft.outputFormat,
  }
  if (draft.size && draft.size !== AUTO_IMAGE_STUDIO_SIZE) {
    params.size = draft.size
  }
  if (draft.quality && draft.quality !== AUTO_IMAGE_STUDIO_QUALITY) {
    params.quality = draft.quality
  }
  if (draft.transparent) {
    params.background = 'transparent'
  }
  return params
}

/** Stored records may predate the sentinel; treat them as auto too. */
export function paramsToDraft(
  params?: ImageStudioTaskParams | null,
  zhiqiEngine = false
): ImageStudioParamDraft {
  const draft = createDefaultParamDraft(zhiqiEngine)
  if (!params) return draft
  if (typeof params.size === 'string' && params.size) draft.size = params.size
  if (typeof params.quality === 'string' && params.quality) {
    draft.quality = params.quality
  }
  if (typeof params.n === 'number' && Number.isFinite(params.n)) {
    draft.n = Math.max(1, Math.trunc(params.n))
  }
  if (typeof params.output_format === 'string' && params.output_format) {
    draft.outputFormat = params.output_format
  }
  draft.transparent = params.background === 'transparent'
  if (!zhiqiEngine) {
    if (['svg', 'gif'].includes(draft.outputFormat)) {
      draft.outputFormat = DEFAULT_IMAGE_STUDIO_PARAMS.output_format
    }
    if (['xhigh', 'max'].includes(draft.quality)) {
      draft.quality = DEFAULT_IMAGE_STUDIO_PARAMS.quality
    }
  }
  if (zhiqiEngine) {
    draft.n = 1
    draft.transparent = false
    draft.resolution =
      typeof params.resolution === 'string' ? params.resolution : ''
    draft.aspectRatio =
      typeof params.aspect_ratio === 'string' ? params.aspect_ratio : ''
    draft.sizeMode =
      draft.resolution || draft.aspectRatio || !draft.size
        ? 'resolution'
        : 'exact'
    if (draft.outputFormat === 'jpeg' || draft.outputFormat === 'webp') {
      if (typeof params.output_compression === 'number') {
        draft.outputCompression = params.output_compression
      }
    }
    if (draft.outputFormat === 'gif') {
      if (typeof params.frame_count === 'number') {
        draft.frameCount = params.frame_count
      }
      if (typeof params.frame_duration_ms === 'number') {
        draft.frameDurationMs = params.frame_duration_ms
      }
    }
  }
  return draft
}

/** Preserve the workbench's existing ordinary-channel request semantics. */
export function buildComposerParams(
  draft: ImageStudioParamDraft,
  maxImages: number,
  zhiqiEngine: boolean
): ImageStudioTaskParams {
  if (!zhiqiEngine) {
    return {
      n: clampImageCount(draft.n, maxImages),
      size: draft.size,
      quality: draft.quality,
      output_format: draft.outputFormat,
      ...(draft.transparent ? { background: 'transparent' } : {}),
    }
  }
  const params: ImageStudioTaskParams = { n: 1, response_format: 'url' }
  if (draft.sizeMode === 'exact') {
    if (draft.size) params.size = draft.size
  } else {
    // Pixel mappings belong to the channel, never to the workbench.
    if (draft.resolution) params.resolution = draft.resolution
    if (draft.aspectRatio) params.aspect_ratio = draft.aspectRatio
  }
  if (draft.quality) params.quality = draft.quality
  if (draft.outputFormat) params.output_format = draft.outputFormat
  if (draft.outputFormat === 'jpeg' || draft.outputFormat === 'webp') {
    if (draft.outputCompression !== undefined) {
      params.output_compression = draft.outputCompression
    }
  }
  if (draft.outputFormat === 'gif') {
    if (draft.frameCount !== undefined) params.frame_count = draft.frameCount
    if (draft.frameDurationMs !== undefined) {
      params.frame_duration_ms = draft.frameDurationMs
    }
  }
  return params
}

/** Clamp a requested count to what the server is willing to accept. */
export function clampImageCount(value: number, max: number): number {
  const limit = Math.max(1, max)
  if (!Number.isFinite(value)) return 1
  return Math.min(limit, Math.max(1, Math.trunc(value)))
}
