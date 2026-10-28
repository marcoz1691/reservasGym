import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useOnlineStatus } from './network'

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value })
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

describe('useOnlineStatus', () => {
  afterEach(() => setOnline(true))

  it('sigue los eventos online/offline del navegador', () => {
    setOnline(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => setOnline(false))
    expect(result.current).toBe(false)

    act(() => setOnline(true))
    expect(result.current).toBe(true)
  })
})
