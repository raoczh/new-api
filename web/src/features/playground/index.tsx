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
import { HistoryIcon, MessageSquarePlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

import { PlaygroundChat } from './components/chat/playground-chat'
import { PlaygroundHistoryPanel } from './components/history/playground-history-panel'
import { PlaygroundInput } from './components/input/playground-input'
import {
  useChatHandler,
  usePlaygroundConversation,
  usePlaygroundOptions,
  usePlaygroundState,
} from './hooks'

export function Playground() {
  const { t } = useTranslation()
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const {
    config,
    parameterEnabled,
    messages,
    isLoadingMessages,
    conversations,
    activeConversationId,
    models,
    groups,
    updateMessages,
    setModels,
    setGroups,
    updateConfig,
    updateParameterEnabled,
    createNewConversation,
    selectConversation,
    deleteConversation,
  } = usePlaygroundState()

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config,
    parameterEnabled,
    onMessageUpdate: updateMessages,
  })

  const {
    editingMessageKey,
    handleSendMessage,
    handleRegenerateMessage,
    handleEditMessage,
    handleEditOpenChange,
    applyEdit,
    handleDeleteMessage,
  } = usePlaygroundConversation({
    messages,
    updateMessages,
    sendChat,
  })

  const { isLoadingModels } = usePlaygroundOptions({
    currentGroup: config.group,
    currentModel: config.model,
    setGroups,
    setModels,
    updateConfig,
  })

  // Switching conversations mid-stream would route incoming chunks into the
  // wrong conversation, so history actions wait for the current run.
  const isHistoryDisabled = isGenerating || isLoadingMessages

  const handleCreateConversation = () => {
    handleEditOpenChange(false)
    createNewConversation()
    setIsHistoryOpen(false)
  }

  const handleSelectConversation = (conversationId: string) => {
    handleEditOpenChange(false)
    selectConversation(conversationId)
    setIsHistoryOpen(false)
  }

  const handleDeleteConversation = (conversationId: string) => {
    handleEditOpenChange(false)
    deleteConversation(conversationId)
  }

  const historyPanel = (
    <PlaygroundHistoryPanel
      activeConversationId={activeConversationId}
      conversations={conversations}
      disabled={isHistoryDisabled}
      onCreate={handleCreateConversation}
      onDelete={handleDeleteConversation}
      onSelect={handleSelectConversation}
    />
  )

  return (
    <div className='relative flex size-full min-h-0 overflow-hidden'>
      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
        <header className='bg-card/60 flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-6'>
          <h1 className='text-base font-semibold'>{t('AI Chat')}</h1>
          <Badge variant='outline' className='max-w-[45%] truncate font-mono'>
            {config.model || t('Select model')}
          </Badge>

          <div className='ms-auto flex items-center gap-1 lg:hidden'>
            <Button
              aria-label={t('New chat')}
              disabled={isHistoryDisabled}
              onClick={handleCreateConversation}
              size='icon-sm'
              variant='ghost'
            >
              <MessageSquarePlusIcon className='size-4' aria-hidden='true' />
            </Button>
            <Button
              aria-label={t('History')}
              onClick={() => setIsHistoryOpen(true)}
              size='icon-sm'
              variant='ghost'
            >
              <HistoryIcon className='size-4' aria-hidden='true' />
            </Button>
          </div>
        </header>

        <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
          <PlaygroundChat
            messages={messages}
            isLoadingMessages={isLoadingMessages}
            onRegenerateMessage={handleRegenerateMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            isGenerating={isGenerating}
            editingKey={editingMessageKey}
            onCancelEdit={handleEditOpenChange}
            onSaveEdit={(newContent) => applyEdit(newContent, false)}
            onSaveEditAndSubmit={(newContent) => applyEdit(newContent, true)}
          />
        </div>

        {/* Composer: full-width band, content centered to the chat column */}
        <div className='bg-card/50 shrink-0 border-t pb-[env(safe-area-inset-bottom)]'>
          <div className='mx-auto w-full max-w-4xl px-4 py-3 sm:px-6 sm:py-4'>
            <PlaygroundInput
              config={config}
              disabled={isGenerating}
              groups={groups}
              groupValue={config.group}
              isGenerating={isGenerating}
              isModelLoading={isLoadingModels}
              modelValue={config.model}
              models={models}
              onConfigChange={updateConfig}
              onGroupChange={(value) => updateConfig('group', value)}
              onModelChange={(value) => updateConfig('model', value)}
              onParameterEnabledChange={updateParameterEnabled}
              onStop={stopGeneration}
              onSubmit={handleSendMessage}
              parameterEnabled={parameterEnabled}
            />
          </div>
        </div>
      </div>

      <aside className='bg-card/30 hidden w-64 shrink-0 border-l lg:block'>
        {historyPanel}
      </aside>

      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent className='w-80 gap-0 p-0' side='right'>
          <SheetTitle className='sr-only'>{t('History')}</SheetTitle>
          {historyPanel}
        </SheetContent>
      </Sheet>
    </div>
  )
}
