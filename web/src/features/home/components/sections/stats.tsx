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
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { useGatewayFacts } from '../../hooks'

/**
 * Facts about this deployment. Model and vendor counts come from the public
 * catalog; when it is private or empty the band shows protocol facts instead.
 */
export function Stats() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const facts = useGatewayFacts()

  const cells = [
    facts.modelCount > 0
      ? {
          value: formatNumber(facts.modelCount, locale),
          label: t('Models available'),
        }
      : { value: '3', label: t('Native API protocols') },
    facts.vendorCount > 0
      ? {
          value: formatNumber(facts.vendorCount, locale),
          label: t('Model vendors'),
        }
      : { value: '1', label: t('Base URL for every model') },
    { value: '0', label: t('Code changes to switch models') },
    { value: '24/7', label: t('Usage and cost logs') },
  ]

  return (
    <section className='tc-landing-container py-16'>
      <AnimateInView className='tc-landing-card tc-stats-band'>
        {cells.map((cell) => (
          <div key={cell.label} className='tc-stat-cell'>
            <div className='tc-stat-value'>{cell.value}</div>
            <div className='text-muted-foreground mt-2 text-sm'>
              {cell.label}
            </div>
          </div>
        ))}
      </AnimateInView>
    </section>
  )
}
