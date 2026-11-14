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
import type {
  ChatCompletionRequest,
  Message,
  PlaygroundConfig,
} from '../../types'
import { formatMessageForAPI, isValidMessage } from '../message/message-utils'

/**
 * Build API request payload from messages and config.
 *
 * Sampling parameters (temperature, top_p, penalties, max_tokens, seed) are
 * left out on purpose: the chat no longer offers a way to change them, and
 * models that reject one of them would otherwise fail with no way out. Each
 * model answers with its own defaults.
 */
export function buildChatCompletionPayload(
  messages: Message[],
  config: PlaygroundConfig
): ChatCompletionRequest {
  // Filter and format valid messages
  const processedMessages = messages
    .filter(isValidMessage)
    .map(formatMessageForAPI)

  return {
    model: config.model,
    group: config.group,
    messages: processedMessages,
    stream: config.stream,
  }
}
