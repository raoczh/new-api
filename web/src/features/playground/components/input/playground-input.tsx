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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputFooter,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { PROMPT_STARTERS } from '../../constants'
import type { ModelOption, GroupOption } from '../../types'
import { PlaygroundInputControls } from './playground-input-controls'
import { PlaygroundInputTools } from './playground-input-tools'

interface PlaygroundInputProps {
  onSubmit: (text: string, attachments?: string[]) => void
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
  /** Offers example questions while there is nothing to reply to yet. */
  showPromptStarters?: boolean
  models: ModelOption[]
  modelValue: string
  onModelChange: (value: string) => void
  isModelLoading?: boolean
  hasNoChatModels?: boolean
  groups: GroupOption[]
  groupValue: string
  onGroupChange: (value: string) => void
}

export function PlaygroundInput({
  onSubmit,
  onStop,
  disabled,
  isGenerating,
  showPromptStarters = false,
  models,
  modelValue,
  onModelChange,
  isModelLoading = false,
  hasNoChatModels = false,
  groups,
  groupValue,
  onGroupChange,
}: PlaygroundInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  const handleSubmit = (message: PromptInputMessage) => {
    if (disabled) return

    const submittedText = message.text ?? ''
    const attachments = (message.files ?? [])
      .map((file) => file.url)
      .filter((url) => url.trim() !== '')

    if (!submittedText.trim() && attachments.length === 0) return

    onSubmit(submittedText, attachments)
    setText('')
  }

  return (
    <div className='grid shrink-0 gap-3'>
      {showPromptStarters && !hasNoChatModels && (
        <div
          role='group'
          aria-label={t('Example prompts')}
          className='flex flex-wrap items-center gap-2'
        >
          {PROMPT_STARTERS.map((starter) => (
            <Button
              key={starter.id}
              type='button'
              variant='outline'
              size='sm'
              disabled={disabled}
              className='h-auto rounded-full px-3 py-1.5 text-xs font-normal'
              onClick={() => setText(t(starter.prompt))}
            >
              {t(starter.label)}
            </Button>
          ))}
        </div>
      )}
      {hasNoChatModels && (
        <Alert>
          <AlertDescription>
            {t(
              'This group has no chat-capable models. Choose another group to start chatting.'
            )}
          </AlertDescription>
        </Alert>
      )}
      <PromptInput
        accept='image/*'
        className='relative'
        groupClassName='bg-card has-disabled:bg-card has-disabled:opacity-100 border-input rounded-xl overflow-hidden shadow-sm transition-colors duration-150 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 dark:bg-card dark:has-disabled:bg-card'
        multiple
        onSubmit={handleSubmit}
      >
        <PromptInputAttachments>
          {(attachment) => (
            <PromptInputAttachment
              className='mx-4 mt-3 w-fit max-w-[calc(100%-2rem)]'
              data={attachment}
            />
          )}
        </PromptInputAttachments>

        <PromptInputTextarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          className='min-h-20 px-5 pt-4 pb-3 leading-7 md:min-h-24 md:text-base'
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('Ask anything')}
          value={text}
        />

        <PromptInputFooter className='border-border/60 bg-muted/20 dark:bg-muted/10 border-t px-3 py-2.5 backdrop-blur'>
          <PlaygroundInputControls
            disabled={disabled}
            groups={groups}
            groupValue={groupValue}
            isGenerating={isGenerating}
            isModelLoading={isModelLoading}
            models={models}
            modelValue={modelValue}
            onGroupChange={onGroupChange}
            onModelChange={onModelChange}
            onStop={onStop}
            text={text}
            tools={<PlaygroundInputTools disabled={disabled} />}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
