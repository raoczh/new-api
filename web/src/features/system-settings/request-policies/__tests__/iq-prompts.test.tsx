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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { IQPromptsSection } from '../iq-prompts-section'

const CONFIG = JSON.stringify({
  template: 'Draw a {{animal}} in {{scene}}, {{style}}, title {{code}}',
  animals: ['fox', 'cat'],
  scenes: ['space'],
  styles: ['pixel'],
})

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

afterEach(() => {
  cleanup()
  client.clear()
})

function show() {
  render(
    <QueryClientProvider client={client}>
      <IQPromptsSection value={CONFIG} />
    </QueryClientProvider>
  )
}

describe('IQ probe prompt settings', () => {
  it('shows the saved template and each word pool under its label', () => {
    show()
    expect(screen.getByLabelText('Prompt template')).toHaveValue(
      'Draw a {{animal}} in {{scene}}, {{style}}, title {{code}}'
    )
    expect(screen.getByLabelText(/Animals/)).toBeInTheDocument()
    expect(screen.getByText('fox')).toBeInTheDocument()
    expect(screen.getByText('cat')).toBeInTheDocument()
    expect(screen.getByText('space')).toBeInTheDocument()
    expect(screen.getByText('pixel')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('flags a template that drops the code placeholder', async () => {
    const user = userEvent.setup()
    show()
    const template = screen.getByLabelText('Prompt template')
    await user.clear(template)
    await user.type(template, 'Draw a fox')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Prompt template must contain {{code}}'
    )
    expect(template).toHaveAttribute('aria-invalid', 'true')
  })
})
