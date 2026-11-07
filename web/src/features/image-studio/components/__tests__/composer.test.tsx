import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'
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

// Old API responses may still include provider flags. They must not affect UI.
const legacyModels = [
  { model: 'gpt-image-2.6', quota_type: 1, price: 0, zhiqi_engine: true },
  { model: 'gpt-image-2.5', quota_type: 1, price: 0, zhiqi_engine: true },
  { model: 'ordinary-image', quota_type: 1, price: 0 },
  { model: 'mixed-image', quota_type: 1, price: 0, zhiqi_mixed_channels: true },
]
const groups: ImageStudioGroupOption[] = [
  { group: 'default', desc: '', ratio: 1, models: legacyModels },
]

function ComposerHarness(props: {
  initialModel?: string
  maxReferences?: number
  referenceUrls?: string[]
}) {
  const [model, setModel] = useState(props.initialModel ?? 'gpt-image-2.6')
  const draft = useImageStudioDraft({
    maxReferences: props.maxReferences ?? 20,
    uploadMaxMB: 10,
  })
  return (
    <>
      <button
        type='button'
        onClick={() =>
          draft.applyPreset({
            prompt: 'Edit the references',
            referenceUrls: props.referenceUrls,
          })
        }
      >
        Load references
      </button>
      <ImageStudioComposer
        config={{ ...config, max_reference_images: props.maxReferences ?? 20 }}
        groups={groups}
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
    </>
  )
}

// The API docs read the gateway address from the shared status query.
function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
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

async function selectModel(next: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Select model' }))
  await user.click(
    await screen.findByRole('option', { name: new RegExp(`^${next}`) })
  )
}

