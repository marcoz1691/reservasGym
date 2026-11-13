import { describe, expect, it } from 'vitest'
import { STAFF_IDLE_LIMIT_MS, hasIdleLimit, idleLimitMs, isIdleExpired } from './idleLogout'

describe('cierre de sesión por inactividad', () => {
  it('admin y recepción 30 minutos, socio 5 minutos', () => {
    expect(idleLimitMs('admin')).toBe(30 * 60 * 1000)
    expect(idleLimitMs('staff')).toBe(30 * 60 * 1000)
    expect(idleLimitMs('member')).toBe(5 * 60 * 1000)
    expect(hasIdleLimit(null)).toBe(false)
  })

  it('el límite es de 30 minutos', () => {
    expect(STAFF_IDLE_LIMIT_MS).toBe(30 * 60 * 1000)
  })

  it('vence justo al cumplir 30 minutos sin uso', () => {
    const t0 = Date.UTC(2026, 10, 12, 9, 0)
    expect(isIdleExpired(t0, t0 + 29 * 60 * 1000 + 59_000)).toBe(false)
    expect(isIdleExpired(t0, t0 + 30 * 60 * 1000)).toBe(true)
    expect(isIdleExpired(t0, t0 + 5 * 60 * 60 * 1000)).toBe(true)
  })
})
