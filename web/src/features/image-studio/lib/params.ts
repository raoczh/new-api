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
}

/** Sentinels meaning "do not forward this field; let the model decide". */
export const AUTO_IMAGE_STUDIO_SIZE = 'auto'
export const AUTO_IMAGE_STUDIO_QUALITY = 'auto'

export function createDefaultParamDraft(): ImageStudioParamDraft {
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
export function draftToParams(draft: ImageStudioParamDraft): ImageStudioTaskParams {
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
export function paramsToDraft(params?: ImageStudioTaskParams | null): ImageStudioParamDraft {
  const draft = createDefaultParamDraft()
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
  return draft
}

/** Clamp a requested count to what the server is willing to accept. */
export function clampImageCount(value: number, max: number): number {
  const limit = Math.max(1, max)
  if (!Number.isFinite(value)) return 1
  return Math.min(limit, Math.max(1, Math.trunc(value)))
}
