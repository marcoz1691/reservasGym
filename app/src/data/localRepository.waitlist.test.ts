import { beforeEach, describe, expect, it } from 'vitest'
import type { Booking, Session, User } from '../domain/models'
import { RESCHEDULE_FULL_MESSAGE } from '../domain/rules'
import { LocalRepository } from './localRepository'
import { DEMO_PASSWORD } from './seed'
import { resetRepositoryForTests } from './repository'

const STORAGE_KEY = 'reservasgym.intermedia.v2'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Sesión de 1 h dentro de 30 días a la hora UTC indicada. Relativa a hoy para
 * que los tests no caduquen; dos sesiones con la misma hora se solapan.
 */
function session(id: string, capacity: number, hourUtc = 10): Session {
  const start = new Date(Date.now() + 30 * DAY_MS)
  start.setUTCHours(hourUtc, 0, 0, 0)
  return {
    id,
    templateId: 'tmpl-funcional-hiit',
    zoneId: 'zone-crossfit',
    title: id,
    kind: 'class',
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
    capacity,
    trainerId: null,
    bookedCount: 0,
  }
}

/** Admin con la clase A (cupo 1), la clase B a la misma hora y tres socios con plan vigente. */
async function setup() {
  const repo = new LocalRepository()
  const members: User[] = []
  for (const n of [1, 2, 3]) {
    members.push(
      await repo.signUp({
        fullName: `Socio ${n}`,
        email: `socio${n}@zonacero.ec`,
        password: 'Password123!',
      }),
    )
  }
  await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
  for (const m of members) {
    await repo.registerManualPayment({
      userId: m.id,
      planId: 'plan-mensual-full',
      amountCents: 4500,
      manualMethod: 'cash',
    })
  }
  await repo.upsertSession(session('sess_a', 1))
  await repo.upsertSession(session('sess_b', 5))
  const [u1, u2, u3] = members as [User, User, User]
  const b1 = (await repo.createBooking('sess_a', u1.id)) as Booking
  await repo.createBooking('sess_a', u2.id)
  await repo.createBooking('sess_a', u3.id)
  return { repo, u1, u2, u3, b1 }
}

async function statusIn(repo: LocalRepository, userId: string, sessionId: string) {
  const bookings = await repo.listBookingsForUser(userId)
  return bookings.find((b) => b.sessionId === sessionId)?.status
}

describe('LocalRepository promoción desde lista de espera (ZCAPP-54)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('salta al socio que se solaparía y promueve al siguiente', async () => {
    const { repo, u2, u3, b1 } = await setup()
    // u2 espera en A y confirma B, que es a la misma hora.
    await repo.createBooking('sess_b', u2.id)

    await repo.cancelBooking(b1.id)

    expect(await statusIn(repo, u2.id, 'sess_a')).toBe('cancelled')
    expect(await statusIn(repo, u2.id, 'sess_b')).toBe('confirmed')
    expect(await statusIn(repo, u3.id, 'sess_a')).toBe('confirmed')
    const state = await repo.load()
    expect(state.waitlist.filter((w) => w.sessionId === 'sess_a')).toEqual([])
  })

  it('no promueve a un socio cuya membresía ya venció', async () => {
    const { u2, u3, b1 } = await setup()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    for (const m of stored.memberships) {
      if (m.userId === u2.id) {
        m.endsAt = '2020-01-01T00:00:00.000Z'
        m.graceEndsAt = '2020-01-04T00:00:00.000Z'
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    const repo = new LocalRepository()

    await repo.cancelBooking(b1.id)

    expect(await statusIn(repo, u2.id, 'sess_a')).toBe('cancelled')
    expect(await statusIn(repo, u3.id, 'sess_a')).toBe('confirmed')
  })

  it('reindexa las posiciones cuando alguien sale de la cola', async () => {
    const { repo, u2, u3 } = await setup()
    const waiting = (await repo.listBookingsForUser(u2.id)).find(
      (b) => b.sessionId === 'sess_a',
    )!

    await repo.cancelBooking(waiting.id)

    const state = await repo.load()
    const queue = state.waitlist.filter((w) => w.sessionId === 'sess_a')
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ userId: u3.id, position: 1 })
  })
})

