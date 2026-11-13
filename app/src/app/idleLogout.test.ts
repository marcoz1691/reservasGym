import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { User } from '@/domain/models'
import {
  clearStaffActivity,
  idleLogoutNoticeMinutes,
  clearIdleLogoutNotice,
  useIdleLogout,
} from './idleLogout'

const MIN = 60 * 1000
const admin = { id: 'u_admin', role: 'admin' } as User
const member = { id: 'u_socio', role: 'member' } as User

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-12T09:00:00-05:00'))
    clearStaffActivity()
    clearIdleLogoutNotice()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('cierra la sesión del admin tras 30 minutos sin uso y deja el aviso', () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useIdleLogout(admin, signOut))
    act(() => vi.advanceTimersByTime(29 * MIN))
    expect(signOut).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1.5 * MIN))
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(idleLogoutNoticeMinutes()).toBe(30)
  })

  it('la actividad reinicia el conteo', () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useIdleLogout(admin, signOut))
    act(() => vi.advanceTimersByTime(20 * MIN))
    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
    })
    act(() => vi.advanceTimersByTime(20 * MIN))
    expect(signOut).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(11 * MIN))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('al reabrir la app después de 30 minutos cierra de inmediato', () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    const first = renderHook(() => useIdleLogout(admin, signOut))
    first.unmount()
    vi.setSystemTime(Date.now() + 45 * MIN)
    renderHook(() => useIdleLogout(admin, signOut))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('al socio le cierra la sesión tras 5 minutos sin uso', () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useIdleLogout(member, signOut))
    act(() => vi.advanceTimersByTime(4 * MIN))
    expect(signOut).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1.5 * MIN))
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(idleLogoutNoticeMinutes()).toBe(5)
  })

  it('sin usuario no hace nada', () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useIdleLogout(null, signOut))
    act(() => vi.advanceTimersByTime(60 * MIN))
    expect(signOut).not.toHaveBeenCalled()
  })
})
