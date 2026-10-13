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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'

import { GroupMultiplierBadge } from '@/components/group-badge'
import { MultiSelect } from '@/components/multi-select'

test('selecting an option keeps its suffix visible in the chip and emits the original value', async () => {
  const onChange = vi.fn()
  function Fixture() {
    const [selected, setSelected] = useState<string[]>([])
    return (
      <MultiSelect
        options={[
          {
            value: 'free',
            label: 'free',
            suffix: <GroupMultiplierBadge ratio={0} />,
          },
          { value: 'legacy', label: 'legacy' },
        ]}
        selected={selected}
        onChange={(values) => {
          onChange(values)
          setSelected(values)
        }}
      />
    )
  }
  const user = userEvent.setup()
  render(<Fixture />)
  await user.click(screen.getByRole('combobox'))
  const free = screen.getByRole('option', { name: /free.*0x/ })
  expect(within(free).getByText('0x')).toBeVisible()
  expect(screen.getByRole('option', { name: 'legacy' })).toBeVisible()
  await user.click(free)
  expect(onChange).toHaveBeenLastCalledWith(['free'])
  await user.keyboard('{Escape}')
  expect(screen.getByText('0x')).toBeVisible()
})
