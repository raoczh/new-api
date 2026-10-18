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

/**
 * Image size arithmetic for the drawing workbench.
 *
 * Providers accept arbitrary `WxH` values, but most of them round internally
 * to a multiple of 16, refuse a side above 3840, and charge by resolution.
 * The picker therefore derives sizes from a short-side/long-side base instead
 * of offering a handful of hard-coded strings, and clamps hand-typed values
 * to the same window the reference playground uses.
 */

export type ImageStudioSizeTier = '1K' | '2K' | '4K'

const SIZE_PATTERN = /^\s*(\d+)\s*[x×]\s*(\d+)\s*$/
const RATIO_PATTERN = /^\s*(\d+(?:\.\d+)?)\s*[:x×]\s*(\d+(?:\.\d+)?)\s*$/

const STEP = 16

export const IMAGE_STUDIO_SIZE_LIMITS = {
  minSide: 256,
  maxSide: 3840,
  maxRatio: 3,
  minPixels: 655_360,
  maxPixels: 8_294_400,
  step: STEP,
} as const

/** `1K` bases on the short side, `2K`/`4K` on the long side. */
const TIER_BASE: Record<ImageStudioSizeTier, number> = {
  '1K': 1024,
  '2K': 2048,
  '4K': 3840,
}

function roundToStep(value: number): number {
  return Math.max(STEP, Math.round(value / STEP) * STEP)
}

/** Split `"1024x768"` into its two sides; `null` for anything else. */
export function parseImageSize(
  value: string
): { width: number; height: number } | null {
  const match = SIZE_PATTERN.exec(value.trim())
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

/** Split `"16:9"` or `"2.39:1"`; `null` for anything else. */
export function parseImageRatio(
  value: string
): { width: number; height: number } | null {
  const match = RATIO_PATTERN.exec(value.trim())
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

/**
 * Snap a hand-typed size into the supported window: multiples of 16, sides
 * between 256 and 3840, aspect no wider than 3:1, and a total pixel count
 * between 655,360 and 8,294,400. Returns `null` when the input is unusable.
 */
export function clampImageSize(
  width: number,
  height: number
): { size: string; adjusted: boolean } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null

  let nextWidth = width
  let nextHeight = height

  const longest = Math.max(nextWidth, nextHeight)
  if (longest > IMAGE_STUDIO_SIZE_LIMITS.maxSide) {
    const scale = IMAGE_STUDIO_SIZE_LIMITS.maxSide / longest
    nextWidth *= scale
    nextHeight *= scale
  }

  const shortest = Math.min(nextWidth, nextHeight)
  if (shortest < IMAGE_STUDIO_SIZE_LIMITS.minSide) {
    const scale = IMAGE_STUDIO_SIZE_LIMITS.minSide / shortest
    nextWidth *= scale
    nextHeight *= scale
  }

  if (Math.max(nextWidth, nextHeight) / Math.min(nextWidth, nextHeight) > IMAGE_STUDIO_SIZE_LIMITS.maxRatio) {
    if (nextWidth > nextHeight) {
      nextWidth = nextHeight * IMAGE_STUDIO_SIZE_LIMITS.maxRatio
    } else {
      nextHeight = nextWidth * IMAGE_STUDIO_SIZE_LIMITS.maxRatio
    }
  }

  const pixels = nextWidth * nextHeight
  if (pixels > IMAGE_STUDIO_SIZE_LIMITS.maxPixels) {
    const scale = Math.sqrt(IMAGE_STUDIO_SIZE_LIMITS.maxPixels / pixels)
    nextWidth *= scale
    nextHeight *= scale
  } else if (pixels < IMAGE_STUDIO_SIZE_LIMITS.minPixels) {
    const scale = Math.sqrt(IMAGE_STUDIO_SIZE_LIMITS.minPixels / pixels)
    nextWidth *= scale
    nextHeight *= scale
  }

  const finalWidth = roundToStep(nextWidth)
  const finalHeight = roundToStep(nextHeight)
  return {
    size: `${finalWidth}x${finalHeight}`,
    adjusted:
      finalWidth !== roundToStep(width) || finalHeight !== roundToStep(height),
  }
}

/**
 * Base-resolution × ratio → concrete `WxH`.
 *
 * At `1K` the short side is pinned, so a 16:9 tile is 1824x1024; at `2K` and
 * `4K` the long side is pinned, so the same tile is 2048x1152 and 3840x2160.
 * Squares ignore the rule and use the tier side directly.
 */
export function calculateImageSize(
  tier: ImageStudioSizeTier,
  ratio: string
): string | null {
  const parsed = parseImageRatio(ratio)
  if (!parsed) return null

  const base = TIER_BASE[tier]
  if (parsed.width === parsed.height) {
    return `${base}x${base}`
  }

  const wide = parsed.width > parsed.height
  if (tier === '1K') {
    const longSide = roundToStep((base * Math.max(parsed.width, parsed.height)) / Math.min(parsed.width, parsed.height))
    return wide ? `${longSide}x${base}` : `${base}x${longSide}`
  }

  const shortSide = roundToStep((base * Math.min(parsed.width, parsed.height)) / Math.max(parsed.width, parsed.height))
  return wide ? `${base}x${shortSide}` : `${shortSide}x${base}`
}

/** Reduce a size or ratio to its simplest label, e.g. "1024x1365" → "3:4". */
export function describeImageRatio(value: string): string {
  const parsed = parseImageSize(value) ?? parseImageRatio(value)
  if (!parsed) return value
  const divisor = greatestCommonDivisor(parsed.width, parsed.height)
  return `${Math.round(parsed.width / divisor)}:${Math.round(parsed.height / divisor)}`
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.round(a)
  let right = Math.round(b)
  while (right !== 0) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left || 1
}

/**
 * The picker's initial view for a stored size: a preset ratio+tier when the
 * string was produced by {@link calculateImageSize}, `auto` for an absent
 * size, and "custom" for anything else.
 */
export function findSizePreset(
  size: string,
  tiers: readonly ImageStudioSizeTier[],
  ratios: readonly string[]
): { tier: ImageStudioSizeTier; ratio: string } | null {
  if (!parseImageSize(size)) return null
  for (const tier of tiers) {
    for (const ratio of ratios) {
      if (calculateImageSize(tier, ratio) === size) return { tier, ratio }
    }
  }
  return null
}
