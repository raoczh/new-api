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
import { useMemo } from 'react'

import { getImageStudioConfig, getImageStudioModels } from '../api'
import { IMAGE_STUDIO_QUERY_KEYS } from '../constants'
import type { ImageStudioGroupOption, ImageStudioModelOption } from '../types'

export interface ImageStudioOptionModel extends ImageStudioModelOption {
  /** Group this model is being offered under. */
  group: string
}

export interface ImageStudioOptionGroup extends Omit<ImageStudioGroupOption, 'models'> {
  models: ImageStudioModelOption[]
}

export function useImageStudioConfig() {
  return useQuery({
    queryKey: IMAGE_STUDIO_QUERY_KEYS.config,
    queryFn: getImageStudioConfig,
    staleTime: 60_000,
  })
}

export function useImageStudioModels() {
  const query = useQuery({
    queryKey: IMAGE_STUDIO_QUERY_KEYS.models,
    queryFn: getImageStudioModels,
    staleTime: 60_000,
  })

  const groups = useMemo<ImageStudioOptionGroup[]>(() => {
    const source = query.data ?? []
    // The server already orders groups with the account's own group first and
    // sorts models by name, so no client-side re-sorting is needed.
    return source.map((group) => ({
      ...group,
      models: group.models ?? [],
    }))
  }, [query.data])

  const defaultSelection = useMemo(() => {
    for (const group of groups) {
      if (group.models.length > 0) {
        return { group: group.group, model: group.models[0].model }
      }
    }
    return { group: '', model: '' }
  }, [groups])

  return { ...query, groups, defaultSelection }
}
