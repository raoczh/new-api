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
import { ArrowLeft, ExternalLink, Unplug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'

import {
  REDEMPTION_STORE_LOAD_TIMEOUT_MS,
  REDEMPTION_STORE_URL,
} from '../constants'
import { useRedemption, useTopupInfo } from '../hooks'
import { useClipboardRedemption } from '../hooks/use-clipboard-redemption'
import { ClipboardRedemptionDialog } from './dialogs/clipboard-redemption-dialog'

type StoreFrameState = 'loading' | 'loaded' | 'failed'

export function RedemptionStorePage() {
  const { t } = useTranslation()
  const { topupInfo } = useTopupInfo()
  const { redeeming, redeemCode } = useRedemption()
  const [frameState, setFrameState] = useState<StoreFrameState>('loading')
  const [frameKey, setFrameKey] = useState(0)

  const redemptionEnabled = topupInfo?.enable_redemption === true
  const clipboard = useClipboardRedemption(redemptionEnabled, redeeming)

  // A cross-origin frame that refuses embedding may never report a usable
  // load, so a timeout is the only reliable failure signal.
  useEffect(() => {
    if (frameState !== 'loading') return
    const timer = window.setTimeout(
      () => setFrameState('failed'),
      REDEMPTION_STORE_LOAD_TIMEOUT_MS
    )
    return () => window.clearTimeout(timer)
  }, [frameState])

  const openStoreInNewTab = (
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
      <ExternalLink className='size-4' aria-hidden='true' />
      {t('Open in new tab')}
    </Button>
  )

  const steps = [
    t('Choose a product and complete checkout'),
    t('Copy the redemption code from the order'),
    t('Come back here or to the wallet to redeem it'),
  ]

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Buy Redemption Codes')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button variant='ghost' size='sm' render={<Link to='/wallet' />}>
            <ArrowLeft className='size-4' aria-hidden='true' />
            {t('Back to Wallet')}
          </Button>
          {openStoreInNewTab}
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='tc-store-workspace'>
            <ol className='tc-store-steps'>
              {steps.map((step, index) => (
                <li key={step} className='tc-store-step'>
                  <span className='tc-store-step-index' aria-hidden='true'>
                    {index + 1}
                  </span>
                  <span className='min-w-0'>{step}</span>
                </li>
              ))}
            </ol>

            <div className='tc-store-frame-shell' aria-busy={frameState === 'loading'}>
              <iframe
                key={frameKey}
                title={t('Redemption code store')}
                src={REDEMPTION_STORE_URL}
                onLoad={() => setFrameState('loaded')}
                referrerPolicy='strict-origin-when-cross-origin'
                allow='clipboard-write'
                // The fixed external origin stays isolated from this app. Its module
                // scripts and checkout storage require its own origin to be preserved.
                // oxlint-disable-next-line react/iframe-missing-sandbox
                sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts'
                className='tc-redemption-store-frame'
              />
              {frameState === 'loading' && (
                <LoadingState
                  message={t('Loading store...')}
                  className='tc-store-frame-overlay'
                />
              )}
              {frameState === 'failed' && (
                <div className='tc-store-frame-overlay'>
                  <ErrorState
                    icon={Unplug}
                    title={t('The store could not be opened here')}
                    description={t(
                      'Open it in a new tab to purchase. After checkout, copy the code and redeem it on the wallet page.'
                    )}
                    onRetry={() => {
                      setFrameKey((key) => key + 1)
                      setFrameState('loading')
                    }}
                    action={openStoreInNewTab}
                    className='w-full max-w-lg'
                  />
                </div>
              )}
            </div>

            <p className='text-muted-foreground text-xs'>
              {t('Store not showing correctly?')}{' '}
              <a
                href={REDEMPTION_STORE_URL}
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary font-medium underline-offset-3 hover:underline'
              >
                {t('Open it in a new tab')}
              </a>
            </p>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ClipboardRedemptionDialog
        open={redemptionEnabled && clipboard.redemption !== null}
        onOpenChange={(open) => {
          if (!open && !redeeming) clipboard.dismiss()
        }}
        code={clipboard.redemption?.code ?? ''}
        quota={clipboard.redemption?.quota ?? null}
        processing={redeeming}
        onConfirm={() => {
          if (!clipboard.redemption) return
          void redeemCode(clipboard.redemption.code).then((success) => {
            if (success) clipboard.dismiss()
          })
        }}
      />
    </>
  )
}
