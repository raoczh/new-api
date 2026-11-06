import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { submitImageStudioTask } from '../../api'
import { useImageStudioDraft } from '../../hooks/use-image-studio-draft'
import type { ImageStudioConfig, ImageStudioGroupOption } from '../../types'
import { ImageStudioComposer } from '../studio-composer'

const config: ImageStudioConfig = {
  enabled: true,
  image_concurrency: 2,
  video_concurrency: 1,
  retention_days: 7,
  max_images_per_request: 4,
  max_reference_images: 20,
  upload_max_mb: 10,
  queue_max_wait_minutes: 5,
  image_models: [],
  smtp_configured: false,
}

const groups: ImageStudioGroupOption[] = [
  {
    group: 'default',
    desc: '',
    ratio: 1,
    models: [
      { model: 'gpt-image-2.6', quota_type: 1, price: 0, zhiqi_engine: true },
      { model: 'gpt-image-2.5', quota_type: 1, price: 0, zhiqi_engine: true },
      { model: 'custom-image', quota_type: 1, price: 0, zhiqi_engine: true },
      { model: 'ordinary-image', quota_type: 1, price: 0 },
      {
        model: 'mixed-image',
        quota_type: 1,
        price: 0,
        zhiqi_mixed_channels: true,
      },
    ],
  },
]

function ComposerHarness(props: {
  initialModel?: string
  oldServer?: boolean
  maxReferences?: number
}) {
  const [model, setModel] = useState(props.initialModel ?? 'gpt-image-2.6')
  const availableGroups = props.oldServer
    ? [
        {
          ...groups[0],
          models: groups[0].models.map((item) => ({
            ...item,
            zhiqi_engine: undefined,
          })),
        },
      ]
    : groups
  const zhiqiEngine =
    availableGroups[0].models.find((item) => item.model === model)
      ?.zhiqi_engine === true
  const draft = useImageStudioDraft({
    maxReferences: Math.min(props.maxReferences ?? 20, zhiqiEngine ? 16 : 20),
    uploadMaxMB: 10,
    model,
    zhiqiEngine,
  })
  return (
    <ImageStudioComposer
      config={{ ...config, max_reference_images: props.maxReferences ?? 20 }}
      groups={availableGroups}
      selectedModel={model}
      selectedGroup='default'
      submitting={false}
      draft={draft}
      onModelChange={setModel}
      onGroupChange={() => {}}
      onSubmit={(payload) => {
        void submitImageStudioTask(payload)
      }}
    />
  )
}

beforeEach(() => {
  vi.spyOn(api, 'post').mockResolvedValue({ data: { success: true, data: {} } })
})

async function selectParameter(label: string, option: string) {
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: new RegExp(`^${label}:`) })
  )
  await user.click(await screen.findByRole('option', { name: option }))
  await user.keyboard('{Escape}')
}

async function selectModel(current: string, next: string) {
  const user = userEvent.setup()
  const trigger = screen.getByRole('combobox', { name: 'Select model' })
  expect(trigger).toHaveTextContent(current)
  await user.click(trigger)
  await user.click(
    await screen.findByRole('option', { name: new RegExp(`^${next}`) })
  )
}

test('Zhiqi submits URL-only defaults without manufacturing quality, size or format', async () => {
  render(<ComposerHarness />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
    target: { value: 'A blue bird' },
  })
  expect(screen.getByRole('button', { name: 'Count: 1' })).toBeDisabled()
  expect(
    screen.queryByRole('switch', { name: 'Transparent background' })
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Reference/ })).toHaveTextContent(
    '0/16'
  )
  await userEvent.click(screen.getByRole('button', { name: 'Generate 1' }))
  expect(api.post).toHaveBeenCalledWith('/api/image-studio/tasks', {
    model: 'gpt-image-2.6',
    group: 'default',
    prompt: 'A blue bird',
    params: { n: 1, response_format: 'url' },
    reference_keys: [],
    mask_key: '',
  })
})

