import { describe, expect, it } from 'vitest'
import { selectRepositoryBackend } from './selectRepositoryBackend'

describe('selectRepositoryBackend', () => {
  it('selects supabase when both env vars are set', () => {
    expect(
      selectRepositoryBackend({
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon-key',
        isDev: true,
      }),
    ).toBe('supabase')
  })

  it('selects local only in DEV without supabase', () => {
    expect(
      selectRepositoryBackend({
        supabaseUrl: '',
        supabaseAnonKey: '',
        isDev: true,
      }),
    ).toBe('local')
  })

  it('fails closed in production without supabase', () => {
    expect(() =>
      selectRepositoryBackend({
        supabaseUrl: undefined,
        supabaseAnonKey: undefined,
        isDev: false,
      }),
    ).toThrow(/VITE_SUPABASE/)
  })
})
