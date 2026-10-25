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
/** Trims each `model[effort]` entry so the stored pool stays canonical. */
export function normalizeIQModelList(value: string): string {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',')
}

const IQ_MODEL_PATTERN =
  /^[^\s@[\],]+(\[(none|minimal|low|medium|high|xhigh|max)\])?$/i

/** Returns the entries the backend would reject, mirroring ParseIQModelSpec. */
export function findInvalidIQModels(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && !IQ_MODEL_PATTERN.test(item))
}