describe('LocalRepository reagendar: valida antes de mover (code review)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  /** setup() + una clase llena (sess_full, 16 h) y una libre (sess_c, 14 h). */
  async function setupReschedule() {
    const ctx = await setup()
    await ctx.repo.upsertSession(session('sess_full', 1, 16))
    await ctx.repo.upsertSession(session('sess_c', 5, 14))
    await ctx.repo.createBooking('sess_full', ctx.u3.id)
    return ctx
  }

  async function queueOf(repo: LocalRepository, sessionId: string) {
    return (await repo.load()).waitlist
      .filter((w) => w.sessionId === sessionId)
      .sort((a, b) => a.position - b.position)
      .map((w) => ({ userId: w.userId, position: w.position }))
  }

  async function confirmedIn(repo: LocalRepository, sessionId: string) {
    return (await repo.load()).bookings.filter(
      (b) => b.sessionId === sessionId && b.status === 'confirmed',
    ).length
  }

  it('clase llena: avisa y el socio conserva su lugar, sin sobrecupo ni promover a nadie', async () => {
    const { repo, u1, u2, b1 } = await setupReschedule()

    await expect(repo.rescheduleBooking(b1.id, 'sess_full')).rejects.toThrow(
      RESCHEDULE_FULL_MESSAGE,
    )

    expect(await statusIn(repo, u1.id, 'sess_a')).toBe('confirmed')
    expect(await statusIn(repo, u2.id, 'sess_a')).toBe('waitlisted')
    expect(await confirmedIn(repo, 'sess_a')).toBe(1)
    expect(await statusIn(repo, u1.id, 'sess_full')).toBeUndefined()
    expect(await queueOf(repo, 'sess_full')).toEqual([])
  })

  it('en espera + clase llena: conserva su lugar en la cola', async () => {
    const { repo, u2, u3 } = await setupReschedule()
    const waiting = (await repo.listBookingsForUser(u2.id)).find((b) => b.sessionId === 'sess_a')!

    await expect(repo.rescheduleBooking(waiting.id, 'sess_full')).rejects.toThrow(
      RESCHEDULE_FULL_MESSAGE,
    )

    expect(await statusIn(repo, u2.id, 'sess_a')).toBe('waitlisted')
    expect(await queueOf(repo, 'sess_a')).toEqual([
      { userId: u2.id, position: 1 },
      { userId: u3.id, position: 2 },
    ])
  })

  it('con cupo: mueve la reserva, promueve la cola y reindexa', async () => {
    const { repo, u1, u2, u3, b1 } = await setupReschedule()

    const moved = await repo.rescheduleBooking(b1.id, 'sess_c')

    expect(moved).toMatchObject({ sessionId: 'sess_c', userId: u1.id, status: 'confirmed' })
    expect(moved.id).not.toBe(b1.id)
    expect(await statusIn(repo, u1.id, 'sess_a')).toBe('cancelled')
    expect(await statusIn(repo, u2.id, 'sess_a')).toBe('confirmed')
    expect(await queueOf(repo, 'sess_a')).toEqual([{ userId: u3.id, position: 1 }])
    const state = await repo.load()
    expect(state.sessions.find((x) => x.id === 'sess_a')?.bookedCount).toBe(1)
    expect(state.sessions.find((x) => x.id === 'sess_c')?.bookedCount).toBe(1)
  })

  it('en espera con cupo en otra clase: queda confirmado allí y sale de la cola', async () => {
    const { repo, u2, u3 } = await setupReschedule()
    const waiting = (await repo.listBookingsForUser(u2.id)).find((b) => b.sessionId === 'sess_a')!

    await repo.rescheduleBooking(waiting.id, 'sess_c')

    expect(await statusIn(repo, u2.id, 'sess_c')).toBe('confirmed')
    expect(await queueOf(repo, 'sess_a')).toEqual([{ userId: u3.id, position: 1 }])
    expect(await confirmedIn(repo, 'sess_a')).toBe(1)
  })

  it('puede moverse a otra clase a la misma hora que la que deja', async () => {
    const { repo, b1 } = await setupReschedule()
    await expect(repo.rescheduleBooking(b1.id, 'sess_b')).resolves.toMatchObject({
      sessionId: 'sess_b',
    })
  })

  it('no puede moverse a una clase que choca con otra reserva suya', async () => {
    const { repo, u1, b1 } = await setupReschedule()
    await repo.upsertSession(session('sess_c2', 5, 14))
    await repo.createBooking('sess_c', u1.id)

    await expect(repo.rescheduleBooking(b1.id, 'sess_c2')).rejects.toThrow(/solapa/i)
    expect(await statusIn(repo, u1.id, 'sess_a')).toBe('confirmed')
  })

  it('rechaza la misma sesión, una clase que ya empezó y una reserva cancelada', async () => {
    const { repo, b1 } = await setupReschedule()
    await expect(repo.rescheduleBooking(b1.id, 'sess_a')).rejects.toThrow(/ya tienes reserva/i)

    const past = session('sess_past', 5)
    past.startsAt = new Date(Date.now() - 60_000).toISOString()
    await repo.upsertSession(past)
    await expect(repo.rescheduleBooking(b1.id, 'sess_past')).rejects.toThrow(/ya empezó/i)

    await repo.cancelBooking(b1.id)
    await expect(repo.rescheduleBooking(b1.id, 'sess_c')).rejects.toThrow(/ya no está activa/i)
  })

  it('un socio no puede reagendar la reserva de otro', async () => {
    const { repo, u1, b1 } = await setupReschedule()
    await repo.signIn({ email: 'socio2@zonacero.ec', password: 'Password123!' })

    await expect(repo.rescheduleBooking(b1.id, 'sess_c')).rejects.toThrow(/sin permiso/i)
    expect(await statusIn(repo, u1.id, 'sess_a')).toBe('confirmed')
  })
})
