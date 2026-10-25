import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseRepository } from './supabaseRepository'

const profile = {
  id: 'user_member',
  email: 'socio@gym.local',
  full_name: 'Ana Socio',
  role: 'member',
  created_at: '2026-01-01T00:00:00.000Z',
}

const settings = {
  id: 1,
  name: 'Zona Cero',
  logo_url: null,
  primary_color: '#231F20',
  accent_color: '#F26D17',
  booking_window_hours: 168,
  cancel_window_hours: 2,
  check_in_window_minutes: 15,
}

const session = {
  id: 'sess_1',
  template_id: 'tpl-gym-open',
  zone_id: 'zone-gimnasio',
  title: 'Acceso libre gimnasio',
  kind: 'open',
  starts_at: '2030-05-01T11:00:00+00:00',
  ends_at: '2030-05-01T12:00:00+00:00',
  capacity: 40,
  trainer_id: null,
  booked_count: 1,
}

const tableRows: Record<string, unknown[]> = {
  profiles: [profile],
  sessions: [session],
}

/** Filas completas de get_member_state: las 14 tablas, como las devuelve la función. */
const memberState = {
  gym_settings: settings,
  profiles: [profile],
  trainers: [],
  zones: [],
  class_templates: [],
  sessions: [session],
  bookings: [],
  waitlist_entries: [],
  check_ins: [],
  body_measurements: [],
  body_goals: [],
  membership_plans: [],
  memberships: [],
  payments: [],
}

function makeClient(rpc: ReturnType<typeof vi.fn>) {
  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: table === 'gym_settings' ? settings : profile, error: null }),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: tableRows[table] ?? [], error: null }),
    }
    return chain
  })
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: profile.id } } },
        error: null,
      }),
      signOut: vi.fn(),
    },
    from,
    rpc,
  } as unknown as SupabaseClient
  return { client, from }
}

const tablesRead = (from: ReturnType<typeof vi.fn>) =>
  from.mock.calls.map((call) => call[0]).filter((table) => table !== 'profiles')

describe('SupabaseRepository fetchState: una sola llamada a get_member_state', () => {
  it('carga el estado con get_member_state sin leer tabla por tabla', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: memberState, error: null })
    const { client, from } = makeClient(rpc)

    const state = await new SupabaseRepository(client).load()

    expect(rpc).toHaveBeenCalledWith('get_member_state')
    expect(tablesRead(from)).toEqual([])
    expect(state.settings.name).toBe('Zona Cero')
    expect(state.sessions.map((s) => s.id)).toEqual(['sess_1'])
  })

  it('si la base no tiene la función, cae a las lecturas por tabla y no la vuelve a pedir', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.get_member_state' },
    })
    const { client, from } = makeClient(rpc)
    const repo = new SupabaseRepository(client)

    const state = await repo.load()
    await repo.load()

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(tablesRead(from)).toContain('sessions')
    expect(state.sessions.map((s) => s.id)).toEqual(['sess_1'])
  })

  it('otro error de la función se propaga en vez de ocultarse', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '57014', message: 'canceling statement due to statement timeout' },
    })
    const { client } = makeClient(rpc)

    await expect(new SupabaseRepository(client).load()).rejects.toThrow('statement timeout')
  })

  it('ambos caminos devuelven el mismo estado', async () => {
    const viaRpc = await new SupabaseRepository(
      makeClient(vi.fn().mockResolvedValue({ data: memberState, error: null })).client,
    ).load()
    const viaTables = await new SupabaseRepository(
      makeClient(
        vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'no existe' } }),
      ).client,
    ).load()

    expect(viaRpc).toEqual(viaTables)
  })
})
