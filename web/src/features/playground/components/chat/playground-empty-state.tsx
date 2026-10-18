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
import { MessageSquarePlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function PlaygroundEmptyState() {
  const { t } = useTranslation()

  return (
    <div className='flex min-h-[min(420px,calc(100svh-22rem))] items-center justify-center px-1 py-10'>
      <div className='grid w-full max-w-xl justify-items-center gap-3 text-center'>
        <div className='bg-muted/50 text-muted-foreground flex size-11 items-center justify-center rounded-xl border'>
          <MessageSquarePlusIcon className='size-5' aria-hidden='true' />
        </div>
        <h2 className='text-lg font-semibold tracking-tight text-balance'>
          {t('Start a playground chat')}
        </h2>
        <p className='text-muted-foreground max-w-md text-sm leading-6 text-balance'>
          {t('Send a message below to test the selected model.')}
        </p>
      </div>
    </div>
  )
}
