import { createFileRoute } from '@tanstack/react-router'

import { Compliance } from '@/features/legal'

export const Route = createFileRoute('/compliance')({
  component: Compliance,
})
