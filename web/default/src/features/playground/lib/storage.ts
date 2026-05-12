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
import { STORAGE_KEYS } from '../constants'
import type { PlaygroundConfig, ParameterEnabled, Message } from '../types'
import { sanitizeMessagesOnLoad } from './message-utils'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Load playground config from localStorage
 * Falls back to {} when the stored value is from an incompatible (e.g. classic) theme.
 */
export function loadConfig(): Partial<PlaygroundConfig> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      // Classic theme stores `{ inputs, parameterEnabled, ... }`; treat that as incompatible.
      if (!isPlainObject(parsed) || 'inputs' in parsed) {
        localStorage.removeItem(STORAGE_KEYS.CONFIG)
        return {}
      }
      return parsed as Partial<PlaygroundConfig>
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load config:', error)
    try {
      localStorage.removeItem(STORAGE_KEYS.CONFIG)
    } catch {
      /* ignore */
    }
  }
  return {}
}

/**
 * Save playground config to localStorage
 */
export function saveConfig(config: Partial<PlaygroundConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save config:', error)
  }
}

/**
 * Load parameter enabled state from localStorage
 */
export function loadParameterEnabled(): Partial<ParameterEnabled> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PARAMETER_ENABLED)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (!isPlainObject(parsed)) {
        localStorage.removeItem(STORAGE_KEYS.PARAMETER_ENABLED)
        return {}
      }
      return parsed as Partial<ParameterEnabled>
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load parameter enabled:', error)
    try {
      localStorage.removeItem(STORAGE_KEYS.PARAMETER_ENABLED)
    } catch {
      /* ignore */
    }
  }
  return {}
}

/**
 * Save parameter enabled state to localStorage
 */
export function saveParameterEnabled(
  parameterEnabled: Partial<ParameterEnabled>
): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.PARAMETER_ENABLED,
      JSON.stringify(parameterEnabled)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save parameter enabled:', error)
  }
}

/**
 * Load messages from localStorage
 * Returns null when the stored value is not a valid new-format messages array
 * (e.g. left over from the classic theme which stores `{ messages, timestamp }`).
 */
export function loadMessages(): Message[] | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) {
        localStorage.removeItem(STORAGE_KEYS.MESSAGES)
        return null
      }
      // Reject elements that don't look like the new Message shape (must have `from` + `versions[]`).
      const looksValid = parsed.every(
        (m) =>
          isPlainObject(m) &&
          typeof (m as { from?: unknown }).from === 'string' &&
          Array.isArray((m as { versions?: unknown }).versions)
      )
      if (!looksValid) {
        localStorage.removeItem(STORAGE_KEYS.MESSAGES)
        return null
      }
      const sanitized = sanitizeMessagesOnLoad(parsed as Message[])
      // Persist sanitized result to avoid re-sanitizing on subsequent loads
      if (sanitized !== parsed) {
        saveMessages(sanitized)
      }
      return sanitized
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load messages:', error)
    try {
      localStorage.removeItem(STORAGE_KEYS.MESSAGES)
    } catch {
      /* ignore */
    }
  }
  return null
}

/**
 * Save messages to localStorage
 */
export function saveMessages(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save messages:', error)
  }
}

/**
 * Clear all playground data
 */
export function clearPlaygroundData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONFIG)
    localStorage.removeItem(STORAGE_KEYS.PARAMETER_ENABLED)
    localStorage.removeItem(STORAGE_KEYS.MESSAGES)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear playground data:', error)
  }
}
