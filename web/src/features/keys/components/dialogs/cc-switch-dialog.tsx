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
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { getUserModels } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import { CC_SWITCH_DOWNLOAD_URL } from '../../constants'
import { usePrimaryApiAddress } from '../../hooks/use-api-addresses'

const PRIMARY_MODEL_FIELD = {
  key: 'model',
  labelKey: 'Primary Model',
  required: true,
} as const

const CLAUDE_MODEL_FIELDS = [
  PRIMARY_MODEL_FIELD,
  { key: 'haikuModel', labelKey: 'Haiku Model', required: false },
  { key: 'sonnetModel', labelKey: 'Sonnet Model', required: false },
  { key: 'opusModel', labelKey: 'Opus Model', required: false },
] as const

// `deeplinkApp` is the CC Switch provider deeplink `app` value; null means
// CC Switch rejects provider deeplinks for that app. `openAIPath` apps talk
// to the OpenAI-compatible route, so their endpoint needs the /v1 suffix.
const APP_CONFIGS = {
  claude: {
    label: 'Claude Code',
    deeplinkApp: 'claude',
    openAIPath: false,
    modelFields: CLAUDE_MODEL_FIELDS,
  },
  'claude-desktop': {
    label: 'Claude Desktop',
    deeplinkApp: null,
    openAIPath: false,
    modelFields: CLAUDE_MODEL_FIELDS,
  },
  codex: {
    label: 'Codex',
    deeplinkApp: 'codex',
    openAIPath: true,
    modelFields: [PRIMARY_MODEL_FIELD],
  },
  gemini: {
    label: 'Gemini',
    deeplinkApp: 'gemini',
    openAIPath: false,
    modelFields: [PRIMARY_MODEL_FIELD],
  },
  grokbuild: {
    label: 'Grok Build',
    deeplinkApp: 'grokbuild',
    openAIPath: true,
    modelFields: [PRIMARY_MODEL_FIELD],
  },
  opencode: {
    label: 'OpenCode',
    deeplinkApp: 'opencode',
    openAIPath: true,
    modelFields: [PRIMARY_MODEL_FIELD],
  },
  openclaw: {
    label: 'OpenClaw',
    deeplinkApp: 'openclaw',
    openAIPath: true,
    modelFields: [PRIMARY_MODEL_FIELD],
  },
  hermes: {
    label: 'Hermes',
    deeplinkApp: 'hermes',
    openAIPath: true,
    modelFields: [PRIMARY_MODEL_FIELD],
  },
  pi: {
    label: 'Pi',
    deeplinkApp: null,
    openAIPath: true,
    modelFields: [PRIMARY_MODEL_FIELD],
  },
} as const

type AppType = keyof typeof APP_CONFIGS

const APP_ENTRIES = Object.entries(APP_CONFIGS) as [
  AppType,
  (typeof APP_CONFIGS)[AppType],
][]

function getDefaultName(app: AppType): string {
  return `My ${APP_CONFIGS[app].label}`
}

function buildCCSwitchURL(
  deeplinkApp: string,
  endpoint: string,
  name: string,
  serverAddress: string,
  models: Record<string, string>,
  apiKey: string
): string {
  const params = new URLSearchParams()
  params.set('resource', 'provider')
  params.set('app', deeplinkApp)
  params.set('name', name)
  params.set('endpoint', endpoint)
  params.set('apiKey', apiKey)
  for (const [k, v] of Object.entries(models)) {
    if (v) params.set(k, v)
  }
  params.set('homepage', serverAddress)
  params.set('enabled', 'true')
  return `ccswitch://v1/import?${params.toString()}`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokenKey: string
}

