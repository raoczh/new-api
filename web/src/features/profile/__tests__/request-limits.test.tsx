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
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RequestLimitsCard } from '../components/request-limits-card'
import type { UserProfile } from '../types'

const profile: UserProfile = {
  id: 1,
  username: 'alice',
  display_name: 'Alice',
  role: 1,
  group: 'default',
  quota: 0,
  used_quota: 0,
  request_count: 0,
  status: 1,
  aff_count: 0,
  aff_quota: 0,
  aff_history_quota: 0,
  created_time: 0,
}

describe('request limits card', () => {
  it('shows both per-user limits returned by the profile API', () => {
    render(
      <RequestLimitsCard
        profile={{
          ...profile,
          max_concurrent_requests: 12,
          requests_per_minute: 600,
        }}
      />
    )
    expect(screen.getByText('Max concurrent requests')).toBeVisible()
    expect(screen.getByText('12')).toBeVisible()
    expect(screen.getByText('Requests per minute')).toBeVisible()
    expect(screen.getByText('600')).toBeVisible()
  })

  it('labels an unset limit as unlimited instead of showing zero', () => {
    render(
      <RequestLimitsCard
        profile={{
          ...profile,
          max_concurrent_requests: 0,
          requests_per_minute: 0,
        }}
      />
    )
    expect(screen.getAllByText('Unlimited')).toHaveLength(2)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
