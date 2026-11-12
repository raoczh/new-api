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

/** Attribute marking an element the tour can point at. */
export const TOUR_TARGET_ATTRIBUTE = 'data-tour'

export const TOUR_TARGETS = {
  keysNav: 'nav-keys',
  createKey: 'create-key',
  playgroundNav: 'nav-playground',
} as const

export type TourTarget = (typeof TOUR_TARGETS)[keyof typeof TOUR_TARGETS]

export type TourStep = {
  id: string
  /** i18n key of the step title. */
  title: string
  /** i18n key of the step explanation. */
  description: string
  /**
   * Element the step points at. A step without a target is shown in the
   * middle of the screen.
   */
  target?: TourTarget
  /**
   * The step is completed by using the highlighted element itself (following
   * a link or opening a dialog), so it offers no "Next" button.
   */
  advanceOnTargetClick?: boolean
}

/**
 * First-run tour for a regular user. It walks to the one action that makes
 * the product usable (creating an API key) and then to the place where the
 * key can be used without writing any code.
 */
export const USER_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome! Let us get you started',
    description:
      'It takes about a minute. You will create an API key, which is all you need to use every model here.',
  },
  {
    id: 'open-keys',
    title: 'Open API Keys',
    description:
      'An API key is your personal pass to the models. Click here to manage your keys.',
    target: TOUR_TARGETS.keysNav,
    advanceOnTargetClick: true,
  },
  {
    id: 'create-key',
    title: 'Create your first key',
    description:
      'Click here, pick the model vendor you want, and confirm. The defaults work for most people.',
    target: TOUR_TARGETS.createKey,
    advanceOnTargetClick: true,
  },
  {
    id: 'try-it',
    title: 'Try a model right away',
    description:
      'No code needed: open the Playground and send a message with the key you just created. Calls are paid from your balance, so top up in Wallet if it is empty.',
    target: TOUR_TARGETS.playgroundNav,
    advanceOnTargetClick: true,
  },
]

export function tourTargetSelector(target: TourTarget): string {
  return `[${TOUR_TARGET_ATTRIBUTE}="${target}"]`
}

/**
 * Whether the tour should open by itself: only for a user who has no API key
 * yet and has not closed the tour before.
 */
export function shouldAutoStartTour(state: {
  keyCount: number | undefined
  dismissed: boolean
}): boolean {
  return state.keyCount === 0 && !state.dismissed
}
