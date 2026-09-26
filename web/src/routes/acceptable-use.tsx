import { createFileRoute } from '@tanstack/react-router'

import { AcceptableUse } from '@/features/legal'

export const Route = createFileRoute('/acceptable-use')({
  component: AcceptableUse,
})
