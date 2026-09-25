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
import { useEffect, useRef, useState } from 'react'

import { checkTopupCode } from '../api'
import { isClipboardRedemptionCode } from '../lib/redemption'

interface ClipboardRedemption {
  code: string
  quota: number
}

export function useClipboardRedemption(enabled: boolean, paused: boolean) {
  const [redemption, setRedemption] = useState<ClipboardRedemption | null>(null)
  const checkedCodes = useRef(new Set<string>())

  useEffect(() => {
    if (!enabled || paused || redemption) return

    const controller = new AbortController()
    let checking = false
    let clipboardBlocked = false
    let retryAfter = 0

    const inspectClipboard = async (pastedText?: string) => {
      if (
        controller.signal.aborted ||
        checking ||
        document.visibilityState === 'hidden' ||
        Date.now() < retryAfter
      ) {
        return
      }

      checking = true
      try {
        let text = pastedText
        if (text === undefined) {
          if (
            clipboardBlocked ||
            !document.hasFocus() ||
            !navigator.clipboard?.readText
          ) {
            return
          }
          try {
            text = await navigator.clipboard.readText()
          } catch {
            // Avoid repeatedly prompting when the browser denies automatic reads.
            // An explicit paste still works without clipboard-read permission.
            clipboardBlocked = true
            return
          }
        }
        if (controller.signal.aborted) return
        const code = text.trim()
        if (
          !isClipboardRedemptionCode(code) ||
          checkedCodes.current.has(code)
        ) {
          return
        }

        const response = await checkTopupCode({ key: code }, controller.signal)
        if (controller.signal.aborted) return
        checkedCodes.current.add(code)
        if (
          response.success &&
          typeof response.data === 'number' &&
          response.data > 0
        ) {
          setRedemption({ code, quota: response.data })
        }
      } catch {
        // A transient network error must not permanently discard a purchased code.
        retryAfter = Date.now() + 30_000
      } finally {
        checking = false
      }
    }

    const readClipboard = () => {
      void inspectClipboard()
    }
    const handleReturn = () => {
      if (document.visibilityState === 'hidden') return
      clipboardBlocked = false
      readClipboard()
    }
    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain')
      if (text !== undefined) void inspectClipboard(text)
    }

    const interval = window.setInterval(readClipboard, 3000)
    window.addEventListener('focus', handleReturn)
    document.addEventListener('visibilitychange', handleReturn)
    document.addEventListener('paste', handlePaste)
    readClipboard()

    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', handleReturn)
      document.removeEventListener('visibilitychange', handleReturn)
      document.removeEventListener('paste', handlePaste)
    }
  }, [enabled, paused, redemption])

  return { redemption, dismiss: () => setRedemption(null) }
}
