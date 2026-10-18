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
import { EraserIcon, Loader2Icon, Undo2Icon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'

import { uploadImageStudioFile } from '../api'

export interface ImageStudioMaskEditorProps {
  open: boolean
  /** Reference image the mask is painted over. */
  imageUrl: string
  disabled?: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: (mask: { key: string; url: string }) => void
}

const MAX_STROKES = 40

/**
 * Inpainting mask painter.
 *
 * The exported PNG follows the OpenAI edit convention: white marks the area to
 * repaint and black keeps the original pixels. Painting happens on an overlay
 * canvas tinted red so the user can see the selection, then the mask is rebuilt
 * from the stored strokes at export time — that keeps the tint out of the file.
 */
export function ImageStudioMaskEditor(props: ImageStudioMaskEditorProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const baseRef = useRef<HTMLImageElement | null>(null)
  const strokesRef = useRef<Array<Array<{ x: number; y: number }>>>([])
  const drawingRef = useRef(false)
  const [brush, setBrush] = useState(36)
  const [ready, setReady] = useState(false)
  const [strokeCount, setStrokeCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const image = baseRef.current
    if (!canvas || !image) return
    const context = canvas.getContext('2d')
    if (!context) return

    const ratio = image.naturalWidth / image.naturalHeight || 1
    const width = 720
    const height = Math.round(width / ratio)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    context.clearRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    const scale = width / image.naturalWidth
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = 'rgba(239, 68, 68, 0.45)'
    context.lineWidth = brush * scale
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) {
        const [point] = stroke
        if (!point) continue
        context.beginPath()
        context.arc(point.x * scale, point.y * scale, (brush * scale) / 2, 0, Math.PI * 2)
        context.fillStyle = 'rgba(239, 68, 68, 0.45)'
        context.fill()
        continue
      }
      context.beginPath()
      context.moveTo(stroke[0].x * scale, stroke[0].y * scale)
      for (const point of stroke.slice(1)) {
        context.lineTo(point.x * scale, point.y * scale)
      }
      context.stroke()
    }
  }, [brush])

  useEffect(() => {
    if (!props.open) return
    setError(null)
    setReady(false)
    setUploading(false)
    strokesRef.current = []
    setStrokeCount(0)

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      baseRef.current = image
      setReady(true)
      redraw()
    }
    image.onerror = () => {
      setError(t('The reference image could not be loaded. Upload it again.'))
    }
    image.src = props.imageUrl
  }, [props.open, props.imageUrl, redraw, t])

  useEffect(() => {
    if (ready) redraw()
  }, [brush, ready, redraw])

  const pointerPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const image = baseRef.current
    if (!canvas || !image) return null
    const rect = canvas.getBoundingClientRect()
    const scale = image.naturalWidth / rect.width
    return {
      x: (event.clientX - rect.left) * scale,
      y: (event.clientY - rect.top) * scale,
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (uploading) return
    const point = pointerPoint(event)
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    strokesRef.current = [...strokesRef.current, [point]].slice(-MAX_STROKES)
    setStrokeCount(strokesRef.current.length)
    redraw()
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || uploading) return
    const point = pointerPoint(event)
    if (!point) return
    const strokes = strokesRef.current
    const last = strokes.at(-1)
    if (!last) return
    last.push(point)
    redraw()
  }

  const handlePointerUp = () => {
    drawingRef.current = false
  }

  const handleUndo = () => {
    strokesRef.current = strokesRef.current.slice(0, -1)
    setStrokeCount(strokesRef.current.length)
    redraw()
  }

  const handleClear = () => {
    strokesRef.current = []
    setStrokeCount(0)
    redraw()
  }

  const handleSave = async () => {
    const image = baseRef.current
    if (!image) return
    if (strokesRef.current.length === 0) {
      setError(t('Paint over the part you want to regenerate first.'))
      return
    }
    setUploading(true)
    setError(null)
    try {
      const mask = document.createElement('canvas')
      mask.width = image.naturalWidth
      mask.height = image.naturalHeight
      const context = mask.getContext('2d')
      if (!context) throw new Error(t('The browser could not prepare the mask.'))

      context.fillStyle = '#000000'
      context.fillRect(0, 0, mask.width, mask.height)
      context.strokeStyle = '#ffffff'
      context.fillStyle = '#ffffff'
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.lineWidth = brush
      for (const stroke of strokesRef.current) {
        if (stroke.length < 2) {
          const [point] = stroke
          if (!point) continue
          context.beginPath()
          context.arc(point.x, point.y, brush / 2, 0, Math.PI * 2)
          context.fill()
          continue
        }
        context.beginPath()
        context.moveTo(stroke[0].x, stroke[0].y)
        for (const point of stroke.slice(1)) {
          context.lineTo(point.x, point.y)
        }
        context.stroke()
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        mask.toBlob((value) => resolve(value), 'image/png')
      })
      if (!blob) throw new Error(t('The browser could not prepare the mask.'))
      const file = new File([blob], 'mask.png', { type: 'image/png' })
      const uploaded = await uploadImageStudioFile(file)
      props.onUploaded({ key: uploaded.key, url: uploaded.url })
      props.onOpenChange(false)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t('The mask could not be saved. Try again.')
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Mask editor')}</DialogTitle>
          <DialogDescription>
            {t(
              'Paint over the area you want the model to redraw. Everything else stays untouched.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='bg-muted/40 flex items-center justify-center overflow-hidden rounded-lg border p-1'>
          <canvas
            ref={canvasRef}
            className='max-h-[60vh] w-full cursor-crosshair touch-none rounded-md object-contain'
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label={t('Mask painting area')}
          />
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          <EraserIcon className='text-muted-foreground size-4' aria-hidden='true' />
          <Slider
            className='w-40'
            min={8}
            max={120}
            step={4}
            value={[brush]}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value
              setBrush(Number(next) || 36)
            }}
            aria-label={t('Brush size')}
          />
          <span className='text-muted-foreground w-10 text-xs'>{brush}px</span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleUndo}
            disabled={strokeCount === 0 || uploading}
          >
            <Undo2Icon className='size-3.5' aria-hidden='true' />
            {t('Undo')}
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={handleClear}
            disabled={strokeCount === 0 || uploading}
          >
            {t('Clear')}
          </Button>
        </div>

        {error && <p className='text-destructive text-xs'>{error}</p>}

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={uploading}
          >
            {t('Cancel')}
          </Button>
          <Button type='button' onClick={handleSave} disabled={!ready || uploading}>
            {uploading && <Loader2Icon className='size-4 animate-spin' aria-hidden='true' />}
            {t('Apply mask')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
