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
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getChannel } from '@/features/channels/api'
import type { ChannelAffinityInfo } from '../types'

interface UsageLogsContextValue {
  selectedUserId: number | null
  setSelectedUserId: (userId: number | null) => void
  userInfoDialogOpen: boolean
  setUserInfoDialogOpen: (open: boolean) => void
  affinityTarget: ChannelAffinityInfo | null
  setAffinityTarget: (target: ChannelAffinityInfo | null) => void
  affinityDialogOpen: boolean
  setAffinityDialogOpen: (open: boolean) => void
  sensitiveVisible: boolean
  setSensitiveVisible: (visible: boolean) => void
  channelApiUrlMap: Record<number, string>
  loadChannelApiUrls: (channelIds: number[]) => void
}

const UsageLogsContext = createContext<UsageLogsContextValue | undefined>(
  undefined
)

export function UsageLogsProvider({ children }: { children: ReactNode }) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [userInfoDialogOpen, setUserInfoDialogOpen] = useState(false)
  const [affinityTarget, setAffinityTarget] =
    useState<ChannelAffinityInfo | null>(null)
  const [affinityDialogOpen, setAffinityDialogOpen] = useState(false)
  const [sensitiveVisible, setSensitiveVisible] = useState(true)

  const [channelApiUrlMap, setChannelApiUrlMap] = useState<
    Record<number, string>
  >({})
  const channelApiUrlMapRef = useRef(channelApiUrlMap)
  channelApiUrlMapRef.current = channelApiUrlMap
  const inflightChannelIdsRef = useRef<Set<number>>(new Set())

  const loadChannelApiUrls = useCallback((channelIds: number[]) => {
    const missingIds = Array.from(
      new Set(
        channelIds.filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0 &&
            channelApiUrlMapRef.current[id] === undefined &&
            !inflightChannelIdsRef.current.has(id)
        )
      )
    )
    if (missingIds.length === 0) return

    missingIds.forEach((id) => inflightChannelIdsRef.current.add(id))

    Promise.all(
      missingIds.map(async (id): Promise<[number, string]> => {
        try {
          const res = await getChannel(id)
          if (res?.success) {
            const baseUrl =
              typeof res.data?.base_url === 'string'
                ? res.data.base_url.trim()
                : ''
            return [id, baseUrl]
          }
        } catch {
          // ignore — leave entry as empty string so we don't refetch
        }
        return [id, '']
      })
    )
      .then((results) => {
        setChannelApiUrlMap((prev) => {
          const next = { ...prev }
          results.forEach(([id, baseUrl]) => {
            next[id] = baseUrl
          })
          return next
        })
      })
      .finally(() => {
        missingIds.forEach((id) => inflightChannelIdsRef.current.delete(id))
      })
  }, [])

  return (
    <UsageLogsContext.Provider
      value={{
        selectedUserId,
        setSelectedUserId,
        userInfoDialogOpen,
        setUserInfoDialogOpen,
        affinityTarget,
        setAffinityTarget,
        affinityDialogOpen,
        setAffinityDialogOpen,
        sensitiveVisible,
        setSensitiveVisible,
        channelApiUrlMap,
        loadChannelApiUrls,
      }}
    >
      {children}
    </UsageLogsContext.Provider>
  )
}

export function useUsageLogsContext() {
  const context = useContext(UsageLogsContext)
  if (!context) {
    throw new Error('useUsageLogsContext must be used within UsageLogsProvider')
  }
  return context
}
