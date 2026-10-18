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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { uploadImageStudioFile } from '../api'
import { createDefaultParamDraft, type ImageStudioParamDraft } from '../lib/params'
import type { ImageStudioReference } from '../types'

export interface UseImageStudioDraftOptions {
  maxReferences: number
  uploadMaxMB: number
}

export interface DraftMask {
  key: string
  /** Object URL or server URL used by the preview. */
  url: string
  uploading: boolean
}

/** Shape returned by {@link useImageStudioDraft}, lifted so props can use it. */
export interface UseImageStudioDraftResult {
  prompt: string
  setPrompt: (value: string) => void
  params: ImageStudioParamDraft
  patchParams: (patch: Partial<ImageStudioParamDraft>) => void
  setParams: (next: ImageStudioParamDraft) => void
  references: ImageStudioReference[]
  readyReferences: ImageStudioReference[]
  failedReferences: ImageStudioReference[]
  referenceError: string | null
  setReferenceError: (value: string | null) => void
  addFiles: (files: File[]) => void
  removeReference: (uid: string) => void
  moveReference: (uid: string, direction: -1 | 1) => void
  mask: DraftMask | null
  setMask: (mask: DraftMask | null) => void
  uploading: boolean
  applyPreset: (preset: {
    prompt: string
    params?: Record<string, unknown> | null
    referenceUrls?: string[]
  }) => void
  reset: () => void
}

function createReference(file: File): ImageStudioReference {
  return {
    uid: crypto.randomUUID(),
    key: '',
    url: URL.createObjectURL(file),
    uploading: true,
  }
}

/**
 * Owns everything the composer edits: prompt, parameter draft, reference set
 * and mask. Uploads start as soon as a file is picked so the generate button
 * only waits on the slowest upload instead of starting after the click.
 */
