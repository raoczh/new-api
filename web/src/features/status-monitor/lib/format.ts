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
export function formatLatencySeconds(ms: number | undefined): string {
  if (ms == null || ms <= 0) return '—'
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatHourRange(
  startTs: number,
  locales?: Intl.LocalesArgument
): string {
  const start = new Date(startTs * 1000)
  const end = new Date((startTs + 3600) * 1000)
  const fmt = new Intl.DateTimeFormat(locales, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${fmt.format(start)} — ${fmt.format(end)}`
}
