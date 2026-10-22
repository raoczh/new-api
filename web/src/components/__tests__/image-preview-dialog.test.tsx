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
import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { expect, test, vi } from 'vitest'

import { ImagePreviewDialog } from '../image-preview-dialog'

function renderDialog(
  props: Partial<ComponentProps<typeof ImagePreviewDialog>> = {}
) {
  const onOpenChange = props.onOpenChange ?? (() => undefined)
  render(
    <ImagePreviewDialog
      open
      onOpenChange={onOpenChange}
      src='https://img.example.com/result.png'
      {...props}
    />
  )
  return {
    onOpenChange,
    image: screen.getByRole('dialog').querySelector('img') as HTMLImageElement,
  }
}

test('shows the full-size image once it loads', () => {
  renderDialog({ alt: 'A generated sunset' })
  const dialog = screen.getByRole('dialog', { name: 'Image Preview' })
  const image = dialog.querySelector('img')
  expect(image).toHaveAttribute('src', 'https://img.example.com/result.png')
  expect(image).toHaveAttribute('alt', 'A generated sunset')
  fireEvent.load(image as HTMLImageElement)
  expect(image).toHaveClass('opacity-100')
})

test('replaces a broken image with an explicit failure message', () => {
  const { image } = renderDialog({
    src: 'https://img.example.com/missing.png',
  })
  fireEvent.error(image)
  expect(screen.getByText('Failed to load image')).toBeVisible()
})

test('reports dismissal through onOpenChange', () => {
  const onOpenChange = vi.fn()
  renderDialog({ onOpenChange })
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

test('zooming in scales the image and the reset control restores it', () => {
  const { image } = renderDialog()
  const reset = screen.getByRole('button', { name: 'Reset zoom' })
  expect(reset).toHaveTextContent('100%')

  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
  expect(reset).toHaveTextContent('125%')
  expect(image.style.transform).toContain('scale(1.25)')

  fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
  expect(reset).toHaveTextContent('100%')
})

test('rotating turns the image in place', () => {
  const { image } = renderDialog()
  fireEvent.click(screen.getByRole('button', { name: 'Rotate right' }))
  expect(image.style.transform).toContain('rotate(90deg)')

  fireEvent.click(screen.getByRole('button', { name: 'Rotate left' }))
  fireEvent.click(screen.getByRole('button', { name: 'Rotate left' }))
  expect(image.style.transform).toContain('rotate(270deg)')
})

test('clicking the backdrop closes the viewer but the image itself does not', () => {
  const onOpenChange = vi.fn()
  const { image } = renderDialog({ onOpenChange })

  fireEvent.click(image)
  expect(onOpenChange).not.toHaveBeenCalled()

  const stage = document.querySelector('[data-slot=image-preview-stage]')
  expect(stage).not.toBeNull()
  fireEvent.click(stage as HTMLElement)
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
