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
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getUserGroups, getUserModels } from '../api'
import {
  getGroupFallback,
  getModelFallback,
  getOptionLoadErrorMessage,
  shouldClearModelForGroup,
} from '../lib'
import type { GroupOption, ModelOption, PlaygroundConfig } from '../types'

type UsePlaygroundOptionsParams = {
  currentGroup: string
  currentModel: string
  /**
   * Model a link asked for. The group that serves it is looked up before the
   * usual fallback runs, so the chat does not open on a group without it.
   */
  linkedModel?: string
  setGroups: (groups: GroupOption[]) => void
  setModels: (models: ModelOption[]) => void
  updateConfig: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K],
    options?: { persist?: boolean }
  ) => void
}

// Lets the lookup of a linked model reuse lists the page has just loaded.
const LINKED_MODEL_LOOKUP_STALE_TIME = 60 * 1000

const groupsQueryOptions = {
  queryKey: ['playground-groups'],
  queryFn: async () => requireServerSuccess(await getUserGroups()),
}

function modelsQueryOptions(group: string) {
  return {
    queryKey: ['playground-models', group],
    queryFn: async () => requireServerSuccess(await getUserModels(group)),
  }
}

export function usePlaygroundOptions({
  currentGroup,
  currentModel,
  linkedModel,
  setGroups,
  setModels,
  updateConfig,
}: UsePlaygroundOptionsParams) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  // The group the page opened on: the link's own group or the stored one. It
  // is tried first, so a link that already names the right group costs nothing.
  const [openingGroup] = useState(currentGroup)
  // False until the linked model has a group, or the search gave up.
  const [isLinkedModelPlaced, setIsLinkedModelPlaced] = useState(!linkedModel)

  const {
    data: modelsData,
    error: modelsError,
    isError: isModelsError,
    isLoading: isLoadingModels,
  } = useQuery({
    ...modelsQueryOptions(currentGroup),
    enabled: currentGroup !== '',
  })

  const {
    data: groupsData,
    error: groupsError,
    isError: isGroupsError,
  } = useQuery(groupsQueryOptions)

  const linkedModelGroup = useQuery({
    queryKey: ['playground-linked-model-group', linkedModel, openingGroup],
    queryFn: async () => {
      const groups = await queryClient.fetchQuery({
        ...groupsQueryOptions,
        staleTime: LINKED_MODEL_LOOKUP_STALE_TIME,
      })
      const candidates = [
        openingGroup,
        ...groups.map((group) => group.value),
      ].filter(
        (group, index, all) =>
          all.indexOf(group) === index &&
          groups.some((option) => option.value === group)
      )
      for (const group of candidates) {
        const models = await queryClient.fetchQuery({
          ...modelsQueryOptions(group),
          staleTime: LINKED_MODEL_LOOKUP_STALE_TIME,
        })
        if (models.some((model) => model.value === linkedModel)) {
          return group
        }
      }
      return null
    },
    enabled: Boolean(linkedModel),
    staleTime: Infinity,
    // The group and model queries above report their own failures.
    meta: { errorToast: false },
  })

  useEffect(() => {
    if (!isModelsError) return

    handleServerError(
      modelsError,
      getOptionLoadErrorMessage(
        modelsError,
        t('Failed to load playground models')
      )
    )
  }, [isModelsError, modelsError, t])

  useEffect(() => {
    if (!isGroupsError) return

    handleServerError(
      groupsError,
      getOptionLoadErrorMessage(
        groupsError,
        t('Failed to load playground groups')
      )
    )
  }, [isGroupsError, groupsError, t])

  useEffect(() => {
    if (isLinkedModelPlaced || linkedModelGroup.isPending) return

    const group = linkedModelGroup.data
    if (group && group !== openingGroup) {
      // Follows the link only; the group the user chose for themselves stays stored.
      updateConfig('group', group, { persist: false })
    }
    if (group === null) {
      toast.info(
        t(
          '{{model}} cannot be used in chat here, so another model was selected.',
          { model: linkedModel }
        )
      )
    }
    setIsLinkedModelPlaced(true)
  }, [
    isLinkedModelPlaced,
    linkedModel,
    linkedModelGroup.data,
    linkedModelGroup.isPending,
    openingGroup,
    t,
    updateConfig,
  ])

  useEffect(() => {
    if (!modelsData) return

    setModels(modelsData)
    // Keep the linked model selected until its group is known: replacing it
    // now would lose it before the chat switches to the group that serves it.
    if (!isLinkedModelPlaced) return

    const fallback = getModelFallback(modelsData, currentModel)

    if (fallback) {
      updateConfig('model', fallback)
      return
    }

    if (shouldClearModelForGroup(modelsData, currentModel)) {
      updateConfig('model', '')
    }
  }, [modelsData, currentModel, isLinkedModelPlaced, setModels, updateConfig])

  useEffect(() => {
    if (!groupsData) return

    setGroups(groupsData)
    // The linked model decides the group first; falling back here would race it.
    if (!isLinkedModelPlaced) return

    const fallback = getGroupFallback(groupsData, currentGroup)

    if (fallback) {
      updateConfig('group', fallback)
    }
  }, [groupsData, currentGroup, isLinkedModelPlaced, setGroups, updateConfig])

  return {
    isLoadingModels,
    hasNoChatModels:
      currentGroup !== '' &&
      !isLoadingModels &&
      !isModelsError &&
      modelsData !== undefined &&
      modelsData.length === 0,
  }
}
