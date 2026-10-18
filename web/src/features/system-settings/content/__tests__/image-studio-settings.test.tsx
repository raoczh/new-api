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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import {
  ImageStudioSettingsSection,
  type ImageStudioDefaults,
} from '../image-studio-settings-section'

const DEFAULTS: ImageStudioDefaults = {
  Enabled: true,
  ImageConcurrency: 2,
  VideoConcurrency: 1,
  RetentionDays: 7,
  QueueMaxWaitMinutes: 30,
  MaxImagesPerRequest: 4,
  MaxReferenceImages: 4,
  UploadMaxMB: 10,
  StorageDir: 'data/image-studio',
  PublicBaseURL: '',
  ImageModels: ['gpt-image-1'],
}

function Fixture(props: Partial<ImageStudioDefaults>) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <ImageStudioSettingsSection
          defaultValues={{ ...DEFAULTS, ...props }}
        />
      </SettingsPageProvider>
    </>
  )
}

async function renderSettings(props: Partial<ImageStudioDefaults> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <Fixture {...props} />
    </QueryClientProvider>
  )
  return screen.findByRole('spinbutton', { name: 'Concurrent image jobs' })
}

beforeEach(() => {
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
})

test('the section exposes the concurrency, retention and quota limits', async () => {
  await renderSettings()

  expect(screen.getByRole('spinbutton', { name: 'Concurrent image jobs' })).toHaveValue(2)
  expect(screen.getByRole('spinbutton', { name: 'Concurrent video jobs' })).toHaveValue(1)
  expect(screen.getByRole('spinbutton', { name: 'Keep records for (days)' })).toHaveValue(7)
  expect(
    screen.getByRole('spinbutton', { name: 'Maximum queue wait (minutes)' })
  ).toHaveValue(30)
  expect(screen.getByRole('spinbutton', { name: 'Maximum images per request' })).toHaveValue(4)
  expect(screen.getByRole('spinbutton', { name: 'Maximum reference images' })).toHaveValue(4)
  expect(screen.getByRole('spinbutton', { name: 'Upload size limit (MB)' })).toHaveValue(10)
  expect(screen.getByRole('switch', { name: 'Enable the AI image workbench' })).toBeChecked()
  expect(screen.getByRole('textbox', { name: 'Storage directory' })).toHaveValue(
    'data/image-studio'
  )
})

test('saving sends only the limit that changed', async () => {
  const user = userEvent.setup()
  const concurrency = await renderSettings()

  fireEvent.change(concurrency, { target: { value: '4' } })
  await user.click(
    screen.getByRole('button', { name: 'Save image workbench settings' })
  )

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  expect(api.put).toHaveBeenCalledWith('/api/option/', {
    key: 'image_studio.image_concurrency',
    value: 4,
  })
})

test('turning the switch off saves image_studio.enabled', async () => {
  const user = userEvent.setup()
  await renderSettings()

  await user.click(
    screen.getByRole('switch', { name: 'Enable the AI image workbench' })
  )
  await user.click(
    screen.getByRole('button', { name: 'Save image workbench settings' })
  )

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  expect(api.put).toHaveBeenCalledWith('/api/option/', {
    key: 'image_studio.enabled',
    value: false,
  })
})

test('the model list is stored as a de-duplicated JSON array', async () => {
  const user = userEvent.setup()
  await renderSettings()

  const models = screen.getByRole('textbox', { name: 'Image models' })
  fireEvent.change(models, {
    target: { value: ' gpt-image-1 \nflux.1-schnell, gpt-image-1\n' },
  })
  await user.click(
    screen.getByRole('button', { name: 'Save image workbench settings' })
  )

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  expect(api.put).toHaveBeenCalledWith('/api/option/', {
    key: 'image_studio.image_models',
    value: JSON.stringify(['gpt-image-1', 'flux.1-schnell']),
  })
})

test('an invalid public image address blocks the save', async () => {
  const user = userEvent.setup()
  await renderSettings()

  const address = screen.getByRole('textbox', { name: 'Public image address' })
  fireEvent.change(address, { target: { value: 'img.example.com' } })
  await user.click(
    screen.getByRole('button', { name: 'Save image workbench settings' })
  )

  await waitFor(() => expect(address).toHaveAttribute('aria-invalid', 'true'))
  expect(api.put).not.toHaveBeenCalled()
})

test('a cleared upload limit shows a field error instead of saving a zero', async () => {
  const user = userEvent.setup()
  const upload = await renderSettings()

  fireEvent.change(upload, { target: { value: '0' } })
  await user.click(
    screen.getByRole('button', { name: 'Save image workbench settings' })
  )

  await waitFor(() => expect(upload).toHaveAttribute('aria-invalid', 'true'))
  expect(api.put).not.toHaveBeenCalled()
})

test('disabling the workbench greys out the limits without hiding them', async () => {
  const user = userEvent.setup()
  const concurrency = await renderSettings()

  await user.click(
    screen.getByRole('switch', { name: 'Enable the AI image workbench' })
  )

  expect(concurrency).toBeDisabled()
  expect(
    screen.getByRole('textbox', { name: 'Storage directory' })
  ).toBeDisabled()
  expect(screen.getByText('Concurrent image jobs')).toBeVisible()
})

test('reordering the model list alone still saves the new order', async () => {
  const user = userEvent.setup()
  await renderSettings({ ImageModels: ['gpt-image-1', 'flux.1-schnell'] })

  fireEvent.change(screen.getByRole('textbox', { name: 'Image models' }), {
    target: { value: 'flux.1-schnell\ngpt-image-1' },
  })
  await user.click(
    screen.getByRole('button', { name: 'Save image workbench settings' })
  )

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  expect(api.put).toHaveBeenCalledWith('/api/option/', {
    key: 'image_studio.image_models',
    value: JSON.stringify(['flux.1-schnell', 'gpt-image-1']),
  })
})
