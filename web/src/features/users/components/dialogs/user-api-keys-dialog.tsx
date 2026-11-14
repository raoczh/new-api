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
import { useQuery } from '@tanstack/react-query'
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTablePagination, DataTableView } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  ApiKeyGroupCombobox,
  type ApiKeyGroupOption,
} from '@/features/keys/components/api-key-group-combobox'
import { API_KEY_STATUS, API_KEY_STATUSES } from '@/features/keys/constants'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'
import { useSystemConfigStore } from '@/stores/system-config-store'

import {
  deleteUserApiKey,
  getUserApiKeys,
  getUserGroups,
  setUserApiKeyGroup,
  setUserApiKeyStatus,
} from '../../api'
import { ERROR_MESSAGES } from '../../constants'
import type { AdminUserApiKey } from '../../types'
import { useUsers } from '../users-provider'

interface UserApiKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: number; username: string } | null
  onSuccess?: () => void
}

const PAGE_SIZE = 10

/**
 * Administrator view of one user's API keys. Keys are shown masked. A key can
 * be moved to another group the user may use, switched on or off, or deleted;
 * deleting is a separate, step-up verified action.
 */
export function UserApiKeysDialog(props: UserApiKeysDialogProps) {
  const { t } = useTranslation()
  const { requestVerification, verificationActive } = useUsers()
  useSystemConfigStore((state) => state.config.currency)
  const [pageIndex, setPageIndex] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<AdminUserApiKey | null>(
    null
  )
  const [busyKeyId, setBusyKeyId] = useState<number | null>(null)

  const userId = props.user?.id ?? 0
  const username = props.user?.username ?? ''
  const keys = useQuery({
    queryKey: ['users', userId, 'api-keys', pageIndex],
    enabled: props.open && userId > 0,
    queryFn: async () =>
      requireServerSuccess(
        await getUserApiKeys(userId, pageIndex + 1, PAGE_SIZE)
      ),
  })

  // A key can only be moved to a group its owner may use, so the choices come
  // from that user's groups rather than from the administrator's own.
  const userGroups = useQuery({
    queryKey: ['users', userId, 'groups'],
    enabled: props.open && userId > 0,
    queryFn: async () => requireServerSuccess(await getUserGroups(userId)),
  })
  const groupOptions: ApiKeyGroupOption[] = [
    { value: '', label: t('Follow user group') },
    ...(userGroups.data?.data?.groups ?? [])
      .filter((item) => item.usable && (item.has_ratio || item.name === 'auto'))
      .map((item) => ({
        value: item.name,
        label: item.name,
        desc: item.desc,
        ratio: item.has_ratio ? item.ratio : undefined,
      })),
  ]

  const handleGroupChange = async (apiKey: AdminUserApiKey, group: string) => {
    if (group === (apiKey.group || '')) return
    setBusyKeyId(apiKey.id)
    try {
      const result = await setUserApiKeyGroup(userId, apiKey.id, group)
      if (result.success) {
        toast.success(
          t('Group changed to {{group}}', {
            group: group || t('Follow user group'),
          })
        )
        void keys.refetch()
        props.onSuccess?.()
      } else {
        handleServerError(
          result,
          t('Failed to change the group of the API key')
        )
      }
    } catch (error) {
      handleServerError(
        AuthOperationError.from(error),
        t(ERROR_MESSAGES.UNEXPECTED)
      )
    } finally {
      setBusyKeyId(null)
    }
  }

  const handleToggleStatus = async (apiKey: AdminUserApiKey) => {
    const nextStatus =
      apiKey.status === API_KEY_STATUS.ENABLED
        ? API_KEY_STATUS.DISABLED
        : API_KEY_STATUS.ENABLED
    setBusyKeyId(apiKey.id)
    try {
      const result = await setUserApiKeyStatus(userId, apiKey.id, nextStatus)
      if (result.success) {
        toast.success(
          nextStatus === API_KEY_STATUS.ENABLED
            ? t('API key enabled')
            : t('API key disabled')
        )
        void keys.refetch()
        props.onSuccess?.()
      } else {
        handleServerError(result, t('Failed to update API key status'))
      }
    } catch (error) {
      handleServerError(
        AuthOperationError.from(error),
        t(ERROR_MESSAGES.UNEXPECTED)
      )
    } finally {
      setBusyKeyId(null)
    }
  }

  const handleDelete = async () => {
    const apiKey = pendingDelete
    if (!apiKey) return
    try {
      const proof = await requestVerification({
        scope: 'admin.user.manage',
        context: { user_id: userId, action: 'token_delete' },
        title: t('Verify to delete API key'),
        description: t(
          'Confirm your identity before changing the account {{username}}.',
          { username }
        ),
      })
      if (!proof) return
      const result = await deleteUserApiKey(
        userId,
        apiKey.id,
        proof.proof_token
      )
      if (result.success) {
        toast.success(t('API key deleted'))
        void keys.refetch()
        props.onSuccess?.()
      } else {
        handleServerError(result, t('Failed to delete API key'))
      }
    } catch (error) {
      handleServerError(
        AuthOperationError.from(error),
        t(ERROR_MESSAGES.UNEXPECTED)
      )
    } finally {
      setPendingDelete(null)
    }
  }

  const columns: ColumnDef<AdminUserApiKey>[] = [
    {
      accessorKey: 'name',
      header: t('Name'),
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.name || '-'}</span>
      ),
    },
    {
      id: 'key',
      header: t('API Key'),
      cell: ({ row }) => (
        <span className='text-muted-foreground font-mono text-xs'>
          {row.original.key || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => {
        const statusConfig = API_KEY_STATUSES[row.original.status]
        if (!statusConfig) return <span>-</span>
        return (
          <StatusBadge
            label={t(statusConfig.label)}
            variant={statusConfig.variant}
            copyable={false}
          />
        )
      },
    },
    {
      accessorKey: 'group',
      header: t('Group'),
      cell: ({ row }) => (
        <ApiKeyGroupCombobox
          options={groupOptions}
          value={row.original.group || ''}
          onValueChange={(group) => void handleGroupChange(row.original, group)}
          disabled={busyKeyId === row.original.id || !userGroups.isSuccess}
          contentClassName='min-w-72'
          trigger={
            <Button
              type='button'
              variant='outline'
              size='sm'
              aria-label={t('Change group for {{name}}', {
                name: row.original.name,
              })}
              className='h-7 max-w-48 justify-between gap-1.5 px-2 text-xs font-normal'
            >
              <span className='truncate'>
                {row.original.group || t('Follow user group')}
              </span>
              <ChevronsUpDown
                aria-hidden='true'
                className='text-muted-foreground size-3.5 shrink-0'
              />
            </Button>
          }
        />
      ),
    },
    {
      id: 'quota',
      header: t('Quota'),
      cell: ({ row }) => (
        <span className='text-sm tabular-nums'>
          {row.original.unlimited_quota
            ? t('Unlimited')
            : String(row.original.remain_quota)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('Actions'),
      cell: ({ row }) => {
        const apiKey = row.original
        const isEnabled = apiKey.status === API_KEY_STATUS.ENABLED
        return (
          <div className='flex items-center gap-1'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='h-7 px-2 text-xs'
              disabled={busyKeyId === apiKey.id}
              onClick={() => void handleToggleStatus(apiKey)}
            >
              {isEnabled ? t('Disable') : t('Enable')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='text-destructive h-7 px-2 text-xs'
              disabled={busyKeyId === apiKey.id}
              onClick={() => setPendingDelete(apiKey)}
            >
              {t('Delete')}
            </Button>
          </div>
        )
      },
    },
  ]

  const items = keys.data?.data?.items ?? []
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (apiKey) => String(apiKey.id),
    manualPagination: true,
    rowCount: keys.data?.data?.total ?? 0,
    state: { pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize: PAGE_SIZE })
          : updater
      setPageIndex(next.pageIndex)
    },
  })

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={t('API keys of {{username}}', { username })}
        description={t(
          'Keys belong to this user. Changing the group, disabling or deleting a key takes effect on its next request.'
        )}
        contentClassName='sm:max-w-5xl'
        bodyClassName='space-y-4'
        footer={keys.isSuccess && <DataTablePagination table={table} compact />}
      >
        {keys.isPending && <LoadingState />}
        {keys.isError && (
          <ErrorState
            title={t('Failed to load API keys')}
            description={getServerErrorMessage(keys.error)}
            onRetry={() => void keys.refetch()}
          />
        )}
        {keys.isSuccess && (
          <DataTableView
            table={table}
            tableClassName='min-w-[720px]'
            emptyTitle={t('This user has no API keys yet')}
            emptyDescription={t(
              'Ask the user to create one from their own API keys page, or use their existing key for support checks.'
            )}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete && !verificationActive}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('Delete API key')}
        desc={t(
          'Delete the API key {{name}} of {{username}}? Requests using it will start failing immediately and it cannot be restored.',
          { name: pendingDelete?.name || '', username }
        )}
        confirmText={t('Delete')}
        destructive
        handleConfirm={() => void handleDelete()}
      />
    </>
  )
}
