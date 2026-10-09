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
import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  KeyRound,
  SquareTerminal,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'

import { getApiKeys } from '../api'
import { CC_SWITCH_DOWNLOAD_URL } from '../constants'

const QUICK_TUTORIAL_HIDDEN_STORAGE_KEY = 'api-keys:quick-tutorial-hidden'

function TutorialStep(props: {
  index: number
  icon: ReactNode
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <li className='bg-background/60 flex min-w-0 gap-3 rounded-lg border p-3'>
      <span className='bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums'>
        {props.index}
      </span>
      <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
        <div className='flex items-center gap-1.5 text-sm font-medium'>
          {props.icon}
          {props.title}
        </div>
        <p className='text-muted-foreground text-xs leading-relaxed'>
          {props.description}
        </p>
        {props.children}
      </div>
    </li>
  )
}

export function ApiKeysQuickTutorial() {
  const { t } = useTranslation()
  const [hidden, setHidden] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.localStorage.getItem(QUICK_TUTORIAL_HIDDEN_STORAGE_KEY) === '1'
  )

  // One-row probe: the first step is done once the user owns any key.
  const { data: hasApiKey } = useQuery({
    queryKey: ['keys', 'quick-tutorial-probe'],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 1 })
      return (result.data?.total ?? 0) > 0
    },
    enabled: !hidden,
    meta: { errorToast: false },
  })

  if (hidden) return null

  const handleHide = () => {
    window.localStorage.setItem(QUICK_TUTORIAL_HIDDEN_STORAGE_KEY, '1')
    setHidden(true)
  }

  return (
    <section
      aria-labelledby='api-keys-quick-tutorial-title'
      className='bg-card shrink-0 rounded-lg border p-3 shadow-xs sm:p-4'
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-2.5'>
          <IconBadge tone='chart-1' size='sm'>
            <BookOpen />
          </IconBadge>
          <div className='flex flex-col gap-0.5'>
            <h2
              id='api-keys-quick-tutorial-title'
              className='text-sm font-semibold'
            >
              {t('Quick Tutorial')}
            </h2>
            <p className='text-muted-foreground text-xs'>
              {t('Follow these steps to start using AI coding tools')}
            </p>
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-1'>
          <Button
            role='link'
            variant='outline'
            size='xs'
            render={<Link to='/docs' hash='cc-switch' />}
          >
            <ExternalLink data-icon='inline-start' />
            {t('Detailed tutorial')}
          </Button>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={handleHide}
            aria-label={t('Hide quick tutorial')}
          >
            <X />
          </Button>
        </div>
      </div>

      <ol className='mt-3 grid gap-2 md:grid-cols-3'>
        <TutorialStep
          index={1}
          icon={<KeyRound className='size-3.5' aria-hidden='true' />}
          title={t('Create API Key')}
          description={t(
            'Click the button at the top right to create an API key and set its group and quota.'
          )}
        >
          {hasApiKey && (
            <span className='text-success flex items-center gap-1 text-xs'>
              <CheckCircle2 className='size-3.5' aria-hidden='true' />
              {t('Completed')}
            </span>
          )}
        </TutorialStep>
        <TutorialStep
          index={2}
          icon={<Download className='size-3.5' aria-hidden='true' />}
          title={t('Install CC Switch')}
          description={t(
            'CC Switch is a desktop app that imports your API key into Claude Code, Gemini CLI and other tools in one click.'
          )}
        >
          <div className='flex flex-wrap gap-1.5'>
            {['Windows', 'macOS'].map((platform) => (
              <Button
                key={platform}
                role='link'
                variant='outline'
                size='xs'
                render={
                  <a
                    href={CC_SWITCH_DOWNLOAD_URL}
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                <Download data-icon='inline-start' />
                {platform}
              </Button>
            ))}
          </div>
        </TutorialStep>
        <TutorialStep
          index={3}
          icon={<SquareTerminal className='size-3.5' aria-hidden='true' />}
          title={t('Use the key')}
          description={t(
            'Click the import button in a key row to send it to CC Switch, then pick the tool you want to configure.'
          )}
        >
          <div className='text-muted-foreground flex flex-wrap gap-3 text-xs'>
            <span>Claude Code</span>
            <span>Gemini CLI</span>
            <span>Codex</span>
          </div>
        </TutorialStep>
      </ol>
    </section>
  )
}
