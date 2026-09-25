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
import { ExternalLink, ShoppingBag } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { TitledCard } from '@/components/ui/titled-card'

const REDEMPTION_STORE_URL = 'https://catfk.com/shop/FGIYNKJC'

export function RedemptionStoreCard() {
  const { t } = useTranslation()

  return (
    <TitledCard
      title={t('Buy Redemption Codes')}
      description={t(
        'Purchase a code from the store below. Copy it after checkout and we will detect it here.'
      )}
      icon={<ShoppingBag className='h-4 w-4' />}
      iconTone='success'
      disableHoverEffect
      action={
        <Button
          variant='outline'
          size='sm'
          render={
            <a
              href={REDEMPTION_STORE_URL}
              target='_blank'
              rel='noopener noreferrer'
            />
          }
        >
          <ExternalLink className='h-4 w-4' />
          {t('Open in new tab')}
        </Button>
      }
      contentClassName='p-0 sm:p-0'
    >
      <iframe
        title={t('Redemption Code')}
        src={REDEMPTION_STORE_URL}
        loading='lazy'
        referrerPolicy='strict-origin-when-cross-origin'
        allow='clipboard-write'
        // The fixed external origin stays isolated from this app. Its module
        // scripts and checkout storage require its own origin to be preserved.
        // oxlint-disable-next-line react/iframe-missing-sandbox
        sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts'
        className='tc-redemption-store-frame'
      />
    </TitledCard>
  )
}
