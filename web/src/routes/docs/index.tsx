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

import { UsageDocs } from '@/features/usage-docs'

// Anchors of the former single-page docs, so bookmarked links such as
// /docs#cc-switch land on the page that now holds that content.
const LEGACY_ANCHORS: Record<string, string> = {
  'cc-switch': 'config/ccswitch',
  'cc-switch-import': 'config/ccswitch',
  'cc-switch-manual': 'config/ccswitch',
  'claude-code': 'config/claude-code',
  codex: 'config/codex',
  'codex-sign-in': 'config/codex',
  'codex-config': 'config/codex',
  editors: 'config/office',
  workbuddy: 'config/office',
  'client-settings': 'config/office',
  trae: 'config/ide',
  account: 'apikey',
  'create-key': 'apikey',
  redeem: 'guides/billing',
  'quick-start': 'quickstart',
  'three-fields': 'quickstart',
  'first-request': 'quickstart',
  'sdk-example': 'quickstart',
  'other-protocols': 'api/index',
  troubleshooting: 'guides/error-handling',
  'diagnostic-order': 'guides/error-handling',
  'contact-support': 'guides/error-handling',
  errors: 'api/errors',
}

export const Route = createFileRoute('/docs/')({
  beforeLoad: ({ location }) => {
    const slug = LEGACY_ANCHORS[location.hash]
    if (slug) {
      throw redirect({ to: '/docs/$', params: { _splat: slug }, replace: true })
    }
  },
  component: UsageDocs,
})
