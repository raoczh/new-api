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
import { Fragment } from 'react'

import { UserSubscriptionsDialog } from '@/features/subscriptions/components/dialogs/user-subscriptions-dialog'

import { UserApiKeysDialog } from './dialogs/user-api-keys-dialog'
import { UserBindingDialog } from './dialogs/user-binding-dialog'
import { UserGroupsDialog } from './dialogs/user-groups-dialog'
import { UserRechargeHistoryDialog } from './dialogs/user-recharge-history-dialog'
import { UserSecurityResetDialogs } from './dialogs/user-security-reset-dialogs'
import { UserQuotaDialog } from './user-quota-dialog'
import { UsersDeleteDialog } from './users-delete-dialog'
import { UsersMutateDrawer } from './users-mutate-drawer'
import { useUsers } from './users-provider'

/**
 * The dialogs a list row can open, mounted once for whichever user was picked
 * last. They used to be mounted in every row, which made each click on a row
 * button render the whole list again before anything could appear.
 */
export function UserRowDialogs() {
  const users = useUsers()
  const user = users.currentRow
  const closeDialog = (isOpen: boolean) => !isOpen && users.setOpen(null)

  if (!user) {
    return null
  }

  // Keyed by user, so nothing typed or paged for one user is shown for the next.
  return (
    <Fragment key={user.id}>
      <UserQuotaDialog
        open={users.open === 'quota'}
        onOpenChange={closeDialog}
        userId={user.id}
        currentQuota={user.quota}
        onSuccess={users.triggerRefresh}
      />
      <UserGroupsDialog
        open={users.open === 'groups'}
        onOpenChange={closeDialog}
        user={user}
        onSuccess={users.triggerRefresh}
      />
      <UserApiKeysDialog
        open={users.open === 'api-keys'}
        onOpenChange={closeDialog}
        user={user}
        onSuccess={users.triggerRefresh}
      />
      <UserBindingDialog
        open={users.open === 'bindings'}
        onOpenChange={closeDialog}
        userId={user.id}
        onUnbindSuccess={users.triggerRefresh}
      />
      <UserSubscriptionsDialog
        open={users.open === 'subscriptions'}
        onOpenChange={closeDialog}
        user={user}
        onSuccess={users.triggerRefresh}
      />
      {users.open === 'recharge-history' && (
        <UserRechargeHistoryDialog user={user} onOpenChange={closeDialog} />
      )}
      <UserSecurityResetDialogs user={user} />
    </Fragment>
  )
}

/** Every dialog of the users page. */
export function UsersDialogs() {
  const users = useUsers()

  return (
    <>
      <UsersMutateDrawer
        open={users.open === 'create' || users.open === 'update'}
        onOpenChange={(isOpen) => !isOpen && users.setOpen(null)}
        currentRow={
          users.open === 'update' ? users.currentRow || undefined : undefined
        }
      />
      <UsersDeleteDialog />
      <UserRowDialogs />
    </>
  )
}
