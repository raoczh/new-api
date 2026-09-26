import { createFileRoute } from '@tanstack/react-router'

import { Disclaimer } from '@/features/legal'

export const Route = createFileRoute('/disclaimer')({
  component: Disclaimer,
})