test('Zhiqi submits resolution and ratio unchanged and preserves explicit compression zero', async () => {
  render(<ComposerHarness />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
    target: { value: 'A blue bird' },
  })
  await selectParameter('Resolution', '1080p')
  await selectParameter('Aspect ratio', '4:5')
  await selectParameter('Quality', 'auto')
  await selectParameter('Format', 'JPEG')
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Output compression (0-100)' }),
    { target: { value: '0' } }
  )
  await userEvent.click(screen.getByRole('button', { name: 'Generate 1' }))
  expect(vi.mocked(api.post).mock.calls[0]?.[1]).toMatchObject({
    params: {
      n: 1,
      response_format: 'url',
      resolution: '1080p',
      aspect_ratio: '4:5',
      quality: 'auto',
      output_format: 'jpeg',
      output_compression: 0,
    },
  })
  expect(
    (vi.mocked(api.post).mock.calls[0][1] as { params: object }).params
  ).not.toHaveProperty('size')
})

test('exact size and literal auto never use ratio pixel mappings and switching modes clears hidden fields', async () => {
  render(<ComposerHarness />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
    target: { value: 'A blue bird' },
  })
  await selectParameter('Resolution', '2k')
  await selectParameter('Aspect ratio', '4:3')
  await selectParameter('Size mode', 'Exact size or auto')
  const size = screen.getByRole('textbox', { name: 'Exact size or auto' })
  fireEvent.change(size, { target: { value: '1024X1024' } })
  expect(size).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByRole('button', { name: 'Generate 1' })).toBeDisabled()
  fireEvent.change(size, { target: { value: 'auto' } })
  await userEvent.click(screen.getByRole('button', { name: 'Generate 1' }))
  expect(vi.mocked(api.post).mock.calls[0]?.[1]).toMatchObject({
    params: { n: 1, response_format: 'url', size: 'auto' },
  })
  expect(
    (vi.mocked(api.post).mock.calls[0][1] as { params: object }).params
  ).not.toHaveProperty('resolution')
  await selectParameter('Size mode', 'Resolution and aspect ratio')
  expect(
    screen.getByRole('button', { name: 'Resolution: Model default' })
  ).toBeVisible()
})

test.each([
  ['GIF frames (2-16)', '1'],
  ['GIF frames (2-16)', '17'],
  ['GIF frames (2-16)', '2.5'],
  ['Frame duration (20-655350 ms)', '19'],
  ['Frame duration (20-655350 ms)', '655351'],
])('invalid %s value %s blocks GIF submission', async (label, value) => {
  render(<ComposerHarness />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
    target: { value: 'Flying bird' },
  })
  await selectParameter('Format', 'GIF')
  fireEvent.change(screen.getByRole('spinbutton', { name: label }), {
    target: { value },
  })
  expect(screen.getByRole('spinbutton', { name: label })).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  expect(screen.getByRole('button', { name: 'Generate 1' })).toBeDisabled()
  expect(api.post).not.toHaveBeenCalled()
})

test('switching JPEG to GIF drops compression and switching back drops frame parameters', async () => {
  render(<ComposerHarness />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
    target: { value: 'Flying bird' },
  })
  await selectParameter('Format', 'JPEG')
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Output compression (0-100)' }),
    { target: { value: '0' } }
  )
  await selectParameter('Format', 'GIF')
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'GIF frames (2-16)' }),
    { target: { value: '2' } }
  )
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Frame duration (20-655350 ms)' }),
    { target: { value: '84' } }
  )
  await userEvent.click(screen.getByRole('button', { name: 'Generate 1' }))
  expect(
    (vi.mocked(api.post).mock.calls[0][1] as { params: object }).params
  ).toEqual({
    n: 1,
    response_format: 'url',
    output_format: 'gif',
    frame_count: 2,
    frame_duration_ms: 84,
  })
  await selectParameter('Format', 'JPEG')
  expect(
    screen.getByRole('spinbutton', { name: 'Output compression (0-100)' })
  ).toHaveValue(null)
  await userEvent.click(screen.getByRole('button', { name: 'Generate 1' }))
  expect(
    (vi.mocked(api.post).mock.calls[1][1] as { params: object }).params
  ).toEqual({ n: 1, response_format: 'url', output_format: 'jpeg' })
})

