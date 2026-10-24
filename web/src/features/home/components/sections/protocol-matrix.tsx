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

import { AnimateInView } from '@/components/animate-in-view'
import { getLobeIcon } from '@/lib/lobe-icon'

import { useGatewayFacts } from '../../hooks'
import { SectionHeading } from '../section-heading'

/** Endpoints new-api relays natively; paths are appended to the Base URL. */
const ENDPOINTS = [
  { icon: 'OpenAI', protocol: 'OpenAI', path: '/v1/chat/completions' },
  { icon: 'OpenAI', protocol: 'OpenAI', path: '/v1/responses' },
  { icon: 'Claude.Color', protocol: 'Anthropic', path: '/v1/messages' },
  {
    icon: 'Gemini.Color',
    protocol: 'Gemini',
    path: '/v1beta/models/{model}:generateContent',
  },
  { icon: 'OpenAI', protocol: 'OpenAI', path: '/v1/embeddings' },
  { icon: 'OpenAI', protocol: 'OpenAI', path: '/v1/images/generations' },
  { icon: 'OpenAI', protocol: 'OpenAI', path: '/v1/audio/speech' },
  { icon: 'OpenAI', protocol: 'OpenAI', path: '/v1/models' },
] as const

export function ProtocolMatrix() {
  const { t } = useTranslation()
  const facts = useGatewayFacts()

  const purposes: Record<string, string> = {
    '/v1/chat/completions': t('Chat and tool calls'),
    '/v1/responses': t('Responses API and reasoning models'),
    '/v1/messages': t('Claude Messages, Claude Code'),
    '/v1beta/models/{model}:generateContent': t('Gemini native SDK'),
    '/v1/embeddings': t('Vector embeddings'),
    '/v1/images/generations': t('Image generation'),
    '/v1/audio/speech': t('Text to speech'),
    '/v1/models': t('List available models'),
  }

  return (
    <section id='protocols' className='tc-landing-section'>
      <div className='tc-landing-container flex flex-col gap-12'>
        <SectionHeading
          eyebrow={t('Protocols')}
          title={t('Native endpoints, not a lowest common denominator')}
          description={t(
            'Each protocol keeps its own request shape, streaming format and SDK. Append these paths to {{origin}}.',
            { origin: facts.origin }
          )}
        />
        <AnimateInView className='tc-landing-card overflow-x-auto'>
          <table className='w-full min-w-[36rem] text-sm'>
            <thead>
              <tr className='text-muted-foreground border-b text-start text-xs'>
                <th className='px-6 py-4 text-start font-medium'>
                  {t('Protocol')}
                </th>
                <th className='px-6 py-4 text-start font-medium'>
                  {t('Endpoint')}
                </th>
                <th className='px-6 py-4 text-start font-medium'>
                  {t('Used for')}
                </th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((endpoint) => (
                <tr key={endpoint.path} className='not-last:border-b'>
                  <td className='px-6 py-4'>
                    <span className='inline-flex items-center gap-2 font-medium'>
                      {getLobeIcon(endpoint.icon, 16)}
                      {endpoint.protocol}
                    </span>
                  </td>
                  <td className='px-6 py-4 font-mono text-xs'>
                    {endpoint.path}
                  </td>
                  <td className='text-muted-foreground px-6 py-4'>
                    {purposes[endpoint.path]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AnimateInView>
      </div>
    </section>
  )
}
