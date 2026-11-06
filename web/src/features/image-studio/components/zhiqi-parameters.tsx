import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'

import type { ImageStudioParamDraft } from '../lib/params'
import {
  getZhiqiInvalidFields,
  getZhiqiParameterSuggestions,
  ZHIQI_ASPECT_RATIOS,
  ZHIQI_RESOLUTIONS,
} from '../lib/zhiqi'
import { ParameterChip } from './parameter-row'

export function ImageStudioZhiqiParameters(props: {
  draft: ImageStudioParamDraft
  model: string
  disabled?: boolean
  onChange: (patch: Partial<ImageStudioParamDraft>) => void
}) {
  const { t } = useTranslation()
  const suggestions = getZhiqiParameterSuggestions(props.model)
  const invalidFields = getZhiqiInvalidFields(props.draft, props.model)
  const defaultLabel = t('Model default')
  const exactSize = props.draft.sizeMode === 'exact'
  const modeChoices = [
    { label: t('Resolution and aspect ratio'), value: 'resolution' },
    { label: t('Exact size or auto'), value: 'exact' },
  ]

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-muted-foreground text-xs leading-relaxed'>
        {t(
          'Zhiqi options are suggestions, not guaranteed capabilities. Available values and defaults depend on the channel.'
        )}
      </p>
      <div className='flex flex-wrap items-center gap-1.5'>
        <ParameterChip
          label={t('Size mode')}
          value={
            exactSize
              ? t('Exact size or auto')
              : t('Resolution and aspect ratio')
          }
          selectedValue={exactSize ? 'exact' : 'resolution'}
          options={modeChoices}
          disabled={props.disabled}
          onSelect={(value) =>
            props.onChange({
              sizeMode: value === 'exact' ? 'exact' : 'resolution',
            })
          }
        />
        {!exactSize && (
          <>
            <ParameterChip
              label={t('Resolution')}
              value={props.draft.resolution || defaultLabel}
              selectedValue={props.draft.resolution || ''}
              options={ZHIQI_RESOLUTIONS.map((value) => ({
                label: value || defaultLabel,
                value,
              }))}
              disabled={props.disabled}
              onSelect={(resolution) => props.onChange({ resolution })}
            />
            <ParameterChip
              label={t('Aspect ratio')}
              value={props.draft.aspectRatio || defaultLabel}
              selectedValue={props.draft.aspectRatio || ''}
              options={ZHIQI_ASPECT_RATIOS.map((value) => ({
                label: value || defaultLabel,
                value,
              }))}
              disabled={props.disabled}
              onSelect={(aspectRatio) => props.onChange({ aspectRatio })}
            />
          </>
        )}
        <ParameterChip
          label={t('Quality')}
          value={props.draft.quality || defaultLabel}
          selectedValue={props.draft.quality}
          options={suggestions.qualities.map((value) => ({
            label: value || defaultLabel,
            value,
          }))}
          disabled={props.disabled}
          onSelect={(quality) => props.onChange({ quality })}
        />
        <ParameterChip
          label={t('Format')}
          value={props.draft.outputFormat.toUpperCase() || defaultLabel}
          selectedValue={props.draft.outputFormat}
          options={suggestions.formats.map((value) => ({
            label: value.toUpperCase() || defaultLabel,
            value,
          }))}
          disabled={props.disabled}
          onSelect={(outputFormat) => props.onChange({ outputFormat })}
        />
        <ParameterChip
          label={t('Count')}
          value='1'
          options={[{ label: '1', value: '1' }]}
          disabled
          onSelect={() => {}}
        />
      </div>
      {exactSize && (
        <label className='flex flex-col gap-1 text-xs'>
          <span>{t('Exact size or auto')}</span>
          <Input
            value={props.draft.size}
            placeholder={t(
              'Leave empty, enter auto, or use widthxheight (e.g. 1024x1024)'
            )}
            disabled={props.disabled}
            aria-invalid={invalidFields.has('size')}
            onChange={(event) => props.onChange({ size: event.target.value })}
          />
        </label>
      )}
      {(props.draft.outputFormat === 'jpeg' ||
        props.draft.outputFormat === 'webp') && (
        <label className='flex flex-col gap-1 text-xs'>
          <span>{t('Output compression (0-100)')}</span>
          <Input
            type='number'
            min={0}
            max={100}
            step={1}
            value={props.draft.outputCompression ?? ''}
            placeholder={defaultLabel}
            disabled={props.disabled}
            aria-invalid={invalidFields.has('outputCompression')}
            onChange={(event) =>
              props.onChange({
                outputCompression:
                  event.target.value === ''
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </label>
      )}
      {props.draft.outputFormat === 'gif' && (
        <div className='grid grid-cols-2 gap-2'>
          <label className='flex flex-col gap-1 text-xs'>
            <span>{t('GIF frames (2-16)')}</span>
            <Input
              type='number'
              min={2}
              max={16}
              step={1}
              value={props.draft.frameCount ?? ''}
              placeholder={defaultLabel}
              disabled={props.disabled}
              aria-invalid={invalidFields.has('frameCount')}
              onChange={(event) =>
                props.onChange({
                  frameCount:
                    event.target.value === ''
                      ? undefined
                      : Number(event.target.value),
                })
              }
            />
          </label>
          <label className='flex flex-col gap-1 text-xs'>
            <span>{t('Frame duration (20-655350 ms)')}</span>
            <Input
              type='number'
              min={20}
              max={655350}
              step={1}
              value={props.draft.frameDurationMs ?? ''}
              placeholder={defaultLabel}
              disabled={props.disabled}
              aria-invalid={invalidFields.has('frameDurationMs')}
              onChange={(event) =>
                props.onChange({
                  frameDurationMs:
                    event.target.value === ''
                      ? undefined
                      : Number(event.target.value),
                })
              }
            />
          </label>
          <p className='text-muted-foreground col-span-2 text-xs'>
            {t(
              'GIF requires channel support. Frame duration is rounded by the provider; size and quality may not affect the animation.'
            )}
          </p>
        </div>
      )}
      {invalidFields.size > 0 && (
        <p role='alert' className='text-destructive text-xs'>
          {t(
            'Check image parameters: use a listed option, valid integer ranges, and an exact size no larger than 4096 pixels per side.'
          )}
        </p>
      )}
    </div>
  )
}
