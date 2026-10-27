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
import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type ModelType = 'text' | 'image' | 'video'

type ModelTypeRow = {
  _id: string
  pattern: string
  modelType: ModelType
}

const MODEL_TYPES: ModelType[] = ['text', 'image', 'video']

const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  text: 'Text',
  image: 'Image',
  video: 'Video',
}

let rowIdCounter = 0
function nextRowId() {
  rowIdCounter += 1
  return `mt_${rowIdCounter}`
}

function isModelType(value: unknown): value is ModelType {
  return typeof value === 'string' && MODEL_TYPES.includes(value as ModelType)
}

function parseModelTypes(raw: string): ModelTypeRow[] {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return []
  }
  return Object.entries(parsed as Record<string, unknown>)
    .filter(([pattern]) => pattern.trim() !== '')
    .map(([pattern, modelType]) => ({
      _id: nextRowId(),
      pattern,
      modelType: isModelType(modelType) ? modelType : 'text',
    }))
}

// The backend replaces the whole map on save, so deleted rows disappear.
function serializeModelTypes(rows: ModelTypeRow[]): string {
  const result: Record<string, ModelType> = {}
  for (const row of rows) {
    const pattern = row.pattern.trim()
    if (!pattern) continue
    result[pattern] = row.modelType
  }
  return JSON.stringify(result, null, 2)
}

type ModelTypeSettingsCardProps = {
  defaultValue: string
}

export function ModelTypeSettingsCard(props: ModelTypeSettingsCardProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const [rows, setRows] = useState<ModelTypeRow[]>(() =>
    parseModelTypes(props.defaultValue)
  )
  const baseline = useMemo(
    () => serializeModelTypes(parseModelTypes(props.defaultValue)),
    [props.defaultValue]
  )

  useEffect(() => {
    setRows(parseModelTypes(props.defaultValue))
  }, [props.defaultValue])

  const updateRow = useCallback(
    (id: string, patch: Partial<Omit<ModelTypeRow, '_id'>>) => {
      setRows((current) =>
        current.map((row) => (row._id === id ? { ...row, ...patch } : row))
      )
    },
    []
  )

  const removeRow = useCallback((id: string) => {
    setRows((current) => current.filter((row) => row._id !== id))
  }, [])

  const addRow = useCallback(() => {
    setRows((current) => [
      ...current,
      { _id: nextRowId(), pattern: '', modelType: 'image' },
    ])
  }, [])

  const handleReset = useCallback(() => {
    setRows(parseModelTypes(props.defaultValue))
  }, [props.defaultValue])

  const handleSave = async () => {
    const serialized = serializeModelTypes(rows)
    if (serialized === baseline) {
      toast.info(t('No changes to save'))
      return
    }
    await updateOption.mutateAsync({
      key: 'global.model_types',
      value: serialized,
    })
  }

  return (
    <SettingsSection title={t('Model Types')}>
      <SettingsPageFormActions
        onSave={handleSave}
        onReset={handleReset}
        isSaving={updateOption.isPending}
      />
      <Card className='min-w-0 shadow-none'>
        <CardHeader className='gap-2 border-b'>
          <CardTitle>{t('Model Types')}</CardTitle>
          <CardDescription>
            {t(
              'Declare whether a model is text, image or video. Capability checks read this table before falling back to model name heuristics, so a custom name only needs one row here.'
            )}
          </CardDescription>
          <CardDescription>
            {t(
              'Wildcards: "*" matches any characters and matches are by containment, so "*-image" covers "gemini-3-pro-image-preview" and "nano-banana*" covers "nano-banana-pro". Matching ignores case. Exact names win over wildcards, and longer wildcards win over shorter ones.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              className='min-h-40'
              title={t('No model types configured yet.')}
            />
          ) : (
            <div className='space-y-2'>
              {rows.map((row) => (
                <div
                  key={row._id}
                  className='grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:border-0 sm:p-0'
                >
                  <Input
                    className='col-start-1 row-start-1 min-w-0'
                    value={row.pattern}
                    placeholder={t(
                      'Model name or wildcard, for example *-image'
                    )}
                    aria-label={t('Model name or wildcard')}
                    onChange={(event) =>
                      updateRow(row._id, { pattern: event.target.value })
                    }
                  />
                  <Select
                    value={row.modelType}
                    onValueChange={(value) => {
                      if (isModelType(value)) {
                        updateRow(row._id, { modelType: value })
                      }
                    }}
                  >
                    <SelectTrigger
                      className='col-start-1 row-start-2 w-full sm:col-start-2 sm:row-start-1'
                      aria-label={t('Model type')}
                    >
                      <SelectValue>
                        {t(MODEL_TYPE_LABELS[row.modelType])}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {MODEL_TYPES.map((modelType) => (
                          <SelectItem key={modelType} value={modelType}>
                            {t(MODEL_TYPE_LABELS[modelType])}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-destructive col-start-2 row-start-1 size-8 p-0 sm:col-start-3 sm:row-start-auto'
                    aria-label={t('Delete model type rule')}
                    onClick={() => removeRow(row._id)}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className='flex items-center justify-center pt-4'>
            <Button variant='outline' size='sm' onClick={addRow}>
              <Plus data-icon='inline-start' />
              {t('Add model type')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </SettingsSection>
  )
}
