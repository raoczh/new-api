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
import { safeJsonParse } from '../utils/json-parser'

/** Limits mirror setting/operation_setting/iq_monitor_setting.go. */
export const IQ_PROMPT_TEMPLATE_MAX_LENGTH = 4000
export const IQ_PROMPT_POOL_MAX_SIZE = 100
export const IQ_PROMPT_WORD_MAX_LENGTH = 32
export const IQ_PROMPT_CODE_PLACEHOLDER = '{{code}}'

/** Each probe fills the template with a random word from every pool. */
export type IQPromptConfig = {
  template: string
  animals: string[]
  scenes: string[]
  styles: string[]
}

export type IQPromptPool = 'animals' | 'scenes' | 'styles'

export const IQ_PROMPT_POOLS: IQPromptPool[] = ['animals', 'scenes', 'styles']

/** An English i18n key plus its interpolation values. */
export type IQPromptConfigError = {
  key: string
  values: Record<string, string | number>
}

function parseWords(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== ''
  )
}

export function parseIQPromptConfig(value: string): IQPromptConfig {
  const parsed = safeJsonParse<unknown>(value, { fallback: {}, silent: true })
  let config: Record<string, unknown> = {}
  if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    config = parsed as Record<string, unknown>
  }
  return {
    template: typeof config.template === 'string' ? config.template : '',
    animals: parseWords(config.animals),
    scenes: parseWords(config.scenes),
    styles: parseWords(config.styles),
  }
}

export function serializeIQPromptConfig(config: IQPromptConfig): string {
  return JSON.stringify({
    template: config.template.trim(),
    animals: config.animals,
    scenes: config.scenes,
    styles: config.styles,
  })
}

/** Mirrors ValidateIQPrompt so invalid configs are caught before saving. */
export function validateIQPromptConfig(
  config: IQPromptConfig
): IQPromptConfigError | null {
  const template = config.template.trim()
  if (!template || template.length > IQ_PROMPT_TEMPLATE_MAX_LENGTH) {
    return {
      key: 'Prompt template must be 1-{{max}} characters',
      values: { max: IQ_PROMPT_TEMPLATE_MAX_LENGTH },
    }
  }
  if (!template.includes(IQ_PROMPT_CODE_PLACEHOLDER)) {
    return {
      key: 'Prompt template must contain {{placeholder}}',
      values: { placeholder: IQ_PROMPT_CODE_PLACEHOLDER },
    }
  }
  for (const pool of IQ_PROMPT_POOLS) {
    const words = config[pool]
    if (words.length === 0 || words.length > IQ_PROMPT_POOL_MAX_SIZE) {
      return {
        key: 'Each word pool needs 1-{{max}} entries',
        values: { max: IQ_PROMPT_POOL_MAX_SIZE },
      }
    }
    if (words.some((word) => word.length > IQ_PROMPT_WORD_MAX_LENGTH)) {
      return {
        key: 'Each entry must be at most {{max}} characters',
        values: { max: IQ_PROMPT_WORD_MAX_LENGTH },
      }
    }
  }
  return null
}
