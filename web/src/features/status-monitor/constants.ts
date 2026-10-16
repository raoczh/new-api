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
/** The status monitor page always summarizes the last 7 days, in hours. */
export const STATUS_MONITOR_WINDOW_HOURS = 7 * 24

/** Poll interval so the page reflects availability changes while open. */
export const STATUS_MONITOR_REFETCH_INTERVAL_MS = 60 * 1000

/**
 * Fixed number of hourly cells per group card; the last is the current hour.
 * Must match perfmetrics.StatusHours on the backend.
 */
export const STATUS_MONITOR_HOURLY_CELLS = 60
