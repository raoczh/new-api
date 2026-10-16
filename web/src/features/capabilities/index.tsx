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

import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { CTA, Stats } from '@/features/home/components'
import { useAuthStore } from '@/stores/auth-store'

import { CapabilitiesHero } from './components/capabilities-hero'
import { CapabilityGroups } from './components/capability-groups'
import { ProtocolMatrix } from './components/protocol-matrix'
import { UseCases } from './components/use-cases'

export function Capabilities() {
  const { t } = useTranslation()
  const isAuthenticated = useAuthStore((state) => Boolean(state.auth.user))

  return (
    <PublicLayout showMainContainer={false}>
      <main
        id='content'
        className='tc-landing'
        aria-label={t('Product Capabilities')}
      >
        <CapabilitiesHero isAuthenticated={isAuthenticated} />
        <Stats />
        <ProtocolMatrix />
        <CapabilityGroups />
        <UseCases />
        <CTA isAuthenticated={isAuthenticated} />
      </main>
      <Footer />
    </PublicLayout>
  )
}
