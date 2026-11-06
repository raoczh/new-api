import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'

import { buildComposerParams } from '../../lib/params'
import { useImageStudioDraft } from '../use-image-studio-draft'

test('history reuse recovers public CDN reference keys in order without query or fragment text', () => {
  const { result } = renderHook(() =>
    useImageStudioDraft({
      maxReferences: 4,
      uploadMaxMB: 10,
      zhiqiEngine: true,
    })
  )
  const referenceUrls = [
    'https://cdn.example/prefix/img/abc/abc0123456789ABCDEFGHIJKLMNOPQRS.png?download=1#preview',
    'http://cdn.example/img/XYZ/XYZ0123456789abcdefghijklmnopqrs.webp',
    '/api/image-studio/files/original.png',
  ]

  act(() =>
    result.current.applyPreset({ prompt: 'Edit these images', referenceUrls })
  )

  expect(
    result.current.readyReferences.map((reference) => reference.key)
  ).toEqual([
    'img/abc/abc0123456789ABCDEFGHIJKLMNOPQRS.png',
    'img/XYZ/XYZ0123456789abcdefghijklmnopqrs.webp',
    'original.png',
  ])
  expect(
    result.current.readyReferences.map((reference) => reference.url)
  ).toEqual(referenceUrls)
})

test.each([
  'https://cdn.example/img/xyz/abc0123456789ABCDEFGHIJKLMNOPQRS.png',
  'https://cdn.example/img/abc/abc0123456789ABCDEFGHIJKLMNOPQR.png',
  'https://cdn.example/img/abc/abc0123456789ABCDEFGHIJKLMNOPQRS.svg',
  'https://cdn.example/img/abc/abc0123456789ABCDEFGHIJKLMNOPQRS.png/extra',
  'https://cdn.example/not-an-image?path=/img/abc/abc0123456789ABCDEFGHIJKLMNOPQRS.png#img/abc/abc0123456789ABCDEFGHIJKLMNOPQRS.png',
  '/prefix/img/abc/abc0123456789ABCDEFGHIJKLMNOPQRS.png',
  'ftp://cdn.example/img/abc/abc0123456789ABCDEFGHIJKLMNOPQRS.png',
])('history reuse leaves invalid public reference %s unavailable', (url) => {
  const { result } = renderHook(() =>
    useImageStudioDraft({
      maxReferences: 4,
      uploadMaxMB: 10,
      zhiqiEngine: true,
    })
  )

  act(() =>
    result.current.applyPreset({
      prompt: 'Edit this image',
      referenceUrls: [url],
    })
  )

  expect(result.current.references).toHaveLength(1)
  expect(result.current.references[0].key).toBe('')
  expect(result.current.readyReferences).toEqual([])
})

test('history reuse restores Zhiqi parameters including zero and omits stale draft fields', () => {
  const { result } = renderHook(() =>
    useImageStudioDraft({
      maxReferences: 4,
      uploadMaxMB: 10,
      zhiqiEngine: true,
      model: 'custom',
    })
  )
  act(() =>
    result.current.patchParams({
      outputFormat: 'gif',
      frameCount: 9,
      frameDurationMs: 200,
    })
  )
  act(() =>
    result.current.applyPreset({
      prompt: 'Edit a landscape',
      params: {
        resolution: '4k',
        aspect_ratio: '21:9',
        quality: 'max',
        output_format: 'webp',
        output_compression: 0,
      },
      referenceUrls: ['/api/image-studio/files/first.png'],
    })
  )
  expect(buildComposerParams(result.current.params, 4, true)).toEqual({
    n: 1,
    response_format: 'url',
    resolution: '4k',
    aspect_ratio: '21:9',
    quality: 'max',
    output_format: 'webp',
    output_compression: 0,
  })
  expect(
    result.current.readyReferences.map((reference) => reference.key)
  ).toEqual(['first.png'])
  act(() => result.current.applyPreset({ prompt: 'New scene', params: {} }))
  expect(buildComposerParams(result.current.params, 4, true)).toEqual({
    n: 1,
    response_format: 'url',
  })
  expect(result.current.references).toEqual([])
})

test('history with GIF parameters reused after the channel becomes ordinary drops Zhiqi-only values', () => {
  const { result } = renderHook(() =>
    useImageStudioDraft({ maxReferences: 4, uploadMaxMB: 10 })
  )
  act(() =>
    result.current.applyPreset({
      prompt: 'Flying bird',
      params: {
        output_format: 'gif',
        quality: 'xhigh',
        frame_count: 2,
        frame_duration_ms: 84,
        resolution: '2k',
      },
    })
  )
  expect(buildComposerParams(result.current.params, 4, false)).toEqual({
    n: 1,
    size: 'auto',
    quality: 'auto',
    output_format: 'png',
  })
})

test('reset within Zhiqi removes explicit parameters without introducing ordinary defaults', () => {
  const { result } = renderHook(() =>
    useImageStudioDraft({
      maxReferences: 4,
      uploadMaxMB: 10,
      zhiqiEngine: true,
    })
  )
  act(() =>
    result.current.applyPreset({
      prompt: 'Flying bird',
      params: { output_format: 'gif', frame_count: 2, frame_duration_ms: 84 },
    })
  )
  act(() => result.current.reset())
  expect(result.current.prompt).toBe('')
  expect(buildComposerParams(result.current.params, 4, true)).toEqual({
    n: 1,
    response_format: 'url',
  })
})

test.each(['move', 'delete'] as const)(
  'changing the first reference through %s clears its Zhiqi mask',
  (action) => {
    const { result } = renderHook(() =>
      useImageStudioDraft({
        maxReferences: 4,
        uploadMaxMB: 10,
        zhiqiEngine: true,
      })
    )
    act(() =>
      result.current.applyPreset({
        prompt: 'Edit a scene',
        referenceUrls: [
          '/api/image-studio/files/first.png',
          '/api/image-studio/files/second.png',
        ],
      })
    )
    const first = result.current.references[0]
    act(() =>
      result.current.setMask({
        key: 'mask.png',
        url: '/mask.png',
        uploading: false,
        referenceUid: first.uid,
      })
    )
    act(() => {
      if (action === 'move') result.current.moveReference(first.uid, 1)
      else result.current.removeReference(first.uid)
    })
    expect(result.current.mask).toBeNull()
    expect(result.current.readyReferences[0].key).toBe('second.png')
  }
)
