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
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { formatQuota } from '@/lib/format'

import { useClipboardRedemption } from '../../hooks/use-clipboard-redemption'
import { isClipboardRedemptionCode } from '../../lib/redemption'
import { ClipboardRedemptionDialog } from '../dialogs/clipboard-redemption-dialog'
import { RedemptionCodeCard } from '../redemption-code-card'

describe('redemption flow', () => {
  test('accepts only 32-character lowercase alphanumeric clipboard codes', () => {
    expect(isClipboardRedemptionCode('a1'.repeat(16))).toBe(true)
    expect(isClipboardRedemptionCode(` ${'a1'.repeat(16)}\n`)).toBe(true)
    expect(isClipboardRedemptionCode('A1'.repeat(16))).toBe(false)
    expect(isClipboardRedemptionCode('a1'.repeat(15))).toBe(false)
    expect(isClipboardRedemptionCode(`${'a1'.repeat(16)}-`)).toBe(false)
  })

  test('keeps manual redemption available as a direct action', async () => {
    const user = userEvent.setup()
    const onCodeChange = vi.fn()
    const onRedeem = vi.fn()
    render(
      <RedemptionCodeCard
        enabled
        code=''
        onCodeChange={onCodeChange}
        onRedeem={onRedeem}
        redeeming={false}
      />
    )

    const input = screen.getByRole('textbox', {
      name: 'Enter your redemption code',
    })
    await user.type(input, 'a1'.repeat(16))
    await user.click(screen.getByRole('button', { name: 'Redeem' }))

    expect(onCodeChange).toHaveBeenCalled()
    expect(onRedeem).toHaveBeenCalledOnce()
  })

  test('shows the detected quota before confirmation', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ClipboardRedemptionDialog
        open
        onOpenChange={vi.fn()}
        code={'a1'.repeat(16)}
        quota={42}
        processing={false}
        onConfirm={onConfirm}
      />
    )

    expect(screen.getByRole('alertdialog')).toHaveTextContent(formatQuota(42))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Redeem this code' })
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Redeem this code' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  test('blocks cancellation and duplicate confirmation while redeeming', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn()
    render(
      <ClipboardRedemptionDialog
        open
        onOpenChange={onOpenChange}
        code={'a1'.repeat(16)}
        quota={500000}
        processing
        onConfirm={onConfirm}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Redeem this code' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Keep code' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  test('hides the redemption action when redemption is disabled', () => {
    render(
      <RedemptionCodeCard
        enabled={false}
        code=''
        onCodeChange={vi.fn()}
        onRedeem={vi.fn()}
        redeeming={false}
      />
    )
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Redeem' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeVisible()
  })
})

describe('clipboard redemption preview', () => {
  const code = 'a1'.repeat(16)
  const originalClipboard = Object.getOwnPropertyDescriptor(
    navigator,
    'clipboard'
  )
  const readText = vi.fn<() => Promise<string>>()

  beforeEach(() => {
    vi.useFakeTimers()
    readText.mockReset().mockResolvedValue(code)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText },
    })
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard)
    } else {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  test('previews a valid code without redeeming and does not prompt again after dismissal', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { success: true, data: 500000 } })
    const { result } = renderHook(() => useClipboardRedemption(true, false))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.redemption).toEqual({ code, quota: 500000 })
    expect(post).toHaveBeenCalledExactlyOnceWith(
      '/api/user/topup/check',
      { key: code },
      expect.any(Object)
    )

    act(() => result.current.dismiss())
    await act(() => vi.advanceTimersByTimeAsync(6000))
    expect(result.current.redemption).toBeNull()
    expect(post).toHaveBeenCalledOnce()

    readText.mockResolvedValue('b2'.repeat(16))
    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(result.current.redemption?.code).toBe('b2'.repeat(16))
  })

  test('keeps the displayed code and amount stable when another code is copied', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { success: true, data: 500000 } })
    const { result } = renderHook(() => useClipboardRedemption(true, false))
    await act(() => vi.advanceTimersByTimeAsync(0))
    readText.mockResolvedValue('b2'.repeat(16))
    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(result.current.redemption).toEqual({ code, quota: 500000 })
    expect(post).toHaveBeenCalledOnce()
  })

  test('does not send unrelated clipboard contents and ignores invalid codes', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { success: false } })
    readText.mockResolvedValue('ordinary private clipboard text')
    const { result } = renderHook(() => useClipboardRedemption(true, false))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(post).not.toHaveBeenCalled()
    readText.mockResolvedValue(code)
    await act(() => vi.advanceTimersByTimeAsync(6000))
    expect(post).toHaveBeenCalledExactlyOnceWith(
      '/api/user/topup/check',
      { key: code },
      expect.any(Object)
    )
    expect(result.current.redemption).toBeNull()
  })

  test('waits while redemption is disabled or another payment is in progress', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { success: true, data: 500000 } })
    const { result, rerender } = renderHook(
      ({ enabled, paused }) => useClipboardRedemption(enabled, paused),
      { initialProps: { enabled: false, paused: false } }
    )
    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(readText).not.toHaveBeenCalled()
    rerender({ enabled: true, paused: true })
    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(post).not.toHaveBeenCalled()
    rerender({ enabled: true, paused: false })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.redemption).toEqual({ code, quota: 500000 })
  })

  test('accepts an explicit paste when the browser denies automatic clipboard reads', async () => {
    readText.mockRejectedValue(
      new DOMException('Not allowed', 'NotAllowedError')
    )
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { success: true, data: 500000 } })
    const { result } = renderHook(() => useClipboardRedemption(true, false))
    await act(() => vi.advanceTimersByTimeAsync(6000))
    expect(readText).toHaveBeenCalledOnce()
    expect(post).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.paste(document, { clipboardData: { getData: () => code } })
    })
    expect(result.current.redemption).toEqual({ code, quota: 500000 })
  })

  test('retries a purchased code after a transient network failure', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ data: { success: true, data: 500000 } })
    const { result } = renderHook(() => useClipboardRedemption(true, false))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.redemption).toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(30000))
    expect(result.current.redemption).toEqual({ code, quota: 500000 })
    expect(post).toHaveBeenCalledTimes(2)
  })

  test('discards a pending check when redemption becomes unavailable', async () => {
    type CheckResponse = { data: { success: boolean; data: number } }
    let resolveCheck!: (value: CheckResponse) => void
    const pending = new Promise<CheckResponse>((resolve) => {
      resolveCheck = resolve
    })
    vi.spyOn(api, 'post').mockReturnValue(pending)
    const { result, rerender } = renderHook(
      ({ enabled }) => useClipboardRedemption(enabled, false),
      { initialProps: { enabled: true } }
    )
    await act(() => vi.advanceTimersByTimeAsync(0))
    rerender({ enabled: false })
    await act(async () =>
      resolveCheck({ data: { success: true, data: 500000 } })
    )
    expect(result.current.redemption).toBeNull()
  })
})
