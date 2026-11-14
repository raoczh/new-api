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
import { expect, test } from 'vitest'

import type { Message } from '../../../types'
import { buildChatCompletionPayload } from '../payload-builder'

const messages: Message[] = [
  {
    key: 'question',
    from: 'user',
    versions: [{ id: 'question-v1', content: 'Hello' }],
  },
  // A reply that is still loading has nothing to send yet.
  {
    key: 'pending-reply',
    from: 'assistant',
    versions: [{ id: 'pending-reply-v1', content: '' }],
  },
]

test('a chat request carries the model, group and messages without sampling parameters', () => {
  const payload = buildChatCompletionPayload(messages, {
    model: 'gpt-x',
    group: 'vip',
    stream: true,
  })

  // Models that reject temperature, top_p or penalties must stay usable now
  // that the chat has no parameter panel to switch them off.
  expect(payload).toEqual({
    model: 'gpt-x',
    group: 'vip',
    messages: [{ role: 'user', content: 'Hello' }],
    stream: true,
  })
})
