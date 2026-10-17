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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Image as ImageIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Main } from '@/components/layout'
import { isSidebarModuleEnabledForGuard } from '@/lib/nav-modules'

export const Route = createFileRoute('/_authenticated/workbench/image')({
  beforeLoad: async ({ context }) => {
    if (
      !(await isSidebarModuleEnabledForGuard(
        context.queryClient,
        'workbench',
        'image'
      ))
    ) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: ImageStudioPage,
})

function ImageStudioPage() {
  const { t } = useTranslation()
  return (
    <Main>
      <EmptyState
        icon={ImageIcon}
        title={t('Image Studio')}
        description={t('Image creation placeholder')}
        bordered
      />
    </Main>
  )
}
