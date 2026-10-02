import { beforeEach, describe, expect, it } from 'vitest'
import type { Booking, Session, User } from '../domain/models'
import { DAY_PASSES_APP_DISABLED_MESSAGE, SESSION_FULL_MESSAGE } from '../domain/rules'
import { LocalRepository } from './localRepository'
import { DEMO_PASSWORD } from './seed'
import { resetRepositoryForTests } from './repository'

const DAY_MS = 24 * 60 * 60 * 1000

function session(id: string, capacity: number): Session {
  const start = new Date(Date.now() + 30 * DAY_MS)
  start.setUTCHours(10, 0, 0, 0)
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

/** Admin, una clase con cupo 1 y tres socios con plan vigente. */
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
  const [u1, u2, u3] = members as [User, User, User]
  return { repo, u1, u2, u3 }
}

async function statusIn(repo: LocalRepository, userId: string, sessionId: string) {
  return (await repo.listBookingsForUser(userId)).find((b) => b.sessionId === sessionId)?.status
}

describe('LocalRepository: lista de espera apagada', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('clase llena: rechaza en vez de anotar en espera', async () => {
    const { repo, u1, u2 } = await setup()
    await repo.createBooking('sess_a', u1.id)
    await repo.updateSettings({ waitlistEnabled: false })

    await expect(repo.createBooking('sess_a', u2.id)).rejects.toThrow(SESSION_FULL_MESSAGE)

    expect(await statusIn(repo, u2.id, 'sess_a')).toBeUndefined()
    expect((await repo.load()).waitlist).toEqual([])
  })

  it('con cupo se sigue reservando normal', async () => {
    const { repo, u1 } = await setup()
    await repo.updateSettings({ waitlistEnabled: false })
    await expect(repo.createBooking('sess_a', u1.id)).resolves.toMatchObject({
      status: 'confirmed',
    })
  })

  it('quien ya esperaba sigue siendo promovido al liberarse un cupo', async () => {
    const { repo, u1, u2, u3 } = await setup()
    const b1 = (await repo.createBooking('sess_a', u1.id)) as Booking
    await repo.createBooking('sess_a', u2.id)
    await repo.updateSettings({ waitlistEnabled: false })

    await repo.cancelBooking(b1.id)

    expect(await statusIn(repo, u2.id, 'sess_a')).toBe('confirmed')
    await expect(repo.createBooking('sess_a', u3.id)).rejects.toThrow(SESSION_FULL_MESSAGE)
  })
})

describe('LocalRepository: pases diarios apagados en la app', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  async function withDayPass(enabled: boolean) {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    await repo.upsertMembershipPlan({
      id: 'plan-zona-day',
      name: 'Zona Day Full',
      priceCents: 1000,
      durationDays: 1,
      active: true,
    })
    await repo.updateSettings({ dayPassesEnabled: enabled })
    return repo
  }

  it('el socio no puede solicitar un pase diario', async () => {
    const repo = await withDayPass(false)
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    await expect(
      repo.requestPlanPayment({ planId: 'plan-zona-day', manualMethod: 'cash' }),
    ).rejects.toThrow(DAY_PASSES_APP_DISABLED_MESSAGE)
  })

  it('el socio sí puede solicitar un plan normal', async () => {
    const repo = await withDayPass(false)
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    await expect(
      repo.requestPlanPayment({ planId: 'plan-mensual-full', manualMethod: 'cash' }),
    ).resolves.toMatchObject({ status: 'pending' })
  })

  it('con el interruptor encendido el socio puede solicitarlo', async () => {
    const repo = await withDayPass(true)
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    await expect(
      repo.requestPlanPayment({ planId: 'plan-zona-day', manualMethod: 'cash' }),
    ).resolves.toMatchObject({ planId: 'plan-zona-day' })
  })

  it('recepción sigue vendiéndolos desde Cobros', async () => {
    const repo = await withDayPass(false)
    const socio = (await repo.load()).users.find((u) => u.email === 'socio@gym.local')!

    await expect(
      repo.registerManualPayment({
        userId: socio.id,
        planId: 'plan-zona-day',
        amountCents: 1000,
        manualMethod: 'cash',
      }),
    ).resolves.toMatchObject({ payment: { status: 'approved' } })
  })
})

describe('LocalRepository: interruptores solo los cambia admin', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('staff no puede cambiar la configuración del gym', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
    await expect(repo.updateSettings({ onlinePaymentsEnabled: true })).rejects.toThrow(
      /solo admin/i,
    )
  })

  it('admin enciende y apaga los interruptores', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    const settings = await repo.updateSettings({
      onlinePaymentsEnabled: true,
      waitlistEnabled: false,
      measurementsEnabled: false,
      dayPassesEnabled: false,
    })
    expect(settings).toMatchObject({
      onlinePaymentsEnabled: true,
      waitlistEnabled: false,
      measurementsEnabled: false,
      dayPassesEnabled: false,
    })
  })
})
