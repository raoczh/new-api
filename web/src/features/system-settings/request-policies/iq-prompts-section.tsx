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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TagInput } from '@/components/tag-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  IQ_PROMPT_POOL_MAX_SIZE,
  IQ_PROMPT_TEMPLATE_MAX_LENGTH,
  parseIQPromptConfig,
  serializeIQPromptConfig,
  validateIQPromptConfig,
  type IQPromptConfig,
  type IQPromptPool,
} from './iq-prompts'

export const IQ_PROMPT_OPTION_KEY = 'iq_monitor_setting.prompt'

const PLACEHOLDERS = ['{{animal}}', '{{scene}}', '{{style}}', '{{code}}']

const POOL_FIELDS: { pool: IQPromptPool; labelKey: string }[] = [
  { pool: 'animals', labelKey: 'Animals' },
  { pool: 'scenes', labelKey: 'Scenes' },
  { pool: 'styles', labelKey: 'Art styles' },
]

type IQPromptsSectionProps = {
  value: string
}

export function IQPromptsSection(props: IQPromptsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const saved = useMemo(() => parseIQPromptConfig(props.value), [props.value])
  const [config, setConfig] = useState<IQPromptConfig>(saved)

  useEffect(() => {
    setConfig(saved)
  }, [saved])

  const dirty =
    serializeIQPromptConfig(config) !== serializeIQPromptConfig(saved)
  const error = validateIQPromptConfig(config)

  const save = async () => {
    try {
      await updateOption.mutateAsync({
        key: IQ_PROMPT_OPTION_KEY,
        value: serializeIQPromptConfig(config),
      })
    } catch {
      // useUpdateOption already reports the server error.
    }
  }

  return (
    <SettingsSection title={t('IQ probe prompts')}>
      <SettingsPageFormActions
        onSave={save}
        onReset={() => setConfig(saved)}
        isResetDisabled={!dirty}
        isSaving={updateOption.isPending}
        isSaveDisabled={!dirty || error !== null}
        resetLabel={t('Discard changes')}
      />
      <p className='text-muted-foreground text-sm'>
        {t(
          'Every probe draws a random animal, scene and art style, and adds a one-time verification code. A page without the code is judged invalid.'
        )}
      </p>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='iq-prompt-template'>{t('Prompt template')}</Label>
        <Textarea
          id='iq-prompt-template'
          rows={6}
          value={config.template}
          maxLength={IQ_PROMPT_TEMPLATE_MAX_LENGTH}
          aria-invalid={error !== null}
          aria-describedby='iq-prompt-template-hint'
          onChange={(event) =>
            setConfig({ ...config, template: event.target.value })
          }
        />
        <div
          id='iq-prompt-template-hint'
          className='text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs'
        >
          <span>{t('Placeholders')}</span>
          {PLACEHOLDERS.map((placeholder) => (
            <code
              key={placeholder}
              className='bg-muted rounded px-1.5 py-0.5 font-mono'
            >
              {placeholder}
            </code>
          ))}
          <span className='ms-auto tabular-nums'>
            {config.template.length} / {IQ_PROMPT_TEMPLATE_MAX_LENGTH}
          </span>
        </div>
      </div>
      {POOL_FIELDS.map((field) => (
        <div key={field.pool} className='flex flex-col gap-2'>
          <Label htmlFor={`iq-prompt-${field.pool}`}>
            {t(field.labelKey)}
            <span className='text-muted-foreground font-normal tabular-nums'>
              {config[field.pool].length} / {IQ_PROMPT_POOL_MAX_SIZE}
            </span>
          </Label>
          <TagInput
            id={`iq-prompt-${field.pool}`}
            value={config[field.pool]}
            onChange={(words) => setConfig({ ...config, [field.pool]: words })}
            placeholder={t('Enter a value and press Enter')}
          />
        </div>
      ))}
      {error && (
        <p className='text-destructive text-sm' role='alert'>
          {t(error.key, error.values)}
        </p>
      )}
    </SettingsSection>
  )
}
