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

describe('SupabaseRepository check-in y baja de cuenta vía RPC', () => {
  it('hace check-in con check_in_booking: la base valida código, estado y ventana', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: 'ci-1',
        booking_id: 'bk_1',
        session_id: 'sess_1',
        user_id: 'user_member',
        checked_in_at: '2030-05-01T09:55:00+00:00',
      },
      error: null,
    })
    const client = clientWithRpc(rpc)
    const repo = new SupabaseRepository(client)

    const result = await repo.checkIn('bk_1', 'qr-047cac92')

    expect(rpc).toHaveBeenCalledWith('check_in_booking', {
      p_booking_id: 'bk_1',
      p_code: 'qr-047cac92',
    })
    expect(client.from).not.toHaveBeenCalledWith('check_ins')
    expect(client.from).not.toHaveBeenCalledWith('bookings')
    expect(result).toMatchObject({ id: 'ci-1', bookingId: 'bk_1', userId: 'user_member' })
  })

  it('propaga el rechazo del check-in', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Fuera de la ventana de check-in' },
    })
    const repo = new SupabaseRepository(clientWithRpc(rpc))

    await expect(repo.checkIn('bk_1', 'QR-1')).rejects.toThrow('Fuera de la ventana de check-in')
  })

  it('elimina la cuenta con delete_user_account y cierra sesión', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = clientWithRpc(rpc)
    const signOut = vi.fn().mockResolvedValue({ error: null })
    Object.assign(client.auth, { signOut })
    const repo = new SupabaseRepository(client)

    await repo.deleteAccount()

    expect(rpc).toHaveBeenCalledWith('delete_user_account')
    expect(client.from).not.toHaveBeenCalledWith('profiles', expect.anything())
    expect(signOut).toHaveBeenCalled()
  })

  it('si la base no borra la cuenta, avisa en vez de decir que se borró', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })
    const client = clientWithRpc(rpc)
    const signOut = vi.fn().mockResolvedValue({ error: null })
    Object.assign(client.auth, { signOut })
    const repo = new SupabaseRepository(client)

    await expect(repo.deleteAccount()).rejects.toThrow('permission denied')
    expect(signOut).not.toHaveBeenCalled()
  })
})

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

  it('reagenda con reschedule_booking y devuelve la reserva nueva', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ...bookingRow, id: 'bk_2', session_id: 'sess_2' },
      error: null,
    })
    const repo = new SupabaseRepository(clientWithRpc(rpc))

    const result = await repo.rescheduleBooking('bk_1', 'sess_2')

    expect(rpc).toHaveBeenCalledWith('reschedule_booking', {
      p_booking_id: 'bk_1',
      p_session_id: 'sess_2',
    })
    expect(result).toMatchObject({ id: 'bk_2', sessionId: 'sess_2', status: 'confirmed' })
    // Un solo paso: no cancela ni reserva por separado
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('si la clase nueva está llena, propaga el aviso y no hace nada más', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'La clase nueva está llena. Tu reserva actual no cambió.' },
    })
    const repo = new SupabaseRepository(clientWithRpc(rpc))

    await expect(repo.rescheduleBooking('bk_1', 'sess_full')).rejects.toThrow(
      /llena. Tu reserva actual no cambió/,
    )
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