test('the composer documentation entry opens by keyboard and Escape restores focus without submitting', async () => {
  const user = userEvent.setup()
  renderWithQuery(<ComposerHarness />)
  const trigger = screen.getByRole('button', { name: 'Image API docs' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  trigger.focus()
  await user.keyboard('{Enter}')
  expect(
    await screen.findByRole('dialog', { name: 'Image API docs' })
  ).toBeVisible()
  expect(
    await screen.findByRole('heading', { name: 'Generate images' })
  ).toBeVisible()
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  expect(trigger).toHaveFocus()
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(api.post).not.toHaveBeenCalled()
  await user.keyboard('{Enter}')
  await user.click(await screen.findByRole('button', { name: 'Close' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  expect(trigger).toHaveFocus()
})

const ORDINARY_QUALITIES = ['Auto', 'Low quality', 'Medium quality', 'High']
const ORDINARY_FORMATS = ['PNG', 'JPEG', 'WebP']

test.each([
  {
    model: 'gpt-image-2.6',
    qualities: [...ORDINARY_QUALITIES, 'Extra high', 'Maximum'],
    formats: [...ORDINARY_FORMATS, 'SVG', 'GIF'],
  },
  {
    model: 'gpt-image-2.5',
    qualities: [...ORDINARY_QUALITIES, 'Extra high', 'Maximum'],
    formats: [...ORDINARY_FORMATS, 'SVG'],
  },
  {
    model: 'ordinary-image',
    qualities: ORDINARY_QUALITIES,
    formats: ORDINARY_FORMATS,
  },
])(
  '$model offers its model options and submits count and transparency unchanged',
  async ({ model, qualities, formats }) => {
    const user = userEvent.setup()
    renderWithQuery(<ComposerHarness initialModel={model} />)
    expect(screen.getByRole('button', { name: /Reference/ })).toHaveTextContent(
      '0/20'
    )
    expect(
      screen.queryByRole('button', { name: /^Resolution:/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        /Available channels for this model have different capabilities/
      )
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quality: Auto' }))
    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual(qualities)
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Format: PNG' }))
    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual(formats)
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Count: 1' }))
    expect(screen.getAllByRole('option')).toHaveLength(4)
    await user.keyboard('{Escape}')
    await selectParameter('Count', '3 images')
    await selectParameter('Quality', 'High')
    await selectParameter('Format', 'WebP')
    await user.click(
      screen.getByRole('switch', { name: /Transparent background/ })
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
      target: { value: 'A blue bird' },
    })
    await user.click(screen.getByRole('button', { name: 'Generate 3' }))
    expect(api.post).toHaveBeenCalledWith('/api/image-studio/tasks', {
      model,
      group: 'default',
      prompt: 'A blue bird',
      params: {
        n: 3,
        size: 'auto',
        quality: 'high',
        output_format: 'webp',
        background: 'transparent',
      },
      reference_keys: [],
      mask_key: '',
    })
  }
)

test('GIF on gpt-image-2.6 submits frame settings and falls back to PNG on a model without GIF', async () => {
  const user = userEvent.setup()
  renderWithQuery(<ComposerHarness initialModel='gpt-image-2.6' />)
  expect(
    screen.queryByRole('button', { name: /^Frames:/ })
  ).not.toBeInTheDocument()
  await selectParameter('Format', 'GIF')
  await selectParameter('Quality', 'Maximum')
  await selectParameter('Frames', '8')
  await selectParameter('Frame duration', '100 ms')
  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
    target: { value: 'A bird flapping its wings' },
  })
  await user.click(screen.getByRole('button', { name: 'Generate 1' }))
  expect(vi.mocked(api.post).mock.calls[0]?.[1]).toMatchObject({
    params: {
      quality: 'max',
      output_format: 'gif',
      frame_count: 8,
      frame_duration_ms: 100,
    },
  })

  await selectModel('ordinary-image')
  expect(screen.getByRole('button', { name: 'Format: PNG' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Quality: Auto' })).toBeVisible()
  expect(
    screen.queryByRole('button', { name: /^Frames:/ })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Generate 1' }))
  const params = vi.mocked(api.post).mock.calls[1]?.[1] as {
    params: Record<string, unknown>
  }
  expect(params.params).toEqual({
    n: 1,
    size: 'auto',
    quality: 'auto',
    output_format: 'png',
  })
})

test('the ordinary size picker submits concrete pixels and model changes preserve all selected parameters', async () => {
  const user = userEvent.setup()
  renderWithQuery(<ComposerHarness initialModel='ordinary-image' />)
  await user.click(screen.getByRole('button', { name: 'Size: Auto' }))
  await user.click(screen.getByRole('button', { name: 'By ratio' }))
  await user.click(screen.getByRole('button', { name: '2K' }))
  await user.click(screen.getByRole('button', { name: 'Wide 16:9' }))
  expect(screen.getByText('2048x1152')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Use this size' }))
  await selectParameter('Count', '3 images')
  await selectParameter('Quality', 'Medium quality')
  await selectParameter('Format', 'JPEG')
  await user.click(
    screen.getByRole('switch', { name: /Transparent background/ })
  )
  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
    target: { value: 'A lighthouse' },
  })
  await selectModel('gpt-image-2.6')
  await selectModel('gpt-image-2.5')
  await selectModel('mixed-image')
  expect(screen.getByRole('button', { name: 'Count: 3' })).toBeEnabled()
  expect(
    screen.getByRole('switch', { name: /Transparent background/ })
  ).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Generate 3' }))
  expect(vi.mocked(api.post).mock.calls[0]?.[1]).toMatchObject({
    model: 'mixed-image',
    params: {
      n: 3,
      size: '2048x1152',
      quality: 'medium',
      output_format: 'jpeg',
      background: 'transparent',
    },
  })
})

test('keyboard parameter selection keeps Auto and prompt limits do not change with legacy flags', async () => {
  const user = userEvent.setup()
  renderWithQuery(<ComposerHarness maxReferences={2} />)
  const trigger = screen.getByRole('button', { name: 'Quality: Auto' })
  trigger.focus()
  await user.keyboard('{Enter}')
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await user.click(await screen.findByRole('option', { name: 'High' }))
  await user.keyboard('{Escape}')
  await selectParameter('Quality', 'Auto')
  const prompt = screen.getByRole('textbox', { name: 'Prompt' })
  expect(prompt).toHaveAttribute('maxLength', '8200')
  expect(screen.getByRole('button', { name: /Reference/ })).toHaveTextContent(
    '0/2'
  )
  fireEvent.change(prompt, { target: { value: 'a'.repeat(8000) } })
  expect(screen.getByRole('button', { name: 'Generate 1' })).toBeEnabled()
  fireEvent.change(prompt, { target: { value: 'a'.repeat(8001) } })
  expect(prompt).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByRole('button', { name: 'Generate 1' })).toBeDisabled()
  await selectModel('ordinary-image')
  expect(screen.getByRole('button', { name: 'Generate 1' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Reset' }))
  expect(prompt).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Quality: Auto' })).toBeVisible()
})

test('unavailable reused references block ordinary submission until removed and retain the remaining order', async () => {
  const user = userEvent.setup()
  render(
    <ComposerHarness
      initialModel='ordinary-image'
      referenceUrls={[
        '/api/image-studio/files/first.png',
        'https://unavailable.example/no-key.png',
        '/api/image-studio/files/last.png',
      ]}
    />
  )
  await user.click(screen.getByRole('button', { name: 'Load references' }))
  expect(screen.getByRole('button', { name: 'Generate 1' })).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent(
    /Remove failed or unavailable references/
  )
  await user.click(
    screen.getAllByRole('button', { name: 'Remove reference image' })[1]
  )
  await user.click(screen.getAllByRole('button', { name: 'Move left' })[1])
  await user.click(screen.getByRole('button', { name: 'Generate 1' }))
  expect(vi.mocked(api.post).mock.calls[0]?.[1]).toMatchObject({
    reference_keys: ['last.png', 'first.png'],
  })
})

test('failed uploads cannot silently turn an ordinary edit into text-to-image', async () => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed-image')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Upload unavailable'))
  const { container } = render(
    <ComposerHarness initialModel='ordinary-image' />
  )
  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
    target: { value: 'Edit this image' },
  })
  const input = container.querySelector('input[type="file"]')
  expect(input).toBeInstanceOf(HTMLInputElement)
  fireEvent.change(input as HTMLInputElement, {
    target: {
      files: [new File(['image'], 'image.png', { type: 'image/png' })],
    },
  })
  expect(await screen.findByText('Upload unavailable')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Generate 1' })).toBeDisabled()
  await userEvent.click(
    screen.getByRole('button', { name: 'Remove reference image' })
  )
  expect(screen.getByRole('button', { name: 'Generate 1' })).toBeEnabled()
})
