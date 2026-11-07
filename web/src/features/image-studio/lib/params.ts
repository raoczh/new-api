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
  DEFAULT_IMAGE_STUDIO_PARAMS,
  IMAGE_STUDIO_FORMATS,
  IMAGE_STUDIO_GIF_FRAME_COUNT,
  IMAGE_STUDIO_QUALITY_PRESETS,
} from '../constants'
import type { ImageStudioTaskParams } from '../types'
import { parseImageSize } from './size'

/**
 * Common workbench parameters. Provider-specific translation stays on the
 * server, so selecting a different model never changes this draft's shape.
 */
export interface ImageStudioParamDraft {
  size: string
  quality: string
  n: number
  transparent: boolean
  outputFormat: string
  /** GIF only; 0 lets the provider choose. */
  frameCount: number
  /** GIF only, in milliseconds; 0 lets the provider choose. */
  frameDurationMs: number
}

/** Options a model offers beyond the common png/jpeg/webp and auto–high set. */
export interface ImageModelCapabilities {
  qualities: string[]
  formats: string[]
}

const COMMON_QUALITIES = ['auto', 'low', 'medium', 'high']
const COMMON_FORMATS = ['png', 'jpeg', 'webp']

/**
 * gpt-image-2 adds SVG output, 2.5 adds the xhigh/max quality tiers, and 2.6
 * adds animated GIF. Their -flare / -sunburst variants share the capabilities.
 */
export function getImageModelCapabilities(
  model: string
): ImageModelCapabilities {
  const match = /(?:^|[/:])gpt-image-(\d+(?:\.\d+)?)(?:-|$)/i.exec(model.trim())
  const version = match ? Number(match[1]) : 0
  const qualities = [...COMMON_QUALITIES]
  const formats = [...COMMON_FORMATS]
  if (version >= 2) formats.push('svg')
  if (version >= 2.5) qualities.push('xhigh', 'max')
  if (version >= 2.6) formats.push('gif')
  return { qualities, formats }
}

/** Fall back to defaults when the selected model lacks a drafted option. */
export function resolveParamDraft(
  draft: ImageStudioParamDraft,
  capabilities: ImageModelCapabilities
): ImageStudioParamDraft {
  return {
    ...draft,
    quality: capabilities.qualities.includes(draft.quality)
      ? draft.quality
      : DEFAULT_IMAGE_STUDIO_PARAMS.quality,
    outputFormat: capabilities.formats.includes(draft.outputFormat)
      ? draft.outputFormat
      : DEFAULT_IMAGE_STUDIO_PARAMS.output_format,
  }
}

export function createDefaultParamDraft(): ImageStudioParamDraft {
  return {
    size: DEFAULT_IMAGE_STUDIO_PARAMS.size,
    quality: DEFAULT_IMAGE_STUDIO_PARAMS.quality,
    n: DEFAULT_IMAGE_STUDIO_PARAMS.n,
    transparent: false,
    outputFormat: DEFAULT_IMAGE_STUDIO_PARAMS.output_format,
    frameCount: 0,
    frameDurationMs: 0,
  }
}

/** Reuse supported settings without inferring pixels from private metadata. */
export function paramsToDraft(
  params?: ImageStudioTaskParams | null
): ImageStudioParamDraft {
  const draft = createDefaultParamDraft()
  if (!params) return draft
  const size =
    typeof params.size === 'string' ? parseImageSize(params.size) : null
  if (size) draft.size = `${size.width}x${size.height}`
  if (
    typeof params.quality === 'string' &&
    IMAGE_STUDIO_QUALITY_PRESETS.some(
      (preset) => preset.value === params.quality
    )
  ) {
    draft.quality = params.quality
  }
  if (typeof params.n === 'number' && Number.isFinite(params.n)) {
    draft.n = Math.max(1, Math.trunc(params.n))
  }
  if (
    typeof params.output_format === 'string' &&
    IMAGE_STUDIO_FORMATS.some((format) => format.value === params.output_format)
  ) {
    draft.outputFormat = params.output_format
  }
  if (
    typeof params.frame_count === 'number' &&
    Number.isInteger(params.frame_count) &&
    params.frame_count >= IMAGE_STUDIO_GIF_FRAME_COUNT.min &&
    params.frame_count <= IMAGE_STUDIO_GIF_FRAME_COUNT.max
  ) {
    draft.frameCount = params.frame_count
  }
  if (
    typeof params.frame_duration_ms === 'number' &&
    Number.isInteger(params.frame_duration_ms) &&
    params.frame_duration_ms >= 20 &&
    params.frame_duration_ms <= 655350
  ) {
    draft.frameDurationMs = params.frame_duration_ms
  }
  draft.transparent = params.background === 'transparent'
  return draft
}

/**
 * Build the submitted parameters from a draft already resolved for the model.
 * Frame settings are sent only with GIF, the only format that accepts them.
 */
export function buildComposerParams(
  draft: ImageStudioParamDraft,
  maxImages: number
): ImageStudioTaskParams {
  const gif = draft.outputFormat === 'gif'
  return {
    n: clampImageCount(draft.n, maxImages),
    size: draft.size,
    quality: draft.quality,
    output_format: draft.outputFormat,
    ...(draft.transparent ? { background: 'transparent' } : {}),
    ...(gif && draft.frameCount > 0 ? { frame_count: draft.frameCount } : {}),
    ...(gif && draft.frameDurationMs > 0
      ? { frame_duration_ms: draft.frameDurationMs }
      : {}),
  }
}

/** Clamp a requested count to what the server is willing to accept. */
export function clampImageCount(value: number, max: number): number {
  const limit = Math.max(1, max)
  if (!Number.isFinite(value)) return 1
  return Math.min(limit, Math.max(1, Math.trunc(value)))
}
