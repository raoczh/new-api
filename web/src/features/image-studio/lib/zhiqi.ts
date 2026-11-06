import { z } from 'zod'

import type { ImageStudioParamDraft } from './params'

export const ZHIQI_MAX_PROMPT_LENGTH = 32000
export const ZHIQI_MAX_REFERENCES = 16
export const ZHIQI_RESOLUTIONS = ['', '1k', '1080p', '2k', '4k'] as const
export const ZHIQI_ASPECT_RATIOS = [
  '',
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const

/** These are documented suggestions, not a claim about a channel's abilities. */
export function getZhiqiParameterSuggestions(model: string): {
  qualities: string[]
  formats: string[]
} {
  const knownGpt =
    /^gpt-image-(?:1(?:\.5)?|2(?:\.[56])?)(?:-flare|-sunburst)?(?:-asynchronous)?$/i.test(
      model
    )
  const extendedQuality =
    /^gpt-image-2\.[56](?:-flare|-sunburst)?(?:-asynchronous)?$/i.test(model)
  const gifCandidate =
    /^gpt-image-2\.6(?:-flare|-sunburst)?(?:-asynchronous)?$/i.test(model)
  return {
    qualities: [
      '',
      'auto',
      'low',
      'medium',
      'high',
      ...(!knownGpt || extendedQuality ? ['xhigh', 'max'] : []),
    ],
    formats: [
      '',
      'png',
      'jpeg',
      'webp',
      'svg',
      ...(!knownGpt || gifCandidate ? ['gif'] : []),
    ],
  }
}

const zhiqiDraftSchema = z.object({
  resolution: z.enum(ZHIQI_RESOLUTIONS).optional(),
  aspectRatio: z.enum(ZHIQI_ASPECT_RATIOS).optional(),
  outputCompression: z.number().int().min(0).max(100).optional(),
  frameCount: z.number().int().min(2).max(16).optional(),
  frameDurationMs: z.number().int().min(20).max(655350).optional(),
})

/** Field names let controls expose invalid states without duplicating bounds. */
export function getZhiqiInvalidFields(
  draft: ImageStudioParamDraft,
  model: string
): Set<string> {
  const result = zhiqiDraftSchema.safeParse(draft)
  const fields = new Set<string>()
  if (!result.success) {
    for (const issue of result.error.issues) fields.add(String(issue.path[0]))
  }
  const suggestions = getZhiqiParameterSuggestions(model)
  if (!suggestions.qualities.includes(draft.quality)) fields.add('quality')
  if (!suggestions.formats.includes(draft.outputFormat)) {
    fields.add('outputFormat')
  }
  if (draft.sizeMode === 'exact' && draft.size && draft.size !== 'auto') {
    const match = /^([1-9]\d*)x([1-9]\d*)$/.exec(draft.size)
    if (!match || Number(match[1]) > 4096 || Number(match[2]) > 4096) {
      fields.add('size')
    }
  }
  return fields
}

/** Format and sizing mode transitions never keep hidden, incompatible values. */
export function patchImageStudioParams(
  previous: ImageStudioParamDraft,
  patch: Partial<ImageStudioParamDraft>
): ImageStudioParamDraft {
  const next = { ...previous, ...patch }
  if (patch.outputFormat !== undefined) {
    if (next.outputFormat !== 'jpeg' && next.outputFormat !== 'webp') {
      next.outputCompression = undefined
    }
    if (next.outputFormat !== 'gif') {
      next.frameCount = undefined
      next.frameDurationMs = undefined
    }
  }
  if (patch.sizeMode === 'exact') {
    next.resolution = ''
    next.aspectRatio = ''
  } else if (patch.sizeMode === 'resolution') {
    next.size = ''
  }
  return next
}