export function useImageStudioDraft(
  options: UseImageStudioDraftOptions
): UseImageStudioDraftResult {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [params, setParams] = useState<ImageStudioParamDraft>(createDefaultParamDraft)
  const [references, setReferences] = useState<ImageStudioReference[]>([])
  const [mask, setMask] = useState<DraftMask | null>(null)
  const [referenceError, setReferenceError] = useState<string | null>(null)

  // Object URLs must be revoked when they are dropped or the page unmounts.
  const objectUrls = useRef<Set<string>>(new Set())

  const trackUrl = useCallback((url: string) => {
    if (url.startsWith('blob:')) objectUrls.current.add(url)
    return url
  }, [])

  const releaseUrl = useCallback((url: string) => {
    if (!url.startsWith('blob:')) return
    URL.revokeObjectURL(url)
    objectUrls.current.delete(url)
  }, [])

  useEffect(() => {
    const urls = objectUrls.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  const patchParams = useCallback((patch: Partial<ImageStudioParamDraft>) => {
    setParams((previous) => ({ ...previous, ...patch }))
  }, [])

  const updateReference = useCallback(
    (uid: string, patch: Partial<ImageStudioReference>) => {
      setReferences((previous) =>
        previous.map((item) => (item.uid === uid ? { ...item, ...patch } : item))
      )
    },
    []
  )

  const addFiles = useCallback(
    (files: File[]) => {
      setReferenceError(null)
      const room = options.maxReferences - references.length
      if (room <= 0) {
        setReferenceError(
          t('You can attach up to {{max}} reference images. Remove one first.', {
            max: options.maxReferences,
          })
        )
        return
      }

      const accepted = files.slice(0, room)
      if (files.length > room) {
        setReferenceError(
          t('Up to {{max}} reference images are allowed; kept the first {{kept}}.', {
            max: options.maxReferences,
            kept: room,
          })
        )
      }

      const maxBytes = options.uploadMaxMB * 1024 * 1024
      const next: ImageStudioReference[] = []
      for (const file of accepted) {
        if (!file.type.startsWith('image/')) {
          continue
        }
        if (file.size > maxBytes) {
          setReferenceError(
            t('Each image must be smaller than {{max}} MB', {
              max: options.uploadMaxMB,
            })
          )
          continue
        }
        const reference = createReference(file)
        trackUrl(reference.url)
        next.push(reference)

        void uploadImageStudioFile(file)
          .then((result) => {
            updateReference(reference.uid, { key: result.key, uploading: false })
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error
                ? error.message
                : t('The upload failed. Please pick the image again.')
            updateReference(reference.uid, {
              uploading: false,
              error: message,
            })
          })
      }

      if (next.length > 0) {
        setReferences((previous) => [...previous, ...next])
      }
    },
    [
      options.maxReferences,
      options.uploadMaxMB,
      references.length,
      t,
      trackUrl,
      updateReference,
    ]
  )

  const removeReference = useCallback(
    (uid: string) => {
      setReferences((previous) => {
        const target = previous.find((item) => item.uid === uid)
        if (target) releaseUrl(target.url)
        return previous.filter((item) => item.uid !== uid)
      })
    },
    [releaseUrl]
  )

  const moveReference = useCallback((uid: string, direction: -1 | 1) => {
    setReferences((previous) => {
      const index = previous.findIndex((item) => item.uid === uid)
      const target = index + direction
      if (index < 0 || target < 0 || target >= previous.length) return previous
      const next = [...previous]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }, [])

  /** Reuse an existing record: the prompt, its settings and its references. */
  const applyPreset = useCallback(
    (preset: {
      prompt: string
      params?: Record<string, unknown> | null
      referenceUrls?: string[]
    }) => {
      setPrompt(preset.prompt)
      setParams((previous) => ({
        ...previous,
        ...paramsFromPreset(preset.params),
      }))
      setMask(null)
      setReferences((previous) => {
        for (const item of previous) releaseUrl(item.url)
        const urls = preset.referenceUrls ?? []
        return urls.map((url) => ({
          uid: crypto.randomUUID(),
          // A reused reference keeps its server URL; the key lives in the path.
          key: keyFromUrl(url),
          url,
          uploading: false,
        }))
      })
    },
    [releaseUrl]
  )

  const reset = useCallback(() => {
    setPrompt('')
    setParams(createDefaultParamDraft())
    setReferenceError(null)
    setMask(null)
    setReferences((previous) => {
      for (const item of previous) releaseUrl(item.url)
      return []
    })
  }, [releaseUrl])

  const uploading = references.some((item) => item.uploading)
  const readyReferences = useMemo(
    () => references.filter((item) => item.key && !item.uploading && !item.error),
    [references]
  )
  const failedReferences = references.filter((item) => item.error)

  return {
    prompt,
    setPrompt,
    params,
    patchParams,
    setParams,
    references,
    readyReferences,
    failedReferences,
    referenceError,
    setReferenceError,
    addFiles,
    removeReference,
    moveReference,
    mask,
    setMask,
    uploading,
    applyPreset,
    reset,
  }
}

/** Only the keys the editors expose survive a reuse; everything else is dropped. */
function paramsFromPreset(params?: Record<string, unknown> | null): Partial<ImageStudioParamDraft> {
  if (!params) return {}
  const draft: Partial<ImageStudioParamDraft> = {}
  if (typeof params.size === 'string' && params.size) draft.size = params.size
  if (typeof params.quality === 'string' && params.quality) {
    draft.quality = params.quality
  }
  if (typeof params.n === 'number' && params.n > 0) draft.n = Math.trunc(params.n)
  if (typeof params.output_format === 'string' && params.output_format) {
    draft.outputFormat = params.output_format
  }
  draft.transparent = params.background === 'transparent'
  return draft
}

/**
 * The stored key is the tail of the URL. Accepting the URL back lets the
 * composer reuse references without a second upload round trip.
 */
function keyFromUrl(url: string): string {
  const marker = '/api/image-studio/files/'
  const index = url.indexOf(marker)
  if (index >= 0) return url.slice(index + marker.length)
  return ''
}
