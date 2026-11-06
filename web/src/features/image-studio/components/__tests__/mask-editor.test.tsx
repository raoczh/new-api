import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { ImageStudioMaskEditor } from '../mask-editor'
import { ImageStudioReferenceStrip } from '../reference-strip'

interface CanvasExport {
  width: number
  height: number
  type: string | undefined
  composite: string
}

let image: HTMLImageElement
let exported: CanvasExport[]

beforeEach(() => {
  image = document.createElement('img')
  Object.defineProperties(image, {
    naturalWidth: { value: 1024 },
    naturalHeight: { value: 768 },
  })
  vi.stubGlobal(
    'Image',
    class {
      constructor() {
        return image
      }
    }
  )
  exported = []
  const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      if (!contexts.has(this)) {
        contexts.set(this, {
          globalCompositeOperation: 'source-over',
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
        } as unknown as CanvasRenderingContext2D)
      }
      return contexts.get(this) ?? null
    }
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
    type
  ) {
    exported.push({
      width: this.width,
      height: this.height,
      type,
      composite: contexts.get(this)?.globalCompositeOperation ?? '',
    })
    callback(new Blob(['encoded image'], { type: 'image/png' }))
  })
  vi.spyOn(
    HTMLCanvasElement.prototype,
    'getBoundingClientRect'
  ).mockReturnValue({ width: 720, height: 540, left: 0, top: 0 } as DOMRect)
  vi.spyOn(api, 'post').mockImplementation(async (_url, body) => {
    const file = (body as FormData).get('file') as File
    return {
      data: {
        success: true,
        data: { key: file.name, url: `/api/image-studio/files/${file.name}` },
      },
    }
  })
})

afterEach(() => vi.unstubAllGlobals())

test.each([true, false])(
  'painting with transparentAreas=%s exports the correct mask contract',
  async (transparentAreas) => {
    const onUploaded = vi.fn()
    render(
      <ImageStudioMaskEditor
        open
        imageUrl='/reference.jpg'
        transparentAreas={transparentAreas}
        onOpenChange={() => {}}
        onUploaded={onUploaded}
      />
    )
    act(() => image.dispatchEvent(new Event('load')))
    const canvas = screen.getByLabelText('Mask painting area')
    Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() })
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Apply mask' }))
    await waitFor(() => expect(onUploaded).toHaveBeenCalled())
    expect(exported[0]).toEqual({
      width: 1024,
      height: 768,
      type: 'image/png',
      composite: transparentAreas ? 'destination-out' : 'source-over',
    })
    if (transparentAreas) {
      expect(exported[1]).toEqual({
        width: 1024,
        height: 768,
        type: 'image/png',
        composite: 'source-over',
      })
      expect(onUploaded).toHaveBeenCalledWith({
        key: 'mask.png',
        url: '/api/image-studio/files/mask.png',
        reference: {
          key: 'reference.png',
          url: '/api/image-studio/files/reference.png',
        },
      })
    } else {
      expect(exported).toHaveLength(1)
      expect(onUploaded).toHaveBeenCalledWith({
        key: 'mask.png',
        url: '/api/image-studio/files/mask.png',
        reference: undefined,
      })
    }
  }
)

test('only the first Zhiqi reference offers an enabled mask action', async () => {
  const onEditMask = vi.fn()
  const references = [
    { uid: 'first', key: 'first.png', url: '/first.png', uploading: false },
    { uid: 'second', key: 'second.png', url: '/second.png', uploading: false },
  ]
  render(
    <ImageStudioReferenceStrip
      references={references}
      firstImageMaskOnly
      maxReferences={2}
      onAddFiles={() => {}}
      onRemove={() => {}}
      onMove={() => {}}
      onEditMask={onEditMask}
    />
  )
  const buttons = screen.getAllByRole('button', {
    name: 'Paint a mask on this image',
  })
  expect(buttons[0]).toBeEnabled()
  expect(buttons[1]).toBeDisabled()
  await userEvent.click(buttons[0])
  expect(onEditMask).toHaveBeenCalledWith('first')
})
