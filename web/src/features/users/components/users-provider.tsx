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
import { useQueryClient } from '@tanstack/react-query'
import React, { useCallback, useMemo, useState } from 'react'

import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import useDialogState from '@/hooks/use-dialog'

import { USERS_LIST_QUERY_KEY } from '../constants'
import type { User, UsersDialogType } from '../types'

/**
 * What the page can do. None of it ever changes, so the list and its rows can
 * use these without being rendered again each time a dialog opens or closes.
 */
type UsersActions = {
  setOpen: React.Dispatch<React.SetStateAction<UsersDialogType | null>>
  setCurrentRow: React.Dispatch<React.SetStateAction<User | null>>
  /** Opens one dialog for one user, or for no user when creating. */
  openDialog: (dialog: UsersDialogType, user: User | null) => void
  /** Reloads the user list after something about a user changed. */
  triggerRefresh: () => void
  /** Step-up ceremony shared by every risky user-management action. */
  requestVerification: ReturnType<
    typeof useSecureVerification
  >['requestVerification']
}

type UsersContextType = UsersActions & {
  open: UsersDialogType | null
  currentRow: User | null
  /** True while the step-up dialog is showing; confirm dialogs yield to it. */
  verificationActive: boolean
}

const UsersActionsContext = React.createContext<UsersActions | null>(null)
const UsersContext = React.createContext<UsersContextType | null>(null)

export function UsersProvider(props: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useDialogState<UsersDialogType>(null)
  const [currentRow, setCurrentRow] = useState<User | null>(null)
  // The dialog mounts once here; consumers only receive the proof token, and
  // the memoized value keeps dialog keystrokes from re-rendering the page.
  const verification = useSecureVerification()
  const requestVerification = verification.requestVerification
  const verificationActive = verification.isActive

  const openDialog = useCallback(
    (dialog: UsersDialogType, user: User | null) => {
      setCurrentRow(user)
      setOpen(dialog)
    },
    [setOpen]
  )

  const triggerRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: USERS_LIST_QUERY_KEY })
  }, [queryClient])

  const actions = useMemo(
    () => ({
      setOpen,
      setCurrentRow,
      openDialog,
      triggerRefresh,
      requestVerification,
    }),
    [setOpen, openDialog, triggerRefresh, requestVerification]
  )

  const value = useMemo(
    () => ({ ...actions, open, currentRow, verificationActive }),
    [actions, open, currentRow, verificationActive]
  )

  return (
    <UsersActionsContext value={actions}>
      <UsersContext value={value}>
        {props.children}
        <SecureVerificationDialog {...verification.dialogProps} />
      </UsersContext>
    </UsersActionsContext>
  )
}

/**
 * Dialog state together with the actions. Whoever reads it is rendered again
 * whenever a dialog opens, closes or changes user, so it is for the dialogs.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useUsers = () => {
  const usersContext = React.useContext(UsersContext)

  if (!usersContext) {
    throw new Error('useUsers has to be used within <UsersContext>')
  }

  return usersContext
}

/** The actions alone, for the list, its rows and the page buttons. */
// eslint-disable-next-line react-refresh/only-export-components
export const useUsersActions = () => {
  const usersActions = React.useContext(UsersActionsContext)

  if (!usersActions) {
    throw new Error('useUsersActions has to be used within <UsersContext>')
  }

  return usersActions
}
