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
import { CheckIcon, ChevronDownIcon, InfoIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { IMAGE_STUDIO_SIZE_RATIOS, IMAGE_STUDIO_SIZE_TIERS } from '../constants'
import {
  calculateImageSize,
  clampImageSize,
  findSizePreset,
  parseImageRatio,
  parseImageSize,
  type ImageStudioSizeTier,
} from '../lib/size'

type SizeMode = 'auto' | 'ratio' | 'custom'

const RATIO_VALUES = IMAGE_STUDIO_SIZE_RATIOS.map((ratio) => ratio.value)

export interface ImageStudioSizePickerProps {
  value: string
  disabled?: boolean
  onChange: (size: string) => void
}

/**
 * Size chip with a three-way picker.
 *
 * "Auto" omits the field so the model picks; "By ratio" derives concrete
 * pixels from a 1K/2K/4K base; "Custom size" takes exact width and height and
 * snaps them into the range providers accept. The pixel result is always shown
 * before it is applied, because "2K 16:9" is friendlier but not actionable.
 */
export function ImageStudioSizePicker(props: ImageStudioSizePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const preset = useMemo(
    () => findSizePreset(props.value, IMAGE_STUDIO_SIZE_TIERS, RATIO_VALUES),
    [props.value]
  )

  const isAuto = !props.value || props.value === 'auto'
  let valueLabel = props.value
  if (isAuto) {
    valueLabel = t('Auto')
  } else if (preset) {
    valueLabel = `${preset.tier} · ${preset.ratio}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type='button'
            disabled={props.disabled}
            aria-label={`${t('Size')}: ${valueLabel}`}
            className={cn(
              'border-border/70 hover:bg-accent flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px]',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <span className='text-muted-foreground'>{t('Size')}</span>
            <span className='font-medium'>{valueLabel}</span>
            <ChevronDownIcon
              className='text-muted-foreground size-3'
              aria-hidden='true'
            />
          </button>
        }
      />
      <PopoverContent className='w-80 p-3' align='start' sideOffset={6}>
        <SizePickerPanel
          value={props.value}
          onApply={(size) => {
            props.onChange(size)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

interface SizePickerPanelProps {
  value: string
  onApply: (size: string) => void
}

function SizePickerPanel(props: SizePickerPanelProps) {
  const { t } = useTranslation()
  const preset = useMemo(
    () => findSizePreset(props.value, IMAGE_STUDIO_SIZE_TIERS, RATIO_VALUES),
    [props.value]
  )
  const parsedSize = parseImageSize(props.value)

  const [mode, setMode] = useState<SizeMode>(() => {
    if (!props.value || props.value === 'auto') return 'auto'
    return preset ? 'ratio' : 'custom'
  })
  const [tier, setTier] = useState<ImageStudioSizeTier>(preset?.tier ?? '1K')
  const [ratio, setRatio] = useState(preset?.ratio ?? '1:1')
  const [customRatio, setCustomRatio] = useState(
    preset?.ratio && parseImageRatio(preset.ratio) ? preset.ratio : '16:9'
  )
  const [customWidth, setCustomWidth] = useState(
    String(parsedSize?.width ?? 1024)
  )
  const [customHeight, setCustomHeight] = useState(
    String(parsedSize?.height ?? 1024)
  )

  const activeRatio = ratio === 'custom' ? customRatio : ratio
  const customRatioValid =
    ratio !== 'custom' || Boolean(parseImageRatio(customRatio))

  const preview = useMemo(() => {
    if (mode === 'auto') return { size: 'auto', adjusted: false }
    if (mode === 'ratio') {
      if (!customRatioValid) return { size: '', adjusted: false }
      return {
        size: calculateImageSize(tier, activeRatio) ?? '',
        adjusted: false,
      }
    }
    const width = Number(customWidth)
    const height = Number(customHeight)
    const clamped = clampImageSize(width, height)
    return clamped
      ? { size: clamped.size, adjusted: clamped.adjusted }
      : { size: '', adjusted: false }
  }, [mode, tier, activeRatio, customRatioValid, customWidth, customHeight])

  const modeTab = (value: SizeMode, label: string) => (
    <button
      type='button'
      aria-pressed={mode === value}
      onClick={() => setMode(value)}
      className={cn(
        'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        mode === value
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </button>
  )

  const choiceClass = (active: boolean) =>
    cn(
      'rounded-md border px-2 py-1.5 text-[11px] transition-colors',
      'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
      active
        ? 'border-primary bg-primary/10 text-primary font-medium'
        : 'border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground'
    )

  return (
    <div className='flex flex-col gap-3'>
      <div className='bg-muted/60 flex rounded-lg p-1'>
        {modeTab('auto', t('Auto'))}
        {modeTab('ratio', t('By ratio'))}
        {modeTab('custom', t('Custom size'))}
      </div>

      <div className='min-h-40'>
        {mode === 'auto' && (
          <div className='flex h-40 flex-col items-center justify-center gap-1 px-4 text-center'>
            <p className='text-xs font-medium'>{t('Auto size')}</p>
            <p className='text-muted-foreground text-[11px] leading-relaxed'>
              {t(
                'The size is not sent to the model; it picks its own. This works with every model.'
              )}
            </p>
          </div>
        )}

        {mode === 'ratio' && (
          <div className='flex flex-col gap-3'>
            <section>
              <p className='text-muted-foreground mb-1.5 text-[11px] font-medium'>
                {t('Base resolution')}
              </p>
              <div className='grid grid-cols-3 gap-1.5'>
                {IMAGE_STUDIO_SIZE_TIERS.map((item) => (
                  <button
                    key={item}
                    type='button'
                    aria-pressed={tier === item}
                    className={choiceClass(tier === item)}
                    onClick={() => setTier(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className='text-muted-foreground mb-1.5 text-[11px] font-medium'>
                {t('Aspect ratio')}
              </p>
              <div className='grid grid-cols-2 gap-1.5'>
                {IMAGE_STUDIO_SIZE_RATIOS.map((item) => (
                  <button
                    key={item.value}
                    type='button'
                    aria-pressed={ratio === item.value}
                    className={choiceClass(ratio === item.value)}
                    onClick={() => setRatio(item.value)}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>
            </section>

            <label className='block'>
              <span className='text-muted-foreground mb-1.5 block text-[11px] font-medium'>
                {t('Custom ratio')}
              </span>
              <Input
                value={customRatio}
                inputMode='decimal'
                aria-invalid={!customRatioValid}
                onFocus={() => setRatio('custom')}
                onChange={(event) => {
                  setRatio('custom')
                  setCustomRatio(event.target.value)
                }}
                placeholder={t('e.g. 5:4 or 2.39:1')}
                className='h-7 text-xs'
              />
            </label>
          </div>
        )}

        {mode === 'custom' && (
          <div className='flex flex-col gap-3'>
            <div className='flex items-end gap-2'>
              <label className='flex-1'>
                <span className='text-muted-foreground mb-1.5 block text-[11px] font-medium'>
                  {t('Width')}
                </span>
                <Input
                  type='number'
                  min={256}
                  max={3840}
                  step={16}
                  value={customWidth}
                  onChange={(event) => setCustomWidth(event.target.value)}
                  className='h-7 text-xs'
                />
              </label>
              <span className='text-muted-foreground pb-2 text-xs'>×</span>
              <label className='flex-1'>
                <span className='text-muted-foreground mb-1.5 block text-[11px] font-medium'>
                  {t('Height')}
                </span>
                <Input
                  type='number'
                  min={256}
                  max={3840}
                  step={16}
                  value={customHeight}
                  onChange={(event) => setCustomHeight(event.target.value)}
                  className='h-7 text-xs'
                />
              </label>
            </div>
            <p className='text-muted-foreground flex items-start gap-1.5 text-[10px] leading-relaxed'>
              <InfoIcon className='mt-0.5 size-3 shrink-0' aria-hidden='true' />
              {t(
                'Width and height snap to multiples of 16. Longest side 3840, ratio up to 3:1, 0.65–8.29 megapixels.'
              )}
            </p>
          </div>
        )}
      </div>

      <div className='bg-muted/60 rounded-lg px-3 py-2'>
        <div className='flex items-center justify-between gap-2'>
          <span className='text-muted-foreground text-[11px]'>
            {t('Will use')}
          </span>
          {preview.adjusted && (
            <span className='bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium'>
              {t('Adjusted automatically')}
            </span>
          )}
        </div>
        <p className='mt-0.5 font-mono text-sm font-semibold'>
          {preview.size === 'auto'
            ? t('Model default')
            : preview.size || t('Invalid size')}
        </p>
      </div>

      <Button
        type='button'
        size='sm'
        disabled={!preview.size}
        onClick={() => props.onApply(preview.size)}
      >
        <CheckIcon aria-hidden='true' />
        {t('Use this size')}
      </Button>
    </div>
  )
}
