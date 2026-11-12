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
import { create } from 'zustand'

const DISMISSED_STORAGE_PREFIX = 'onboarding:tour-dismissed:'

function dismissedKey(userId: number): string {
  return `${DISMISSED_STORAGE_PREFIX}${userId}`
}

/** Whether this user already closed or finished the tour on this device. */
export function hasDismissedTour(userId: number): boolean {
  try {
    return window.localStorage.getItem(dismissedKey(userId)) === '1'
  } catch {
    // Without storage the answer cannot be remembered; do not nag every visit.
    return true
  }
}

function rememberDismissed(userId: number): void {
  try {
    window.localStorage.setItem(dismissedKey(userId), '1')
  } catch {
    // Private mode: the tour simply cannot be remembered.
  }
}

type OnboardingState = {
  /** Index of the step being shown, or null while the tour is closed. */
  step: number | null
  /** Opens the tour from its first step, also when it was dismissed before. */
  start: () => void
  next: () => void
  previous: () => void
  /** Closes the tour and remembers that this user has seen it. */
  finish: (userId: number | undefined) => void
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  step: null,
  start: () => set({ step: 0 }),
  next: () => set((state) => ({ step: (state.step ?? 0) + 1 })),
  previous: () =>
    set((state) => ({ step: Math.max(0, (state.step ?? 0) - 1) })),
  finish: (userId) => {
    if (userId !== undefined) rememberDismissed(userId)
    set({ step: null })
  },
}))
