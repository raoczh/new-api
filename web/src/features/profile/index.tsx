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
import { Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Main } from '@/components/layout'
import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import { TitledCard } from '@/components/ui/titled-card'
import { AccessTokenCard } from '@/features/security/components/access-token-card'
import { AccountActionCard } from '@/features/security/components/account-action-card'
import { AccountBindings } from '@/features/security/components/account-bindings'
import { LoginSessionsCard } from '@/features/security/components/login-sessions-card'
import { PasskeyCard } from '@/features/security/components/passkey-card'
import { PrivacyCard } from '@/features/security/components/privacy-card'
import { TwoFACard } from '@/features/security/components/two-fa-card'
import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'

import { CheckinCalendarCard } from './components/checkin-calendar-card'
import { LanguagePreferencesCard } from './components/language-preferences-card'
import { ProfileHeader } from './components/profile-header'
import { ProfileSettingsCard } from './components/profile-settings-card'
import { SidebarModulesCard } from './components/sidebar-modules-card'
import { useProfile } from './hooks'

export function Profile() {
  const { t } = useTranslation()
  const { profile, loading, refreshProfile } = useProfile()
  const { status } = useStatus()
  const permissions = useAuthStore((s) => s.auth.user?.permissions)

  const checkinEnabled = status?.checkin_enabled === true
  const turnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  const turnstileSiteKey = status?.turnstile_site_key || ''
  const canConfigureSidebar = permissions?.sidebar_settings !== false

  return (
    <Main>
      <div className='min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-6 sm:py-6'>
        <CardStaggerContainer className='mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6'>
          <CardStaggerItem>
            <ProfileHeader profile={profile} loading={loading} />
          </CardStaggerItem>

          <CardStaggerItem>
            <div className='grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.46fr)] xl:items-start'>
              <div className='min-w-0 space-y-4 sm:space-y-6'>
                <section aria-labelledby='profile-settings' className='space-y-3'>
                  <h3 id='profile-settings' className='text-sm font-semibold'>
                    {t('Profile Settings')}
                  </h3>
                  <ProfileSettingsCard
                    profile={profile}
                    loading={loading}
                    onProfileUpdate={refreshProfile}
                  />
                  <LanguagePreferencesCard
                    profile={profile}
                    onProfileUpdate={refreshProfile}
                  />
                </section>

                <section
                  aria-labelledby='security-authentication'
                  className='space-y-3'
                >
                  <h3 id='security-authentication' className='text-sm font-semibold'>
                    {t('Login & Authentication')}
                  </h3>
                  <AccountActionCard
                    action='password'
                    username={profile?.username || ''}
                    hasPassword={profile?.has_password ?? false}
                    onUpdate={refreshProfile}
                  />
                  <TitledCard
                    title={t('Account Bindings')}
                    icon={<Link2 className='size-4' />}
                    headerClassName='px-3 py-2.5 !pb-2.5 sm:px-4 sm:py-2.5 sm:!pb-2.5'
                    contentClassName='p-3 sm:p-3'
                    titleClassName='text-sm sm:text-sm'
                    iconClassName='size-7 sm:size-7'
                    disableHoverEffect
                  >
                    {profile && (
                      <AccountBindings profile={profile} onUpdate={refreshProfile} />
                    )}
                  </TitledCard>
                </section>

                <section aria-labelledby='security-access' className='space-y-3'>
                  <h3 id='security-access' className='text-sm font-semibold'>
                    {t('Sessions & Access')}
                  </h3>
                  <LoginSessionsCard />
                  <AccessTokenCard />
                </section>

                <section aria-labelledby='security-account' className='space-y-3'>
                  <h3 id='security-account' className='text-sm font-semibold'>
                    {t('Account Actions')}
                  </h3>
                  <AccountActionCard
                    action='delete'
                    username={profile?.username || ''}
                  />
                </section>
              </div>

              <aside className='min-w-0 space-y-4 sm:space-y-6 xl:sticky xl:top-6'>
                {checkinEnabled && (
                  <CheckinCalendarCard
                    checkinEnabled={checkinEnabled}
                    turnstileEnabled={turnstileEnabled}
                    turnstileSiteKey={turnstileSiteKey}
                  />
                )}
                {canConfigureSidebar && <SidebarModulesCard />}

                <div className='space-y-3'>
                  <h3 id='security-verification' className='text-sm font-semibold'>
                    {t('Security verification')}
                  </h3>
                  <PasskeyCard loading={loading} />
                  <TwoFACard loading={loading} />
                </div>

                <section aria-labelledby='security-privacy' className='space-y-3'>
                  <h3 id='security-privacy' className='text-sm font-semibold'>
                    {t('Privacy')}
                  </h3>
                  {profile && (
                    <PrivacyCard profile={profile} onUpdate={refreshProfile} />
                  )}
                </section>
              </aside>
            </div>
          </CardStaggerItem>
        </CardStaggerContainer>
      </div>
    </Main>
  )
}
