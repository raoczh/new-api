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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

/**
 * Built per render so the validation message follows the active language.
 * The field shape stays flat (`Enabled`, not `image_studio.enabled`) because
 * react-hook-form treats dots in names as nested paths.
 */
function createImageStudioSchema(invalidAddress: string) {
  return z.object({
    Enabled: z.boolean(),
    ImageConcurrency: z.number().int().min(1).max(128),
    VideoConcurrency: z.number().int().min(1).max(128),
    RetentionDays: z.number().int().min(1).max(365),
    QueueMaxWaitMinutes: z.number().int().min(1).max(10080),
    MaxImagesPerRequest: z.number().int().min(1).max(16),
    MaxReferenceImages: z.number().int().min(1).max(16),
    UploadMaxMB: z.number().int().min(1).max(200),
    StorageDir: z.string(),
    PublicBaseURL: z
      .string()
      .refine(
        (value) => value === '' || /^https?:\/\/[^\s]+$/i.test(value.trim()),
        invalidAddress
      ),
    /** Newline or comma separated; converted to the stored JSON array. */
    ImageModels: z.string(),
  })
}

type ImageStudioFormValues = z.infer<
  ReturnType<typeof createImageStudioSchema>
>

export type ImageStudioDefaults = {
  Enabled: boolean
  ImageConcurrency: number
  VideoConcurrency: number
  RetentionDays: number
  QueueMaxWaitMinutes: number
  MaxImagesPerRequest: number
  MaxReferenceImages: number
  UploadMaxMB: number
  StorageDir: string
  PublicBaseURL: string
  ImageModels: string[]
}

type ImageStudioSettingsSectionProps = {
  defaultValues: ImageStudioDefaults
}

/** Option keys owned by the `image_studio` config group. */
const OPTION_KEYS = {
  Enabled: 'image_studio.enabled',
  ImageConcurrency: 'image_studio.image_concurrency',
  VideoConcurrency: 'image_studio.video_concurrency',
  RetentionDays: 'image_studio.retention_days',
  QueueMaxWaitMinutes: 'image_studio.queue_max_wait_minutes',
  MaxImagesPerRequest: 'image_studio.max_images_per_request',
  MaxReferenceImages: 'image_studio.max_reference_images',
  UploadMaxMB: 'image_studio.upload_max_mb',
  StorageDir: 'image_studio.storage_dir',
  PublicBaseURL: 'image_studio.public_base_url',
  ImageModels: 'image_studio.image_models',
} as const

/** "a, b" / newline separated → trimmed, de-duplicated list. */
function parseModelList(value: string): string[] {
  const seen = new Set<string>()
  const models: string[] = []
  for (const raw of value.split(/[\n,]/)) {
    const name = raw.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    models.push(name)
  }
  return models
}

export function ImageStudioSettingsSection(props: ImageStudioSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const formDefaults: ImageStudioFormValues = {
    ...props.defaultValues,
    ImageModels: props.defaultValues.ImageModels.join('\n'),
  }

  const schema = useMemo(
    () =>
      createImageStudioSchema(
        t('Enter an http:// or https:// address, or leave this empty.')
      ),
    [t]
  )

  const form = useForm<ImageStudioFormValues>({
    resolver: zodResolver(schema),
    defaultValues: formDefaults,
  })

  useEffect(() => {
    form.reset(formDefaults)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.defaultValues, form])

  const onSubmit = async (values: ImageStudioFormValues) => {
    // The server stores `image_models` as a JSON array; anything else is
    // silently ignored by the config loader, so serialise before sending.
    const stored: Record<keyof ImageStudioFormValues, string | boolean | number> =
      {
        ...props.defaultValues,
        ...values,
        ImageModels: JSON.stringify(parseModelList(values.ImageModels)),
      }
    const original: Record<
      keyof ImageStudioFormValues,
      string | boolean | number
    > = {
      ...props.defaultValues,
      ImageModels: JSON.stringify(props.defaultValues.ImageModels),
    }

    for (const [field, key] of Object.entries(OPTION_KEYS) as Array<
      [keyof ImageStudioFormValues, string]
    >) {
      if (stored[field] === original[field]) continue
      await updateOption.mutateAsync({ key, value: stored[field] })
    }
  }

  const isEnabled = form.watch('Enabled')

  const numberField = (
    name: Exclude<
      keyof ImageStudioFormValues,
      'Enabled' | 'StorageDir' | 'PublicBaseURL' | 'ImageModels'
    >,
    label: string,
    description: string,
    min: number,
    max: number
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type='number'
              min={min}
              max={max}
              step={1}
              {...safeNumberFieldProps(field)}
              disabled={!isEnabled}
            />
          </FormControl>
          <FormDescription>{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <SettingsSection title={t('AI Image Workbench')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save image workbench settings'
          />

          <FormField
            control={form.control}
            name='Enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable the AI image workbench')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Turns the drawing page on or off for every user. Records already generated stay readable until they expire.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <div className='grid gap-6 sm:grid-cols-2'>
            {numberField(
              'ImageConcurrency',
              t('Concurrent image jobs'),
              t(
                'How many image generations may run at the same time across the whole site. Extra submissions wait in the queue and start automatically.'
              ),
              1,
              128
            )}
            {numberField(
              'VideoConcurrency',
              t('Concurrent video jobs'),
              t(
                'The same limit for video generations. Video jobs are heavier, so keep this lower than the image limit.'
              ),
              1,
              128
            )}
            {numberField(
              'RetentionDays',
              t('Keep records for (days)'),
              t(
                'Records and image files are deleted after this many days. Favorites do not extend the period.'
              ),
              1,
              365
            )}
            {numberField(
              'QueueMaxWaitMinutes',
              t('Maximum queue wait (minutes)'),
              t(
                'A task that never gets a free slot within this time fails with a clear message instead of waiting forever.'
              ),
              1,
              10080
            )}
            {numberField(
              'MaxImagesPerRequest',
              t('Maximum images per request'),
              t('Upper bound for the quantity selector on the drawing page.'),
              1,
              16
            )}
            {numberField(
              'MaxReferenceImages',
              t('Maximum reference images'),
              t(
                'How many reference images a user may attach to one prompt. Users can still remove them, so keep this at least 1.'
              ),
              1,
              16
            )}
            {numberField(
              'UploadMaxMB',
              t('Upload size limit (MB)'),
              t('Largest reference image or mask a user may upload.'),
              1,
              200
            )}
          </div>

          <div className='grid gap-6 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='StorageDir'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Storage directory')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete='off'
                      placeholder='data/image-studio'
                      disabled={!isEnabled}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Local folder for reference images and results. It must be writable by the server process.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='PublicBaseURL'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Public image address')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete='off'
                      placeholder='https://img.example.com'
                      disabled={!isEnabled}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Static site mapped to the storage directory by nginx. Leave empty to serve files through the API instead.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='ImageModels'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Image models')}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder={'gpt-image-1\nflux.1-schnell'}
                    disabled={!isEnabled}
                    className='font-mono text-xs'
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'One model per line. The drawing page only offers these models. Vendor prefixes are ignored, so “openai/gpt-image-1” and “gpt-image-1” both match. Leave empty to fall back to automatic detection.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
