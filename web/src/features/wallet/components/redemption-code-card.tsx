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
import { Gift, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'

interface RedemptionCodeCardProps {
  enabled: boolean
  code: string
  onCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  loading?: boolean
}

export function RedemptionCodeCard(props: RedemptionCodeCardProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return <Skeleton className='h-44 w-full rounded-lg' />
  }

  return (
    <TitledCard
      title={t('Redemption Code')}
      description={t('Have a Code?')}
      icon={<Gift className='h-4 w-4' />}
      iconTone='warning'
      disableHoverEffect
      contentClassName='space-y-3'
    >
      {props.enabled ? (
        <>
          <Label
            htmlFor='redemption-code'
            className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
          >
            {t('Enter your redemption code')}
          </Label>
          <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
            <Input
              id='redemption-code'
              value={props.code}
              onChange={(event) => props.onCodeChange(event.target.value)}
              placeholder={t('Enter your redemption code')}
              className='h-9 min-w-0 font-mono text-sm tracking-wide'
              autoComplete='off'
              spellCheck={false}
            />
            <Button
              onClick={props.onRedeem}
              disabled={props.redeeming}
              variant='outline'
              className='h-9 px-4'
            >
              {props.redeeming && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              {t('Redeem')}
            </Button>
          </div>
          <p className='text-muted-foreground text-xs leading-relaxed'>
            {t(
              'Allow clipboard access to detect copied codes automatically, or paste your code here.'
            )}
          </p>
        </>
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Redemption codes are disabled until the administrator confirms compliance terms.'
            )}
          </AlertDescription>
        </Alert>
      )}
    </TitledCard>
  )
}
