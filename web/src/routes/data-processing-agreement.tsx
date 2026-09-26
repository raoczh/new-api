import { createFileRoute } from '@tanstack/react-router'

import { DataProcessingAgreement } from '@/features/legal'

export const Route = createFileRoute('/data-processing-agreement')({
  component: DataProcessingAgreement,
})