test('switching Zhiqi models clears unsupported GIF values and switching to ordinary preserves its legacy defaults', async () => {
  render(<ComposerHarness />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
    target: { value: 'Flying bird' },
  })
  await selectParameter('Format', 'GIF')
  await selectParameter('Quality', 'max')
  await selectModel('gpt-image-2.6', 'gpt-image-2.5')
  expect(
    screen.getByRole('button', { name: 'Format: Model default' })
  ).toBeVisible()
  await userEvent.click(
    screen.getByRole('button', { name: 'Format: Model default' })
  )
  expect(screen.queryByRole('option', { name: 'GIF' })).not.toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  await selectModel('gpt-image-2.5', 'ordinary-image')
  expect(
    screen.queryByRole('button', { name: /^Resolution:/ })
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('switch', { name: /Transparent background/ })
  ).not.toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: 'Generate 1' }))
  expect(
    (vi.mocked(api.post).mock.calls[0][1] as { params: object }).params
  ).toEqual({ n: 1, size: 'auto', quality: 'auto', output_format: 'png' })
})

test('old servers do not activate Zhiqi from the model name and keep ordinary request semantics', async () => {
  render(<ComposerHarness oldServer />)
  expect(
    screen.queryByRole('button', { name: /^Resolution:/ })
  ).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
    target: { value: 'A blue bird' },
  })
  await userEvent.click(
    screen.getByRole('switch', { name: /Transparent background/ })
  )
  await userEvent.click(screen.getByRole('button', { name: 'Generate 1' }))
  expect(
    (vi.mocked(api.post).mock.calls[0][1] as { params: object }).params
  ).toEqual({
    n: 1,
    size: 'auto',
    quality: 'auto',
    output_format: 'png',
    background: 'transparent',
  })
})

test('mixed channels keep ordinary controls and explain why exclusive parameters are unavailable', () => {
  render(<ComposerHarness initialModel='mixed-image' />)
  expect(
    screen.queryByRole('button', { name: /^Resolution:/ })
  ).not.toBeInTheDocument()
  expect(screen.getByText(/This model group mixes Zhiqi/)).toBeVisible()
})

test('a custom Zhiqi model exposes optional GIF and quality candidates without claiming support', async () => {
  render(<ComposerHarness initialModel='custom-image' />)
  await selectParameter('Quality', 'xhigh')
  await selectParameter('Format', 'GIF')
  expect(
    screen.getByRole('spinbutton', { name: 'GIF frames (2-16)' })
  ).toHaveValue(null)
  expect(screen.getByText(/Zhiqi options are suggestions/)).toBeVisible()
})

test('parameter chips open by keyboard and selecting model default omits explicit quality again', async () => {
  render(<ComposerHarness />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
    target: { value: 'A blue bird' },
  })
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'Quality: Model default' })
  trigger.focus()
  await user.keyboard('{Enter}')
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await user.click(await screen.findByRole('option', { name: 'high' }))
  await user.keyboard('{Escape}')
  await selectParameter('Quality', 'Model default')
  await user.click(screen.getByRole('button', { name: 'Generate 1' }))
  expect(
    (vi.mocked(api.post).mock.calls[0][1] as { params: object }).params
  ).toEqual({ n: 1, response_format: 'url' })
})

test('Zhiqi accepts 32000 code points but an ordinary selection keeps the 8000 limit', async () => {
  render(<ComposerHarness maxReferences={2} />)
  expect(screen.getByRole('button', { name: /Reference/ })).toHaveTextContent(
    '0/2'
  )
  const prompt = screen.getByRole('textbox', { name: 'Prompt' })
  fireEvent.change(prompt, { target: { value: 'a'.repeat(32000) } })
  expect(screen.getByRole('button', { name: 'Generate 1' })).toBeEnabled()
  fireEvent.change(prompt, { target: { value: 'a'.repeat(32001) } })
  expect(screen.getByRole('button', { name: 'Generate 1' })).toBeDisabled()
  await selectModel('gpt-image-2.6', 'ordinary-image')
  fireEvent.change(prompt, { target: { value: 'a'.repeat(8001) } })
  expect(screen.getByRole('button', { name: 'Generate 1' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Reset' }))
  await waitFor(() => expect(prompt).toHaveValue(''))
})
