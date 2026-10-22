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
  ImageOffIcon,
  Loader2Icon,
  RotateCcwIcon,
  RotateCwIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

const toolbarButtonClassName =
  'text-white hover:bg-white/15 hover:text-white disabled:opacity-40'

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}

export interface ImagePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Image to show; null keeps the dialog closed without unmounting it. */
  src: string | null
  title?: string
  description?: string
  alt?: string
  /** Print the image address under the preview, for diagnostic contexts. */
  showSource?: boolean
}

/**
 * Full-screen image viewer for record details and log tables. The image is
 * fitted to the viewport and can be zoomed, rotated, and dragged like the
 * Element Plus image viewer; clicking the empty area around it closes the
 * viewer. The business `Dialog` wrapper always renders a framed header and
 * body, so this viewer composes the dialog primitives directly.
 */
export function ImagePreviewDialog(props: ImagePreviewDialogProps) {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const src = props.src
  const loading = src !== null && loadedSrc !== src
  const failed = src !== null && failedSrc === src
  const canPan = zoom > 1 || rotation !== 0

  useEffect(() => {
    setLoadedSrc(null)
    setFailedSrc(null)
    setZoom(1)
    setRotation(0)
    setOffset({ x: 0, y: 0 })
  }, [props.open, src])

  // React registers wheel listeners as passive, so the zoom handler needs a
  // native listener to keep the page from scrolling underneath the viewer.
  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      setZoom((current) => clampZoom(current - event.deltaY * 0.002))
    }
    node.addEventListener('wheel', handleWheel, { passive: false })
    return () => node.removeEventListener('wheel', handleWheel)
  }, [props.open])

  useEffect(() => {
    if (zoom <= 1) setOffset({ x: 0, y: 0 })
  }, [zoom])

  const changeZoom = (delta: number) => {
    setZoom((current) => clampZoom(current + delta))
  }

  const rotate = (delta: number) => {
    setRotation((current) => (current + delta + 360) % 360)
    setOffset({ x: 0, y: 0 })
  }

  const resetView = () => {
    setZoom(1)
    setRotation(0)
    setOffset({ x: 0, y: 0 })
  }

  const handleStageClick = () => {
    props.onOpenChange(false)
  }

  const handlePointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (!canPan) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setOffset({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    })
  }

  const handlePointerEnd = (event: PointerEvent<HTMLImageElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const handleDoubleClick = () => {
    if (zoom === 1) {
      setZoom(2)
      return
    }
    resetView()
  }

  const title = props.title ?? t('Image Preview')

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className='top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-black/95 p-0 text-white ring-0 sm:max-w-none'
      >
        <DialogTitle className='sr-only'>{title}</DialogTitle>
        {props.description ? (
          <DialogDescription className='sr-only'>
            {props.description}
          </DialogDescription>
        ) : null}

        <div className='pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4'>
          <div className='min-w-0'>
            <p className='truncate text-sm font-medium'>{title}</p>
            {props.description ? (
              <p className='truncate text-xs text-white/60'>
                {props.description}
              </p>
            ) : null}
          </div>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            className={cn(
              'pointer-events-auto shrink-0',
              toolbarButtonClassName
            )}
            onClick={() => props.onOpenChange(false)}
            aria-label={t('Close')}
          >
            <XIcon className='size-4' aria-hidden='true' />
          </Button>
        </div>

        <div
          ref={stageRef}
          data-slot='image-preview-stage'
          className='relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 pt-16 pb-20'
          onClick={handleStageClick}
        >
          {loading && !failed ? (
            <Loader2Icon
              className='pointer-events-none absolute size-8 animate-spin text-white/60'
              aria-hidden='true'
            />
          ) : null}

          {failed ? (
            <div className='pointer-events-none flex flex-col items-center gap-2 text-white/60'>
              <ImageOffIcon className='size-8' aria-hidden='true' />
              <p className='text-sm'>{t('Failed to load image')}</p>
            </div>
          ) : null}

          {src ? (
            <img
              src={src}
              alt={props.alt ?? t('Generated image')}
              draggable={false}
              onLoad={() => setLoadedSrc(src)}
              onError={() => setFailedSrc(src)}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onDoubleClick={handleDoubleClick}
              onClick={(event) => event.stopPropagation()}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              }}
              className={cn(
                'max-h-full max-w-full touch-none object-contain select-none',
                loading || failed ? 'opacity-0' : 'opacity-100',
                canPan ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
              )}
            />
          ) : null}
        </div>

        {src && !failed ? (
          <div className='absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-1 text-white shadow-lg backdrop-blur'>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className={toolbarButtonClassName}
              onClick={() => changeZoom(-ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              aria-label={t('Zoom out')}
            >
              <ZoomOutIcon className='size-4' aria-hidden='true' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className={cn(
                'min-w-14 justify-center text-xs tabular-nums',
                toolbarButtonClassName
              )}
              onClick={resetView}
              aria-label={t('Reset zoom')}
            >
              {Math.round(zoom * 100)}%
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className={toolbarButtonClassName}
              onClick={() => changeZoom(ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              aria-label={t('Zoom in')}
            >
              <ZoomInIcon className='size-4' aria-hidden='true' />
            </Button>
            <span className='mx-1 h-5 w-px bg-white/20' aria-hidden='true' />
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className={toolbarButtonClassName}
              onClick={() => rotate(-90)}
              aria-label={t('Rotate left')}
            >
              <RotateCcwIcon className='size-4' aria-hidden='true' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className={toolbarButtonClassName}
              onClick={() => rotate(90)}
              aria-label={t('Rotate right')}
            >
              <RotateCwIcon className='size-4' aria-hidden='true' />
            </Button>
          </div>
        ) : null}

        {props.showSource && src ? (
          <p
            className='absolute bottom-16 left-4 z-10 max-w-[min(36rem,60vw)] truncate font-mono text-[11px] text-white/50'
            title={src}
          >
            {src}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
