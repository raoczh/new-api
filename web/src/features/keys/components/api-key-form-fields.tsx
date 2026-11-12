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
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { DateTimePicker } from '@/components/datetime-picker'
import { sideDrawerSwitchItemClassName } from '@/components/drawer-layout'
import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'

import type { ApiKeyFormValues } from '../lib'

/**
 * Field groups shared by the create dialog and the edit drawer. Each one
 * reads the surrounding react-hook-form context.
 */

export function ApiKeyExpiryField() {
  const { t } = useTranslation()
  const form = useFormContext<ApiKeyFormValues>()

  const handleSetExpiry = (months: number, days: number, hours: number) => {
    if (months === 0 && days === 0 && hours === 0) {
      form.setValue('expired_time', null)
      return
    }

    const now = new Date()
    now.setMonth(now.getMonth() + months)
    now.setDate(now.getDate() + days)
    now.setHours(now.getHours() + hours)

    form.setValue('expired_time', now)
  }

  return (
    <FormField
      control={form.control}
      name='expired_time'
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('Expiration Time')}</FormLabel>
          <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'>
            <FormControl>
              <DateTimePicker
                value={field.value ?? undefined}
                onChange={(date) => field.onChange(date ?? null)}
                placeholder={t('Never expires')}
                className='min-w-0 [&_input[type=time]]:w-24 sm:[&_input[type=time]]:w-32'
              />
            </FormControl>
            <div className='grid grid-cols-4 gap-2 sm:flex'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='px-2 text-xs sm:px-3 sm:text-sm'
                onClick={() => handleSetExpiry(0, 0, 0)}
              >
                {t('Never')}
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='px-2 text-xs sm:px-3 sm:text-sm'
                onClick={() => handleSetExpiry(1, 0, 0)}
              >
                {t('1 Month')}
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='px-2 text-xs sm:px-3 sm:text-sm'
                onClick={() => handleSetExpiry(0, 1, 0)}
              >
                {t('1 Day')}
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='px-2 text-xs sm:px-3 sm:text-sm'
                onClick={() => handleSetExpiry(0, 0, 1)}
              >
                {t('1 Hour')}
              </Button>
            </div>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function ApiKeyCountField() {
  const { t } = useTranslation()
  const form = useFormContext<ApiKeyFormValues>()

  return (
    <FormField
      control={form.control}
      name='tokenCount'
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('Quantity')}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type='number'
              min='1'
              placeholder={t('Number of keys to create')}
              onChange={(e) =>
                field.onChange(Number.parseInt(e.target.value, 10) || 1)
              }
            />
          </FormControl>
          <FormDescription>
            {t(
              'Create multiple API keys at once (random suffix will be added to names)'
            )}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function ApiKeyQuotaFields() {
  const { t } = useTranslation()
  const form = useFormContext<ApiKeyFormValues>()
  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'
  const quotaLabel = t('Quota ({{currency}})', { currency: currencyLabel })
  const quotaPlaceholder = tokensOnly
    ? t('Enter quota in tokens')
    : t('Enter quota in {{currency}}', { currency: currencyLabel })
  const unlimitedQuota = form.watch('unlimited_quota')

  return (
    <>
      {!unlimitedQuota && (
        <FormField
          control={form.control}
          name='remain_quota_dollars'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{quotaLabel}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type='number'
                  step={tokensOnly ? 1 : 0.01}
                  placeholder={quotaPlaceholder}
                  onChange={(e) =>
                    field.onChange(Number.parseFloat(e.target.value) || 0)
                  }
                />
              </FormControl>
              <FormDescription>
                {tokensOnly
                  ? t('Enter the quota amount in tokens')
                  : t('Enter the quota amount in {{currency}}', {
                      currency: currencyLabel,
                    })}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={form.control}
        name='unlimited_quota'
        render={({ field }) => (
          <FormItem className={sideDrawerSwitchItemClassName()}>
            <div className='flex flex-col gap-0.5'>
              <FormLabel className='text-sm'>{t('Unlimited Quota')}</FormLabel>
              <FormDescription className='text-xs'>
                {t('Enable unlimited quota for this API key')}
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  )
}

export function ApiKeyAccessFields(props: { models: string[] }) {
  const { t } = useTranslation()
  const form = useFormContext<ApiKeyFormValues>()

  return (
    <>
      <FormField
        control={form.control}
        name='model_limits'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Model Limits')}</FormLabel>
            <FormControl>
              <MultiSelect
                options={props.models.map((m) => ({
                  label: m,
                  value: m,
                }))}
                selected={field.value}
                onChange={field.onChange}
                placeholder={t('Select models (empty for allow all)')}
              />
            </FormControl>
            <FormDescription>
              {t('Limit which models can be used with this key')}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='allow_ips'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('IP Whitelist (supports CIDR)')}</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                className='min-h-20 resize-none'
                placeholder={t('One IP per line (empty for no restriction)')}
                rows={3}
              />
            </FormControl>
            <FormDescription>
              {t(
                'Do not over-trust this feature. IP may be spoofed. Please use with nginx, CDN and other gateways.'
              )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='allow_user_quota_query'
        render={({ field }) => (
          <FormItem className={sideDrawerSwitchItemClassName()}>
            <div className='flex flex-col gap-0.5'>
              <FormLabel className='text-sm'>
                {t('Allow querying user quota')}
              </FormLabel>
              <FormDescription className='text-xs'>
                {t(
                  "When enabled, this API key can be used to check your account's remaining and used quota."
                )}
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  )
}
