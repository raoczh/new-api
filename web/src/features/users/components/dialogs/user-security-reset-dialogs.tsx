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
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'

import { resetUserPasskey, resetUserTwoFA } from '../../api'
import { ERROR_MESSAGES } from '../../constants'
import type { UsersDialogType } from '../../types'
import { useUsers } from '../users-provider'

/**
 * Confirmations for removing a user's Passkey or two-factor setup. Each reset
 * is sent only with a step-up proof bound to that user, and the confirmation
 * steps aside while the proof is being collected.
 */
export function UserSecurityResetDialogs(props: {
  user: { id: number; username: string }
}) {
  const { t } = useTranslation()
  const users = useUsers()
  const user = props.user

  // A reset that finishes late must not close a dialog opened in the meantime.
  const closeDialog = (dialog: UsersDialogType) => {
    users.setOpen((current) => (current === dialog ? null : current))
  }

  const handleResetPasskey = async () => {
    try {
      const proof = await users.requestVerification({
        scope: 'admin.user.passkey.reset',
        context: { user_id: user.id },
        title: t('Verify to reset Passkey'),
        description: t(
          'Confirm your identity before changing the account {{username}}.',
          { username: user.username }
        ),
      })
      if (!proof) return
      const result = await resetUserPasskey(user.id, proof.proof_token)
      if (result.success) {
        toast.success(t('Passkey reset successfully'))
        users.triggerRefresh()
      } else {
        handleServerError(result, t('Failed to reset Passkey'))
      }
    } catch (error) {
      handleServerError(
        AuthOperationError.from(error),
        t(ERROR_MESSAGES.UNEXPECTED)
      )
    } finally {
      closeDialog('reset-passkey')
    }
  }

  const handleResetTwoFA = async () => {
    try {
      const proof = await users.requestVerification({
        scope: 'admin.user.2fa.disable',
        context: { user_id: user.id },
        title: t('Verify to reset 2FA'),
        description: t(
          'Confirm your identity before changing the account {{username}}.',
          { username: user.username }
        ),
      })
      if (!proof) return
      const result = await resetUserTwoFA(user.id, proof.proof_token)
      if (result.success) {
        toast.success(t('Two-factor authentication reset'))
        users.triggerRefresh()
      } else {
        handleServerError(result, t('Failed to reset 2FA'))
      }
    } catch (error) {
      handleServerError(
        AuthOperationError.from(error),
        t(ERROR_MESSAGES.UNEXPECTED)
      )
    } finally {
      closeDialog('reset-2fa')
    }
  }

  return (
    <>
      <ConfirmDialog
        open={users.open === 'reset-passkey' && !users.verificationActive}
        onOpenChange={(open) => !open && closeDialog('reset-passkey')}
        title={t('Reset Passkey')}
        desc={t(
          'Reset Passkey for {{username}}? The user will need to register a new Passkey before using passwordless login.',
          { username: user.username }
        )}
        confirmText={t('Reset Passkey')}
        handleConfirm={() => void handleResetPasskey()}
      />

      <ConfirmDialog
        open={users.open === 'reset-2fa' && !users.verificationActive}
        onOpenChange={(open) => !open && closeDialog('reset-2fa')}
        title={t('Reset Two-Factor Authentication')}
        desc={t(
          'Reset 2FA for {{username}}? The user must set up 2FA again to continue using it.',
          { username: user.username }
        )}
        confirmText={t('Reset 2FA')}
        handleConfirm={() => void handleResetTwoFA()}
      />
    </>
  )
}
