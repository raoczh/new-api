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
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getApiKeys } from '@/features/keys/api'
import { useAuthStore } from '@/stores/auth-store'

import {
  shouldAutoStartTour,
  tourTargetSelector,
  USER_TOUR_STEPS,
  type TourStep,
} from '../lib/tour-steps'
import { hasDismissedTour, useOnboardingStore } from '../store'

const SPOTLIGHT_PADDING = 6
const CARD_GAP = 12
const CARD_WIDTH = 320
const VIEWPORT_MARGIN = 12

type Rect = { top: number; left: number; width: number; height: number }

/**
 * Follow the highlighted element as the page lays out, scrolls or resizes.
 * The element may not exist yet (the step can point at a page the user is
 * still navigating to), so the DOM is watched until it appears.
 */
function useTargetRect(step: TourStep | undefined): {
  element: HTMLElement | null
  rect: Rect | null
} {
  const [state, setState] = useState<{
    element: HTMLElement | null
    rect: Rect | null
  }>({ element: null, rect: null })
  const target = step?.target

  useLayoutEffect(() => {
    if (!target) {
      setState({ element: null, rect: null })
      return
    }
    const measure = () => {
      const element = [
        ...document.querySelectorAll<HTMLElement>(tourTargetSelector(target)),
      ].find((candidate) => candidate.getClientRects().length > 0)
      if (!element) {
        setState((previous) =>
          previous.element === null ? previous : { element: null, rect: null }
        )
        return
      }
      const box = element.getBoundingClientRect()
      setState((previous) => {
        const same =
          previous.element === element &&
          previous.rect?.top === box.top &&
          previous.rect.left === box.left &&
          previous.rect.width === box.width &&
          previous.rect.height === box.height
        return same
          ? previous
          : {
              element,
              rect: {
                top: box.top,
                left: box.left,
                width: box.width,
                height: box.height,
              },
            }
      })
    }
    measure()
    const observer = new MutationObserver(measure)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [target])

  return state
}

/** Place the card beside the highlighted element, kept inside the viewport. */
function getCardPosition(
  rect: Rect | null,
  cardHeight: number
): { top: number; left: number } | null {
  if (!rect) return null
  const width = Math.min(CARD_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
  const clampLeft = (left: number) =>
    Math.min(
      Math.max(VIEWPORT_MARGIN, left),
      window.innerWidth - width - VIEWPORT_MARGIN
    )
  const clampTop = (top: number) =>
    Math.min(
      Math.max(VIEWPORT_MARGIN, top),
      Math.max(
        VIEWPORT_MARGIN,
        window.innerHeight - cardHeight - VIEWPORT_MARGIN
      )
    )

  const right = rect.left + rect.width + SPOTLIGHT_PADDING + CARD_GAP
  if (right + width + VIEWPORT_MARGIN <= window.innerWidth) {
    return { top: clampTop(rect.top), left: right }
  }
  const below = rect.top + rect.height + SPOTLIGHT_PADDING + CARD_GAP
  if (below + cardHeight + VIEWPORT_MARGIN <= window.innerHeight) {
    return { top: below, left: clampLeft(rect.left + rect.width - width) }
  }
  return {
    top: clampTop(rect.top - SPOTLIGHT_PADDING - CARD_GAP - cardHeight),
    left: clampLeft(rect.left + rect.width - width),
  }
}

/**
 * First-run tour. It opens by itself for a user without any API key who has
 * not closed it before, and can be reopened from the help menu at any time.
 */
export function OnboardingTour() {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const stepIndex = useOnboardingStore((state) => state.step)
  const start = useOnboardingStore((state) => state.start)
  const next = useOnboardingStore((state) => state.next)
  const previous = useOnboardingStore((state) => state.previous)
  const finish = useOnboardingStore((state) => state.finish)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardHeight, setCardHeight] = useState(0)

  const dismissed = userId === undefined ? true : hasDismissedTour(userId)
  const keyCountQuery = useQuery({
    queryKey: ['onboarding', 'key-count', userId],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 1 })
      if (!result.success) throw new Error(result.message)
      return result.data?.total ?? 0
    },
    enabled: userId !== undefined && !dismissed,
    staleTime: Infinity,
    retry: false,
    // The tour is optional; a failed probe just leaves it closed.
    meta: { errorToast: false },
  })

  useEffect(() => {
    if (shouldAutoStartTour({ keyCount: keyCountQuery.data, dismissed })) {
      start()
    }
  }, [keyCountQuery.data, dismissed, start])

  const step = stepIndex === null ? undefined : USER_TOUR_STEPS[stepIndex]
  const isLast = stepIndex === USER_TOUR_STEPS.length - 1
  const { element, rect } = useTargetRect(step)

  // Using the highlighted control is what completes an interactive step.
  useEffect(() => {
    if (!element || !step?.advanceOnTargetClick) return
    const handleClick = () => {
      if (isLast) finish(userId)
      else next()
    }
    element.addEventListener('click', handleClick)
    return () => element.removeEventListener('click', handleClick)
  }, [element, step, isLast, finish, next, userId])

  useLayoutEffect(() => {
    setCardHeight(cardRef.current?.offsetHeight ?? 0)
  }, [stepIndex, rect])

  useEffect(() => {
    if (stepIndex === null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(userId)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [stepIndex, finish, userId])

  useEffect(() => {
    if (stepIndex !== null) cardRef.current?.focus()
  }, [stepIndex])

  if (stepIndex === null || !step) return null

  // A step that points at something not on screen yet (for example while the
  // sidebar is collapsed on a phone) is shown centred instead of hidden.
  const position = getCardPosition(rect, cardHeight)
  const waitingForClick = step.advanceOnTargetClick && rect !== null

  return createPortal(
    <div data-slot='onboarding-tour'>
      {rect ? (
        <div
          aria-hidden='true'
          data-slot='onboarding-spotlight'
          className='ring-primary pointer-events-none fixed z-[60] rounded-lg shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] ring-2 transition-[top,left,width,height] duration-150 motion-reduce:transition-none'
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      ) : (
        <div
          aria-hidden='true'
          data-slot='onboarding-backdrop'
          className='fixed inset-0 z-[60] bg-black/55'
        />
      )}
      <div
        ref={cardRef}
        role='dialog'
        aria-modal='false'
        aria-labelledby='onboarding-tour-title'
        aria-describedby='onboarding-tour-description'
        tabIndex={-1}
        className='bg-popover text-popover-foreground ring-foreground/10 fixed z-[61] flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-3 rounded-xl p-4 shadow-xl ring-1 outline-none'
        style={
          position ?? {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }
        }
      >
        <div className='flex items-start justify-between gap-3'>
          <h2 id='onboarding-tour-title' className='text-base font-semibold'>
            {t(step.title)}
          </h2>
          <Button
            variant='ghost'
            size='icon-sm'
            className='-mt-1 -mr-1 shrink-0'
            aria-label={t('Close guide')}
            onClick={() => finish(userId)}
          >
            <X aria-hidden='true' />
          </Button>
        </div>
        <p
          id='onboarding-tour-description'
          className='text-muted-foreground text-sm leading-relaxed'
        >
          {t(step.description)}
        </p>
        <div className='flex items-center justify-between gap-3'>
          <span className='text-muted-foreground text-xs tabular-nums'>
            {t('Step {{current}} of {{total}}', {
              current: stepIndex + 1,
              total: USER_TOUR_STEPS.length,
            })}
          </span>
          <div className='flex items-center gap-2'>
            {stepIndex === 0 ? (
              <Button variant='ghost' size='sm' onClick={() => finish(userId)}>
                {t('Skip')}
              </Button>
            ) : (
              <Button variant='ghost' size='sm' onClick={previous}>
                {t('Back')}
              </Button>
            )}
            {waitingForClick ? (
              <span className='text-primary text-xs font-medium'>
                {t('Click the highlighted button')}
              </span>
            ) : (
              <Button
                size='sm'
                onClick={() => (isLast ? finish(userId) : next())}
              >
                {isLast ? t('Got it') : t('Next')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
