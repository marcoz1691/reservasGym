import { afterEach, describe, expect, it, vi } from 'vitest'

const supabaseConfigured = vi.hoisted(() => ({ value: true }))
vi.mock('@/data/supabaseRepository', () => ({
  isSupabaseConfigured: () => supabaseConfigured.value,
}))

import { isOnlinePayEnabled, isOnlinePayEnvEnabled } from './onlinePay'

describe('isOnlinePayEnabled: ambiente × interruptor del admin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    supabaseConfigured.value = true
  })

  it.each([
    { env: '0', flag: false, expected: false },
    { env: '0', flag: true, expected: false },
    { env: '1', flag: false, expected: false },
    { env: '1', flag: true, expected: true },
  ])('VITE_ONLINE_PAYMENTS=$env y flag=$flag → $expected', ({ env, flag, expected }) => {
    vi.stubEnv('VITE_ONLINE_PAYMENTS', env)
    expect(isOnlinePayEnabled({ onlinePaymentsEnabled: flag })).toBe(expected)
  })

  it('sin dato en la base cuenta como apagado', () => {
    vi.stubEnv('VITE_ONLINE_PAYMENTS', '1')
    expect(isOnlinePayEnabled({})).toBe(false)
    expect(isOnlinePayEnabled(undefined)).toBe(false)
  })

  it('sin Supabase no hay pago en línea aunque todo lo demás esté encendido', () => {
    vi.stubEnv('VITE_ONLINE_PAYMENTS', '1')
    supabaseConfigured.value = false
    expect(isOnlinePayEnvEnabled()).toBe(false)
    expect(isOnlinePayEnabled({ onlinePaymentsEnabled: true })).toBe(false)
  })
})
