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

const bookingRow = {
  id: 'bk_1',
  session_id: 'sess_1',
  user_id: 'user_member',
  status: 'confirmed',
  created_at: '2030-05-01T09:00:00+00:00',
  cancelled_at: null,
  check_in_code: 'QR_ABC',
}

function clientWithRpc(rpc: ReturnType<typeof vi.fn>): SupabaseClient {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
  }
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: profile.id } } },
        error: null,
      }),
    },
    from: vi.fn(() => chain),
    rpc,
  } as unknown as SupabaseClient
}

describe('SupabaseRepository reservas vía RPC (ZCAPP-53/54)', () => {
  it('reserva con book_session y devuelve la reserva confirmada', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { booking: bookingRow }, error: null })
    const repo = new SupabaseRepository(clientWithRpc(rpc))

    const result = await repo.createBooking('sess_1', 'user_member')

    expect(rpc).toHaveBeenCalledWith('book_session', {
      p_session_id: 'sess_1',
      p_user_id: 'user_member',
    })
    expect(result).toMatchObject({ id: 'bk_1', status: 'confirmed', sessionId: 'sess_1' })
  })

  it('devuelve la entrada de la lista de espera cuando la base decide que no hay cupo', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        waitlist: {
          id: 'wl_1',
          session_id: 'sess_1',
          user_id: 'user_member',
          position: 2,
          created_at: '2030-05-01T09:00:00+00:00',
        },
      },
      error: null,
    })
    const repo = new SupabaseRepository(clientWithRpc(rpc))

    const result = await repo.createBooking('sess_1', 'user_member')

    expect(result).toMatchObject({ id: 'wl_1', position: 2 })
  })

  it('propaga el mensaje de la base (membresía, solapamiento…)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Se solapa con otra reserva activa' },
    })
    const repo = new SupabaseRepository(clientWithRpc(rpc))

    await expect(repo.createBooking('sess_1', 'user_member')).rejects.toThrow(
      'Se solapa con otra reserva activa',
    )
  })

  it('cancela con cancel_booking, que también promueve desde la cola', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ...bookingRow, status: 'cancelled', cancelled_at: '2030-05-01T08:00:00+00:00' },
      error: null,
    })
    const repo = new SupabaseRepository(clientWithRpc(rpc))

    const result = await repo.cancelBooking('bk_1')

    expect(rpc).toHaveBeenCalledWith('cancel_booking', { p_booking_id: 'bk_1' })
    expect(result.status).toBe('cancelled')
  })

  it('si booking-rpc.sql no está aplicado, usa el camino anterior', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function' },
    })
    const repo = new SupabaseRepository(clientWithRpc(rpc))
    const legacy = vi
      .spyOn(repo as unknown as { createBookingLegacy: () => Promise<unknown> }, 'createBookingLegacy')
      .mockResolvedValue({ id: 'bk_legacy' })

    await expect(repo.createBooking('sess_1', 'user_member')).resolves.toEqual({
      id: 'bk_legacy',
    })
    expect(legacy).toHaveBeenCalledWith('sess_1', 'user_member')
  })
})
