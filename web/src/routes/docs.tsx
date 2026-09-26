import { createFileRoute } from '@tanstack/react-router'

import { UsageDocs } from '@/features/usage-docs'

export const Route = createFileRoute('/docs')({ component: UsageDocs })
