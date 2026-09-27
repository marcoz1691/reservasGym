import { beforeEach, describe, expect, it } from 'vitest'
import type { Booking, Session, User } from '../domain/models'
import { LocalRepository } from './localRepository'
import { DEMO_PASSWORD } from './seed'
import { resetRepositoryForTests } from './repository'

const STORAGE_KEY = 'reservasgym.intermedia.v2'

function session(id: string, capacity: number): Session {
  return {
    id,
    templateId: 'tmpl-funcional-hiit',
    zoneId: 'zone-crossfit',
    title: id,
    kind: 'class',
    startsAt: '2030-05-01T10:00:00.000Z',
    endsAt: '2030-05-01T11:00:00.000Z',
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
