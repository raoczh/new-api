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
import { useEffect, useEffectEvent, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string
      remove: (widgetId: string) => void
    }
  }
}

interface TurnstileProps {
  siteKey: string
  onVerify: (token: string) => void
  onExpire?: () => void
  className?: string
}

export function Turnstile(props: TurnstileProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const onVerify = useEffectEvent((token: string) => props.onVerify(token))
  const onExpire = useEffectEvent(() => props.onExpire?.())

  useEffect(() => {
    const container = ref.current
    if (!container) return
    let widgetId: string | undefined
    const render = () => {
      if (!window.turnstile || widgetId !== undefined) return
      try {
        widgetId = window.turnstile.render(container, {
          sitekey: props.siteKey,
          callback: onVerify,
          'error-callback': onExpire,
          'expired-callback': onExpire,
        })
      } catch {
        onExpire()
      }
    }

    let script: HTMLScriptElement | null = null
    if (window.turnstile) {
      render()
    } else {
      const scriptId = 'cf-turnstile'
      script = document.querySelector<HTMLScriptElement>(`#${scriptId}`)
      const isNewScript = !script
      if (!script) {
        script = document.createElement('script')
        script.id = scriptId
        script.src =
          'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
      }
      script.addEventListener('load', render)
      script.addEventListener('error', onExpire)
      if (isNewScript) document.head.appendChild(script)
    }

    return () => {
      script?.removeEventListener('load', render)
      script?.removeEventListener('error', onExpire)
      if (widgetId !== undefined) window.turnstile?.remove(widgetId)
    }
  }, [props.siteKey])

  return <div ref={ref} className={props.className} />
}
