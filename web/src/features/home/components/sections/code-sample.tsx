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
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { AnimateInView } from '@/components/animate-in-view'
import { CopyButton } from '@/components/copy-button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getLobeIcon } from '@/lib/lobe-icon'

import { useGatewayFacts, type SampleModelFamily } from '../../hooks'
import {
  buildCodeSample,
  SAMPLE_HIGHLIGHT,
  SAMPLE_LANGUAGES,
  type SampleLanguage,
} from '../../lib/code-samples'
import { SectionHeading } from '../section-heading'

const FAMILIES: { value: SampleModelFamily; label: string; icon: string }[] = [
  { value: 'openai', label: 'OpenAI', icon: 'OpenAI' },
  { value: 'claude', label: 'Claude', icon: 'Claude.Color' },
  { value: 'gemini', label: 'Gemini', icon: 'Gemini.Color' },
]

export function CodeSample() {
  const { t } = useTranslation()
  const facts = useGatewayFacts()
  const [family, setFamily] = useState<SampleModelFamily>('openai')
  const [language, setLanguage] = useState<SampleLanguage>('curl')
  const code = buildCodeSample(
    family,
    language,
    facts.origin,
    facts.sampleModels[family]
  )

  return (
    <section className='tc-landing-section'>
      <div className='tc-landing-container tc-code-layout'>
        <div className='flex flex-col gap-8'>
          <SectionHeading
            align='start'
            eyebrow={t('For developers')}
            title={t('Keep your SDK. Change one line.')}
            description={t(
              'Use the official OpenAI, Anthropic or Google SDKs as they are. Point them at this gateway and your existing code keeps working.'
            )}
          />
          <AnimateInView className='tc-landing-card flex items-center gap-3 p-4'>
            <div className='min-w-0 flex-1'>
              <div className='text-muted-foreground text-xs'>
                {t('Base URL')}
              </div>
              <code className='block truncate font-mono text-sm'>
                {facts.origin}
              </code>
            </div>
            <CopyButton
              value={facts.origin}
              variant='outline'
              aria-label={t('Copy Base URL')}
            />
          </AnimateInView>
          <Link
            to='/docs/$'
            params={{ _splat: 'quickstart' }}
            className='text-foreground/80 hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors'
          >
            {t('Read the quick start')}
            <ArrowRight className='size-4' aria-hidden='true' />
          </Link>
        </div>
        <AnimateInView
          animation='fade-left'
          className='tc-landing-card tc-code-panel'
        >
          <div className='flex flex-wrap items-center gap-2 border-b p-3'>
            <Tabs
              value={family}
              onValueChange={(value) => setFamily(value as SampleModelFamily)}
            >
              <TabsList aria-label={t('API protocol')}>
                {FAMILIES.map((item) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className='px-3'
                  >
                    {getLobeIcon(item.icon, 14)}
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Tabs
              value={language}
              onValueChange={(value) => setLanguage(value as SampleLanguage)}
              className='ms-auto'
            >
              <TabsList aria-label={t('Language')}>
                {(Object.keys(SAMPLE_LANGUAGES) as SampleLanguage[]).map(
                  (key) => (
                    <TabsTrigger key={key} value={key} className='px-3'>
                      {SAMPLE_LANGUAGES[key]}
                    </TabsTrigger>
                  )
                )}
              </TabsList>
            </Tabs>
          </div>
          <CodeBlock
            code={code}
            language={SAMPLE_HIGHLIGHT[language]}
            enableCollapse={false}
          >
            <CodeBlockCopyButton />
          </CodeBlock>
        </AnimateInView>
      </div>
    </section>
  )
}
