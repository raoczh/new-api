import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'

import {
  buildComposerParams,
  getImageModelCapabilities,
  resolveParamDraft,
} from '../../lib/params'
import { useImageStudioDraft } from '../use-image-studio-draft'

test('history reuse recovers public CDN reference keys in order without query or fragment text', () => {
  const { result } = renderHook(() =>
    useImageStudioDraft({ maxReferences: 4, uploadMaxMB: 10 })
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
    useImageStudioDraft({ maxReferences: 4, uploadMaxMB: 10 })
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

test('history reuse preserves ordinary count and transparency and ignores provider-private fields without guessing pixels', () => {
  const { result } = renderHook(() =>
    useImageStudioDraft({ maxReferences: 4, uploadMaxMB: 10 })
  )
  act(() =>
    result.current.applyPreset({
      prompt: 'Edit a landscape',
      params: {
        n: 3,
        background: 'transparent',
        quality: 'high',
        output_format: 'webp',
        resolution: '4k',
        aspect_ratio: '21:9',
        output_compression: 0,
      },
      referenceUrls: ['/api/image-studio/files/first.png'],
    })
  )
  expect(buildComposerParams(result.current.params, 4)).toEqual({
    n: 3,
    size: 'auto',
    quality: 'high',
    output_format: 'webp',
    background: 'transparent',
  })
  expect(
    result.current.readyReferences.map((reference) => reference.key)
  ).toEqual(['first.png'])
  act(() =>
    result.current.applyPreset({
      prompt: 'New scene',
      params: { size: '1536x1024' },
    })
  )
  expect(buildComposerParams(result.current.params, 4)).toEqual({
    n: 1,
    size: '1536x1024',
    quality: 'auto',
    output_format: 'png',
  })
  expect(result.current.references).toEqual([])
})

test('history GIF settings are reused on gpt-image-2.6 and fall back to defaults on models without them', () => {
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
  const draft = result.current.params
  expect(
    buildComposerParams(
      resolveParamDraft(draft, getImageModelCapabilities('gpt-image-2.6')),
      4
    )
  ).toEqual({
    n: 1,
    size: 'auto',
    quality: 'xhigh',
    output_format: 'gif',
    frame_count: 2,
    frame_duration_ms: 84,
  })
  expect(
    buildComposerParams(
      resolveParamDraft(draft, getImageModelCapabilities('gpt-image-1')),
      4
    )
  ).toEqual({
    n: 1,
    size: 'auto',
    quality: 'auto',
    output_format: 'png',
  })
})

test.each(['16:9', '4k', 'auto'])(
  'history size %s keeps automatic sizing instead of inventing provider-specific pixels',
  (size) => {
    const { result } = renderHook(() =>
      useImageStudioDraft({ maxReferences: 4, uploadMaxMB: 10 })
    )
    act(() =>
      result.current.applyPreset({
        prompt: 'A landscape',
        params: {
          size,
          quality: 'max',
          output_format: 'svg',
          n: 2,
          background: 'transparent',
        },
      })
    )
    expect(buildComposerParams(result.current.params, 4)).toEqual({
      n: 2,
      size: 'auto',
      quality: 'max',
      output_format: 'svg',
      background: 'transparent',
    })
  }
)

test('reset restores ordinary defaults and clears references and mask', () => {
  const { result } = renderHook(() =>
    useImageStudioDraft({ maxReferences: 4, uploadMaxMB: 10 })
  )
  act(() =>
    result.current.applyPreset({
      prompt: 'Flying bird',
      params: { n: 3, background: 'transparent' },
      referenceUrls: ['/api/image-studio/files/first.png'],
    })
  )
  act(() =>
    result.current.setMask({
      key: 'mask.png',
      url: '/mask.png',
      uploading: false,
      referenceUid: result.current.references[0].uid,
    })
  )
  act(() => result.current.reset())
  expect(result.current.prompt).toBe('')
  expect(buildComposerParams(result.current.params, 4)).toEqual({
    n: 1,
    size: 'auto',
    quality: 'auto',
    output_format: 'png',
  })
  expect(result.current.references).toEqual([])
  expect(result.current.mask).toBeNull()
})

test.each(['move', 'delete'] as const)(
  'changing the first reference through %s clears its mask for every channel',
  (action) => {
    const { result } = renderHook(() =>
      useImageStudioDraft({ maxReferences: 4, uploadMaxMB: 10 })
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

test('reordering later references preserves a mask attached to the unchanged first image', () => {
  const { result } = renderHook(() =>
    useImageStudioDraft({ maxReferences: 4, uploadMaxMB: 10 })
  )
  act(() =>
    result.current.applyPreset({
      prompt: 'Edit a scene',
      referenceUrls: [
        '/api/image-studio/files/first.png',
        '/api/image-studio/files/second.png',
        '/api/image-studio/files/third.png',
      ],
    })
  )
  const mask = {
    key: 'mask.png',
    url: '/mask.png',
    uploading: false,
    referenceUid: result.current.references[0].uid,
  }
  act(() => result.current.setMask(mask))
  act(() => result.current.moveReference(result.current.references[2].uid, -1))
  expect(result.current.mask).toEqual(mask)
  expect(
    result.current.readyReferences.map((reference) => reference.key)
  ).toEqual(['first.png', 'third.png', 'second.png'])
})
