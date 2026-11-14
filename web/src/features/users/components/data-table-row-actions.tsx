import { useNavigate } from '@tanstack/react-router'
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
import type { Row } from '@tanstack/react-table'
import {
  Pencil,
  Trash2,
  Power,
  PowerOff,
  ArrowUp,
  ArrowDown,
  KeyRound,
  Layers,
  ShieldAlert,
  Link2,
  CreditCard,
  History,
  ScrollText,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'

import { manageUser } from '../api'
import {
  USER_STATUS,
  USER_ROLE,
  ERROR_MESSAGES,
  isUserDeleted,
} from '../constants'
import { getUserActionMessage } from '../lib'
import type { ManageUserAction, User } from '../types'
import { useUsersActions } from './users-provider'

/** Status and role changes the row menu drives through /api/user/manage. */
type RowManageAction = Extract<
  ManageUserAction,
  'disable' | 'enable' | 'promote' | 'demote'
>

const MANAGE_ACTION_TITLES: Record<RowManageAction, string> = {
  disable: 'Verify to disable user',
  enable: 'Verify to enable user',
  promote: 'Verify to promote user',
  demote: 'Verify to demote user',
}

interface RowActionButtonProps {
  label: string
  onSelect: () => void
  disabled?: boolean
  children: React.ReactNode
}

/** One inline row action, so frequent operations need no menu round trip. */
function RowActionButton(props: RowActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={props.onSelect}
            disabled={props.disabled}
            aria-label={props.label}
          />
        }
      >
        {props.children}
      </TooltipTrigger>
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  )
}

interface DataTableRowActionsProps {
  row: Row<User>
}

/**
 * Buttons and menu of one list row. Every dialog they open is mounted once for
 * the whole page (see `UsersDialogs`), so a row holds no dialog of its own and
 * is not rendered again when one opens.
 */
export function DataTableRowActions(props: DataTableRowActionsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = props.row.original
  const users = useUsersActions()

  /** 直接带着用户名打开调用日志，支持排查时不用再手输一遍。 */
  const handleViewLogs = () => {
    void navigate({
      to: '/usage-logs/$section',
      params: { section: 'common' },
      search: { username: user.username },
    })
  }

  const handleManage = async (action: RowManageAction) => {
    try {
      const proof = await users.requestVerification({
        scope: 'admin.user.manage',
        context: { user_id: user.id, action },
        title: t(MANAGE_ACTION_TITLES[action]),
        description: t(
          'Confirm your identity before changing the account {{username}}.',
          { username: user.username }
        ),
      })
      if (!proof) return
      const result = await manageUser(user.id, action, proof.proof_token)
      if (result.success) {
        toast.success(t(getUserActionMessage(action)))
        users.triggerRefresh()
      } else {
        handleServerError(result, t('Failed to {{action}} user', { action }))
      }
    } catch (error) {
      handleServerError(
        AuthOperationError.from(error),
        t(ERROR_MESSAGES.UNEXPECTED)
      )
    }
  }

  const isDisabled = user.status === USER_STATUS.DISABLED
  const isAdmin = user.role >= USER_ROLE.ADMIN
  const isRoot = user.role === USER_ROLE.ROOT

  if (isUserDeleted(user)) {
    return null
  }

  return (
    <div className='-ml-1.5 flex items-center gap-1'>
      <RowActionButton
        label={t('Edit')}
        onSelect={() => users.openDialog('update', user)}
      >
        <Pencil />
      </RowActionButton>

      <RowActionButton
        label={t('Adjust Quota')}
        onSelect={() => users.openDialog('quota', user)}
      >
        <Wallet />
      </RowActionButton>

      <RowActionButton
        label={t('Groups')}
        onSelect={() => users.openDialog('groups', user)}
      >
        <Layers />
      </RowActionButton>

      <RowActionButton
        label={t('API Keys')}
        onSelect={() => users.openDialog('api-keys', user)}
      >
        <KeyRound />
      </RowActionButton>

      {isDisabled ? (
        <RowActionButton
          label={t('Enable')}
          onSelect={() => void handleManage('enable')}
        >
          <Power />
        </RowActionButton>
      ) : (
        <RowActionButton
          label={t('Disable')}
          onSelect={() => void handleManage('disable')}
          disabled={isRoot}
        >
          <PowerOff />
        </RowActionButton>
      )}

      <DataTableRowActionMenu
        ariaLabel={t('More actions')}
        contentClassName='w-48'
      >
        {isAdmin && !isRoot && (
          <DropdownMenuItem onClick={() => handleManage('demote')}>
            {t('Demote')}
            <DropdownMenuShortcut>
              <ArrowDown size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

        {!isAdmin && (
          <DropdownMenuItem onClick={() => handleManage('promote')}>
            {t('Promote')}
            <DropdownMenuShortcut>
              <ArrowUp size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => users.openDialog('bindings', user)}>
          {t('Manage Bindings')}
          <DropdownMenuShortcut>
            <Link2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => users.openDialog('subscriptions', user)}
        >
          {t('Manage Subscriptions')}
          <DropdownMenuShortcut>
            <CreditCard size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleViewLogs}>
          {t('View logs')}
          <DropdownMenuShortcut>
            <ScrollText size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => users.openDialog('recharge-history', user)}
        >
          {t('Recharge records')}
          <DropdownMenuShortcut>
            <History size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => users.openDialog('reset-passkey', user)}
          disabled={isRoot}
        >
          {t('Reset Passkey')}
          <DropdownMenuShortcut>
            <KeyRound size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => users.openDialog('reset-2fa', user)}
          disabled={isRoot}
        >
          {t('Reset 2FA')}
          <DropdownMenuShortcut>
            <ShieldAlert size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => users.openDialog('delete', user)}
          className='text-destructive focus:text-destructive'
          disabled={isRoot}
        >
          {t('Delete')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DataTableRowActionMenu>
    </div>
  )
}
