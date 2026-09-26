import { createFileRoute } from '@tanstack/react-router'

import { SupportedRegions } from '@/features/legal'

export const Route = createFileRoute('/supported-regions')({
  component: SupportedRegions,
})
