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

import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { getGroupStatus } from '../api'
import { STATUS_MONITOR_REFETCH_INTERVAL_MS } from '../constants'

export function useGroupStatus(hours: number) {
  const user = useAuthStore((state) => state.auth.user)
  return useQuery({
    queryKey: [
      'status-monitor',
      'groups',
      hours,
      user?.id ?? 0,
      user?.group ?? '',
    ],
    queryFn: async () => requireServerSuccess(await getGroupStatus(hours)),
    staleTime: STATUS_MONITOR_REFETCH_INTERVAL_MS,
    refetchInterval: STATUS_MONITOR_REFETCH_INTERVAL_MS,
    retry: false,
  })
}