export function CCSwitchDialog(props: Props) {
  const { t } = useTranslation()
  const [app, setApp] = useState<AppType>('claude')
  const [name, setName] = useState<string>(getDefaultName('claude'))
  const [models, setModels] = useState<Record<string, string>>({})
  // Same resolution the API address list uses, so the imported endpoint is
  // never a different address than the one shown next to the key.
  const { address: serverAddress } = usePrimaryApiAddress()

  const { data: modelsData } = useQuery({
    queryKey: ['user-models-ccswitch'],
    queryFn: async () => requireServerSuccess(await getUserModels()),
    enabled: props.open,
    staleTime: 5 * 60 * 1000,
  })

  const modelOptions = useMemo(() => {
    const items = modelsData?.data ?? []
    return items.map((m) => ({ value: m, label: m }))
  }, [modelsData?.data])

  useEffect(() => {
    if (props.open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModels({})

      setApp('claude')

      setName(getDefaultName('claude'))
    }
  }, [props.open])

  const currentConfig = APP_CONFIGS[app]
  const importSupported = currentConfig.deeplinkApp !== null

  // Model choices carry over between apps; only the provider name follows
  // the selected app.
  const handleAppChange = (val: unknown) => {
    const appVal = val as AppType
    setApp(appVal)
    setName(getDefaultName(appVal))
  }

  const handleSubmit = () => {
    if (!currentConfig.deeplinkApp) return
    if (!models.model) {
      toast.warning(t('Please select a primary model'))
      return
    }
    const key = props.tokenKey.startsWith('sk-')
      ? props.tokenKey
      : `sk-${props.tokenKey}`
    const endpoint = currentConfig.openAIPath
      ? `${serverAddress}/v1`
      : serverAddress
    const fieldKeys = new Set<string>(
      currentConfig.modelFields.map((field) => field.key)
    )
    const appModels = Object.fromEntries(
      Object.entries(models).filter(([k]) => fieldKeys.has(k))
    )
    const url = buildCCSwitchURL(
      currentConfig.deeplinkApp,
      endpoint,
      name,
      serverAddress,
      appModels,
      key
    )
    window.open(url, '_blank')
    props.onOpenChange(false)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Import to CC Switch')}
      contentClassName='sm:max-w-xl'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            role='link'
            variant='outline'
            render={
              <a
                href={CC_SWITCH_DOWNLOAD_URL}
                target='_blank'
                rel='noopener noreferrer'
              />
            }
          >
            <Download data-icon='inline-start' aria-hidden='true' />
            {t('Download CC Switch')}
          </Button>
          <Button onClick={handleSubmit} disabled={!importSupported}>
            {t('Open CC Switch')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label id='cc-switch-app-label'>{t('Application')}</Label>
          <RadioGroup
            value={app}
            onValueChange={handleAppChange}
            aria-labelledby='cc-switch-app-label'
            className='grid grid-cols-2 gap-2 sm:grid-cols-3'
          >
            {APP_ENTRIES.map(([key, cfg]) => (
              <FieldLabel
                key={key}
                htmlFor={`app-${key}`}
                className='cursor-pointer'
              >
                <Field orientation='horizontal' className='px-3 py-2'>
                  <RadioGroupItem value={key} id={`app-${key}`} />
                  <span className='truncate text-sm'>{cfg.label}</span>
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
          {!importSupported && (
            <p className='text-muted-foreground text-xs' role='status'>
              {t(
                'CC Switch does not support link import for this app yet. Add the provider manually in CC Switch.'
              )}
            </p>
          )}
        </div>

        <div className='space-y-2'>
          <Label htmlFor='cc-switch-name'>{t('Name')}</Label>
          <Input
            id='cc-switch-name'
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={getDefaultName(app)}
          />
        </div>

        {currentConfig.modelFields.map((field) => (
          <div key={field.key} className='space-y-2'>
            <Label htmlFor={`cc-switch-${field.key}`} required={field.required}>
              {t(field.labelKey)}
            </Label>
            <Combobox
              id={`cc-switch-${field.key}`}
              aria-label={t(field.labelKey)}
              options={modelOptions}
              value={models[field.key] || ''}
              onValueChange={(v) =>
                setModels((prev) => ({ ...prev, [field.key]: v ?? '' }))
              }
              placeholder={t('Select or enter model name')}
              emptyText={t('No models found')}
            />
          </div>
        ))}
      </div>
    </Dialog>
  )
}
