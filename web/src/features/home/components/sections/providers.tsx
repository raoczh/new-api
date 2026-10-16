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
import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/lib/lobe-icon'

/** Provider families an operator can connect; not a list of live channels. */
const PROVIDERS = [
  { icon: 'OpenAI', name: 'OpenAI' },
  { icon: 'Claude.Color', name: 'Claude' },
  { icon: 'Gemini.Color', name: 'Gemini' },
  { icon: 'DeepSeek.Color', name: 'DeepSeek' },
  { icon: 'Qwen.Color', name: 'Qwen' },
  { icon: 'Doubao.Color', name: 'Doubao' },
  { icon: 'Kimi', name: 'Kimi' },
  { icon: 'Zhipu.Color', name: 'Zhipu' },
  { icon: 'Grok', name: 'Grok' },
  { icon: 'Minimax.Color', name: 'MiniMax' },
  { icon: 'Hunyuan.Color', name: 'Hunyuan' },
  { icon: 'Mistral.Color', name: 'Mistral' },
  { icon: 'Midjourney', name: 'Midjourney' },
  { icon: 'Suno', name: 'Suno' },
  { icon: 'Kling.Color', name: 'Kling' },
] as const

export function Providers() {
  const { t } = useTranslation()
  return (
    <section
      className='border-y py-10'
      aria-label={t('Model providers you can connect')}
    >
      <p className='text-muted-foreground mb-6 text-center text-sm'>
        {t('Connect the providers your team already uses')}
      </p>
      <div className='tc-marquee'>
        <ul className='tc-marquee-track'>
          {[false, true].map((duplicate) =>
            PROVIDERS.map((provider) => (
              <li
                key={`${provider.name}-${duplicate ? 'copy' : 'main'}`}
                className='tc-marquee-item'
                aria-hidden={duplicate || undefined}
              >
                {getLobeIcon(provider.icon, 22)}
                {provider.name}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  )
}
