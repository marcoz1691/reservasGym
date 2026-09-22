import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseRepository } from './supabaseRepository'
import {
  isBiometricsEnabled,
  readBiometricSession,
  saveBiometricSession,
} from '@/lib/biometrics'

const profile = {
  id: 'user_member',
  email: 'socio@gym.local',
  full_name: 'Ana Socio',
  role: 'member',
  created_at: '2026-01-01T00:00:00.000Z',
}

function clientWith(auth: Record<string, unknown>): SupabaseClient {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
  }
  return {
    auth,
    from: vi.fn(() => chain),
  } as unknown as SupabaseClient
}

describe('SupabaseRepository biometric session', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores the current session for a later Face ID login', async () => {
    const repo = new SupabaseRepository(
      clientWith({
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: 'access',
              refresh_token: 'refresh',
              user: { id: profile.id },
            },
          },
          error: null,
        }),
      }),
    )

    await repo.rememberBiometricSession()

    expect(readBiometricSession()).toEqual({
      kind: 'supabase',
      accessToken: 'access',
      refreshToken: 'refresh',
    })
  })

  it('restores the account from the saved session', async () => {
    const setSession = vi.fn().mockResolvedValue({ data: {}, error: null })
    const repo = new SupabaseRepository(
      clientWith({
        setSession,
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: 'access',
              refresh_token: 'refresh',
              user: { id: profile.id },
            },
          },
          error: null,
        }),
      }),
    )
    saveBiometricSession({
      kind: 'supabase',
      accessToken: 'access',
      refreshToken: 'refresh',
    })

    const user = await repo.restoreBiometricSession()

    expect(setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    })
    expect(user.email).toBe('socio@gym.local')
  })

  it('keeps the refresh token when signing out with quick access on', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const repo = new SupabaseRepository(clientWith({ signOut }))
    localStorage.setItem('reservasgym_biometric_enabled', 'true')
    localStorage.setItem(
      'reservasgym_biometric_user',
      JSON.stringify({
        userId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        savedAt: '2026-01-01T00:00:00.000Z',
      }),
    )
    saveBiometricSession({
      kind: 'supabase',
      accessToken: 'access',
      refreshToken: 'refresh',
    })

    expect(isBiometricsEnabled()).toBe(true)
    await repo.signOut()

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(readBiometricSession()?.kind).toBe('supabase')
  })
})
