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
  ArrowRight,
  BookOpen,
  CircleCheck,
  Download,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { useIsSidebarModuleVisible } from '@/hooks/use-sidebar-config'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getApiKey } from '../../api'
import { usePrimaryApiAddress } from '../../hooks/use-api-addresses'
import { useApiKeys } from '../api-keys-provider'

type ApiKeyReadyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Shown right after a key is created. A new user rarely knows what to do with
 * a key, so the key and address come with the next steps they can take.
 */
export function ApiKeyReadyDialog(props: ApiKeyReadyDialogProps) {
  const { t } = useTranslation()
  const {
    createdKeyId,
    resolveRealKey,
    setResolvedKey,
    setCurrentRow,
    setOpen,
  } = useApiKeys()
  const { address } = usePrimaryApiAddress()
  const chatVisible = useIsSidebarModuleVisible('/playground')

  const keyQuery = useQuery({
    queryKey: ['api-key', 'created', createdKeyId],
    queryFn: async () => {
      const fullKey = await resolveRealKey(createdKeyId ?? 0)
      if (!fullKey) throw new Error('key unavailable')
      return fullKey
    },
    enabled: props.open && createdKeyId !== null,
    staleTime: Infinity,
    retry: false,
    // resolveRealKey already reported the failure.
    meta: { errorToast: false },
  })
  const fullKey = keyQuery.data ?? ''

  const handleImport = async () => {
    if (createdKeyId === null || !fullKey) return
    const stored = requireServerSuccess(await getApiKey(createdKeyId)).data
    if (!stored) return
    setResolvedKey(fullKey)
    setCurrentRow(stored)
    setOpen('cc-switch')
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        <span className='flex items-center gap-2'>
          <CircleCheck className='text-success size-5' aria-hidden='true' />
          {t('Your API key is ready')}
        </span>
      }
      description={t(
        'An API key works like a password for AI models. Keep it private. You can copy it again from the key list at any time.'
      )}
      contentClassName='sm:max-w-xl'
      footer={
        <Button type='button' onClick={() => props.onOpenChange(false)}>
          {t('Done')}
        </Button>
      }
    >
      <div className='flex flex-col gap-5'>
        <div className='flex flex-col gap-2'>
          <CredentialRow label={t('API Key')} value={fullKey}>
            {keyQuery.isPending && (
              <LoadingState inline size='sm' message={t('Loading...')} />
            )}
            {keyQuery.isError && (
              <span role='alert' className='text-destructive text-xs'>
                {t(
                  'Could not load the key. Copy it from the key list instead.'
                )}
              </span>
            )}
          </CredentialRow>
          <CredentialRow label={t('API address')} value={address} />
        </div>

        <section
          aria-labelledby='api-key-ready-next'
          className='flex flex-col gap-2'
        >
          <h3 id='api-key-ready-next' className='text-sm font-medium'>
            {t('What would you like to do next?')}
          </h3>
          <ul className='flex flex-col gap-2'>
            {chatVisible && (
              <NextStep
                icon={MessageCircle}
                tone='chart-1'
                title={t('Chat right here')}
                description={t(
                  'No setup needed. Start talking to a model in your browser.'
                )}
              >
                {/* Opens in a new tab, so the key stays on screen to copy. */}
                <Button
                  role='link'
                  size='sm'
                  render={
                    <Link
                      to='/playground'
                      target='_blank'
                      rel='noopener noreferrer'
                    />
                  }
                >
                  {t('Start chatting')}
                  <ArrowRight data-icon='inline-end' aria-hidden='true' />
                </Button>
              </NextStep>
            )}
            <NextStep
              icon={Download}
              tone='chart-2'
              title={t('Use it in a desktop app')}
              description={t(
                'Send this key to Claude Code, Codex and other tools through CC Switch in one click.'
              )}
            >
              <Button
                size='sm'
                variant='outline'
                disabled={!fullKey}
                onClick={() => void handleImport()}
              >
                {t('Import')}
              </Button>
            </NextStep>
            <NextStep
              icon={BookOpen}
              tone='chart-3'
              title={t('Follow a step-by-step guide')}
              description={t(
                'Illustrated instructions for Cherry Studio, Chatbox and other common apps.'
              )}
            >
              <Button
                role='link'
                size='sm'
                variant='outline'
                render={
                  <Link
                    to='/docs/$'
                    params={{ _splat: 'config/agents' }}
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                {t('View guide')}
              </Button>
            </NextStep>
          </ul>
        </section>
      </div>
    </Dialog>
  )
}

function CredentialRow(props: {
  label: string
  value: string
  children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className='bg-muted/40 flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2'>
      <span className='text-muted-foreground w-20 shrink-0 text-xs font-medium'>
        {props.label}
      </span>
      <span className='flex min-w-0 flex-1 items-center'>
        {props.value ? (
          <code className='min-w-0 text-xs break-all select-all'>
            {props.value}
          </code>
        ) : (
          props.children
        )}
      </span>
      {props.value && (
        <CopyButton
          value={props.value}
          variant='outline'
          size='sm'
          tooltip={t('Copy')}
          aria-label={`${t('Copy')}: ${props.label}`}
        >
          {t('Copy')}
        </CopyButton>
      )}
    </div>
  )
}

function NextStep(props: {
  icon: LucideIcon
  tone: IconBadgeTone
  title: string
  description: string
  children: ReactNode
}) {
  const Icon = props.icon
  return (
    <li className='flex min-w-0 items-center gap-3 rounded-lg border p-3'>
      <IconBadge tone={props.tone} size='md'>
        <Icon />
      </IconBadge>
      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='text-sm font-medium'>{props.title}</span>
        <span className='text-muted-foreground text-xs leading-relaxed'>
          {props.description}
        </span>
      </div>
      <div className='shrink-0'>{props.children}</div>
    </li>
  )
}
