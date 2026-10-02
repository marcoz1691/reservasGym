import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../domain/models'
import { LocalRepository } from './localRepository'
import { DEMO_PASSWORD } from './seed'
import { resetRepositoryForTests } from './repository'

describe('LocalRepository memberships and billing', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('allows members to view active plans, but not modify them', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    const plans = await repo.getMembershipPlans()
    expect(plans.length).toBeGreaterThan(0)
    expect(plans.every((p) => p.active)).toBe(true)

    await expect(
      repo.upsertMembershipPlan({
        name: 'Plan Hack',
        priceCents: 1000,
        durationDays: 30,
      }),
    ).rejects.toThrow(/sin permiso/i)

    await expect(repo.deleteMembershipPlan(plans[0]!.id)).rejects.toThrow(/solo admin/i)
  })

  it('persists plan edits across repository reload (simulates page refresh)', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

    await repo.upsertMembershipPlan({
      id: 'plan-trimestral',
      name: 'Plan Trimestral QA',
      priceCents: 9999,
      durationDays: 90,
    })

    const reloaded = new LocalRepository()
    await reloaded.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    const plans = await reloaded.getMembershipPlans()
    const updated = plans.find((p) => p.id === 'plan-trimestral')

    expect(updated?.name).toBe('Plan Trimestral QA')
    expect(updated?.priceCents).toBe(9999)
  })

  it('hides inactive plans from members but not from admin', async () => {
    const adminRepo = new LocalRepository()
    await adminRepo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

    await adminRepo.upsertMembershipPlan({
      id: 'plan-trimestral',
      name: 'Plan Trimestral',
      priceCents: 12000,
      durationDays: 90,
      active: false,
    })

    const memberRepo = new LocalRepository()
    await memberRepo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })
    const memberPlans = await memberRepo.getMembershipPlans()
    expect(memberPlans.some((p) => p.id === 'plan-trimestral')).toBe(false)
    expect(memberPlans.every((p) => p.active)).toBe(true)

    const adminReload = new LocalRepository()
    await adminReload.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    const adminPlans = await adminReload.getMembershipPlans()
    const inactive = adminPlans.find((p) => p.id === 'plan-trimestral')
    expect(inactive?.active).toBe(false)
  })

  it('allows admin to manage membership plans (upsert and delete)', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

    const newPlan = await repo.upsertMembershipPlan({
      name: 'Plan Anual VIP',
      priceCents: 45000,
      durationDays: 365,
      allowedZoneIds: ['zone-dragon-fit'],
    })

    expect(newPlan.id).toBeDefined()
    expect(newPlan.name).toBe('Plan Anual VIP')
    expect(newPlan.priceCents).toBe(45000)

    const plans = await repo.getMembershipPlans()
    expect(plans.some((p) => p.id === newPlan.id)).toBe(true)

    const updated = await repo.upsertMembershipPlan({
      id: newPlan.id,
      name: 'Plan Anual VIP Promo',
      priceCents: 40000,
      durationDays: 365,
    })
    expect(updated.name).toBe('Plan Anual VIP Promo')
    expect(updated.priceCents).toBe(40000)

    await repo.deleteMembershipPlan(newPlan.id)
    const afterDelete = await repo.getMembershipPlans()
    expect(afterDelete.some((p) => p.id === newPlan.id)).toBe(false)
  })

  it('retrieves member membership and payments correctly', async () => {
    const repo = new LocalRepository()
    const member = await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    const membership = await repo.getMemberMembership(member.id)
    expect(membership).not.toBeNull()
    expect(membership?.userId).toBe(member.id)
    expect(membership?.status).toBe('active')

    const payments = await repo.getMemberPayments(member.id)
    expect(payments.length).toBeGreaterThan(0)
    expect(payments[0]!.userId).toBe(member.id)
    expect(payments[0]!.status).toBe('approved')
  })

  it('scopes listMemberships and listPayments by role', async () => {
    const repo = new LocalRepository()
    const member = await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    const memberMemberships = await repo.listMemberships()
    expect(memberMemberships.every((m) => m.userId === member.id)).toBe(true)

    const memberPayments = await repo.listPayments()
    expect(memberPayments.every((p) => p.userId === member.id)).toBe(true)

    // Admin sees all
    const adminRepo = new LocalRepository()
    await adminRepo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

    const allMemberships = await adminRepo.listMemberships()
    expect(allMemberships.length).toBeGreaterThanOrEqual(memberMemberships.length)

    const allPayments = await adminRepo.listPayments()
    expect(allPayments.length).toBeGreaterThanOrEqual(memberPayments.length)
  })

  it('allows staff/admin to register manual payment and extends membership', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

    const plans = await repo.getMembershipPlans()
    const fullPlan = plans.find((p) => p.id === 'plan-mensual-full')!

    const result = await repo.registerManualPayment({
      userId: 'user_member_2',
      planId: fullPlan.id,
      amountCents: 4500,
      manualMethod: 'cash',
      reference: 'RECIBO-001',
    })

    expect(result.payment).toBeDefined()
    expect(result.payment.userId).toBe('user_member_2')
    expect(result.payment.amountCents).toBe(4500)
    expect(result.payment.status).toBe('approved')
    expect(result.payment.manualMethod).toBe('cash')
    expect(result.payment.reference).toBe('RECIBO-001')

    expect(result.membership).toBeDefined()
    expect(result.membership.userId).toBe('user_member_2')
    expect(result.membership.status).toBe('active')
    expect(result.payment.membershipId).toBe(result.membership.id)

    // Verify persisted membership for user_member_2
    const member2Membership = await repo.getMemberMembership('user_member_2')
    expect(member2Membership?.id).toBe(result.membership.id)
    expect(member2Membership?.status).toBe('active')
  })

  it('staff cobra pero no crea ni edita planes: eso es solo de admin', async () => {
    const staff = new LocalRepository()
    await staff.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

    await expect(
      staff.upsertMembershipPlan({ name: 'Plan Staff', priceCents: 100, durationDays: 365 }),
    ).rejects.toThrow(/solo admin/i)
  })

  it('Zero Active bloquea reserva de Hyrox y permite musculación', async () => {
    const admin = new LocalRepository()
    await admin.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    const plan = await admin.upsertMembershipPlan({
      name: 'Zero Active Mensual',
      priceCents: 3500,
      durationDays: 30,
      allowedZoneIds: ['zone-gimnasio', 'zone-muscu', 'zone-bailo'],
    })
    const staff = new LocalRepository()
    await staff.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
    await staff.registerManualPayment({
      userId: 'user_member_2',
      planId: plan.id,
      amountCents: 3500,
      manualMethod: 'cash',
    })

    const member = new LocalRepository()
    await member.signIn({ email: 'luis@gym.local', password: DEMO_PASSWORD })
    const sessions = await member.listSessions(new Date().toISOString())
    const hyrox = sessions.find((s) =>
      s.zoneId.replace(/[_-]/g, '').toLowerCase().includes('hyrox'),
    )
    const muscu = sessions.find((s) =>
      s.zoneId.replace(/[_-]/g, '').toLowerCase().includes('muscu'),
    )
    expect(hyrox).toBeTruthy()
    expect(muscu).toBeTruthy()

    await expect(member.createBooking(hyrox!.id, 'user_member_2')).rejects.toThrow(
      /no incluye/i,
    )
    const booked = await member.createBooking(muscu!.id, 'user_member_2')
    expect('status' in booked && booked.status).toBe('confirmed')
  })

  it('un socio deja una solicitud de plan pendiente y recepción la cobra', async () => {
    const memberRepo = new LocalRepository()
    const member = await memberRepo.signIn({
      email: 'luis@gym.local',
      password: DEMO_PASSWORD,
    })
    const plans = await memberRepo.getMembershipPlans()
    const plan = plans.find((p) => p.active)!

    const request = await memberRepo.requestPlanPayment({
      planId: plan.id,
      manualMethod: 'transfer',
    })

    expect(request.status).toBe('pending')
    expect(request.provider).toBe('manual')
    expect(request.manualMethod).toBe('transfer')
    expect(request.planId).toBe(plan.id)
    expect(request.amountCents).toBe(plan.priceCents)
    expect(request.membershipId).toBeNull()
    expect(await memberRepo.getMemberMembership(member.id)).toBeNull()

    const replaced = await memberRepo.requestPlanPayment({
      planId: plan.id,
      manualMethod: 'cash',
    })
    expect(replaced.id).toBe(request.id)
    expect(replaced.manualMethod).toBe('cash')
    const pending = (await memberRepo.getMemberPayments(member.id)).filter(
      (p) => p.status === 'pending',
    )
    expect(pending).toHaveLength(1)

    const staff = new LocalRepository()
    await staff.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
    const charged = await staff.registerManualPayment({
      userId: member.id,
      planId: plan.id,
      amountCents: plan.priceCents,
      manualMethod: 'cash',
    })

    expect(charged.payment.id).toBe(request.id)
    expect(charged.payment.status).toBe('approved')
    expect(charged.membership.status).toBe('active')
    expect(charged.payment.membershipId).toBe(charged.membership.id)
  })

  it('la solicitud guarda una referencia corta, la conserva al cambiarla y la aprobación no la pierde', async () => {
    const memberRepo = new LocalRepository()
    const member = await memberRepo.signIn({ email: 'luis@gym.local', password: DEMO_PASSWORD })
    const plan = (await memberRepo.getMembershipPlans()).find((p) => p.active)!

    const request = await memberRepo.requestPlanPayment({
      planId: plan.id,
      manualMethod: 'deuna',
      reference: 'ZC-4F7A2C',
    })
    expect(request.manualMethod).toBe('deuna')
    expect(request.reference).toBe('ZC-4F7A2C')

    const changed = await memberRepo.requestPlanPayment({ planId: plan.id, manualMethod: 'transfer' })
    expect(changed.reference).toBe('ZC-4F7A2C')

    const staff = new LocalRepository()
    await staff.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
    const charged = await staff.registerManualPayment({
      userId: member.id,
      planId: plan.id,
      amountCents: plan.priceCents,
      manualMethod: 'transfer',
    })
    expect(charged.payment.id).toBe(request.id)
    expect(charged.payment.reference).toBe('ZC-4F7A2C')
  })

  it('sin referencia del checkout la solicitud crea una ZC-XXXXXX', async () => {
    const memberRepo = new LocalRepository()
    await memberRepo.signIn({ email: 'luis@gym.local', password: DEMO_PASSWORD })
    const plan = (await memberRepo.getMembershipPlans()).find((p) => p.active)!

    const request = await memberRepo.requestPlanPayment({ planId: plan.id, manualMethod: 'cash' })
    expect(request.reference).toMatch(/^ZC-[0-9A-F]{6}$/)
  })
})

describe('LocalRepository reglas de planes (en espera, pase del día, cambio, reembolso)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  async function staffRepo() {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
    return repo
  }

  async function createPlan(input: Parameters<LocalRepository['upsertMembershipPlan']>[0]) {
    const admin = new LocalRepository()
    await admin.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    return admin.upsertMembershipPlan(input)
  }

  it('otro plan queda en espera y no pisa el vigente', async () => {
    const staff = await staffRepo()
    const before = await staff.getMemberMembership('user_member')

    const { membership } = await staff.registerManualPayment({
      userId: 'user_member',
      planId: 'plan-trimestral',
      amountCents: 12000,
      manualMethod: 'cash',
    })

    expect(membership.id).not.toBe(before!.id)
    expect(membership.startsAt).toBe(before!.endsAt)
    expect(membership.status).toBe('scheduled')
    const shown = await staff.getMemberMembership('user_member')
    expect(shown?.id).toBe(before!.id)
    expect(shown?.planId).toBe('plan-mensual-full')
    expect(shown?.endsAt).toBe(before!.endsAt)
  })

  it('un segundo plan distinto se rechaza en recepción y en la solicitud del socio', async () => {
    const staff = await staffRepo()
    await staff.registerManualPayment({
      userId: 'user_member',
      planId: 'plan-trimestral',
      amountCents: 12000,
      manualMethod: 'cash',
    })
    await expect(
      staff.registerManualPayment({
        userId: 'user_member',
        planId: 'plan-dragon-fit',
        amountCents: 5000,
        manualMethod: 'cash',
      }),
    ).rejects.toThrow(/plan en espera/i)

    const member = new LocalRepository()
    await member.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })
    await expect(
      member.requestPlanPayment({ planId: 'plan-dragon-fit', manualMethod: 'cash' }),
    ).rejects.toThrow(/plan en espera/i)
    const same = await member.requestPlanPayment({ planId: 'plan-trimestral', manualMethod: 'cash' })
    expect(same.status).toBe('pending')
  })

  it('el mismo plan suma días y conserva la fecha de inicio', async () => {
    const staff = await staffRepo()
    const before = await staff.getMemberMembership('user_member')
    const { membership } = await staff.registerManualPayment({
      userId: 'user_member',
      planId: 'plan-mensual-full',
      amountCents: 4500,
      manualMethod: 'cash',
    })
    expect(membership.id).toBe(before!.id)
    expect(membership.startsAt).toBe(before!.startsAt)
    expect(new Date(membership.endsAt).getTime() - new Date(before!.endsAt).getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    )
  })

  it('un socio sin plan con pase del día reserva solo en sus zonas y solo ese día', async () => {
    // 10:00 en Guayaquil
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T15:00:00.000Z'))
    try {
      const pass = await createPlan({
        name: 'Zona Day Hyrox',
        priceCents: 1000,
        durationDays: 1,
        kind: 'day_pass',
        allowedZoneIds: ['zone-hyrox'],
      })
      const admin = new LocalRepository()
      await admin.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
      const session = (zoneId: string, startsAt: string) =>
        admin.upsertSession({
          id: `ses-${zoneId}-${startsAt}`,
          templateId: 'tpl_qa',
          zoneId,
          title: 'Clase QA',
          kind: 'class',
          startsAt,
          endsAt: new Date(new Date(startsAt).getTime() + 3600_000).toISOString(),
          capacity: 10,
          trainerId: null,
          bookedCount: 0,
        } satisfies Session)
      const hyroxToday = await session('zone-hyrox', '2026-10-15T23:00:00.000Z')
      const muscuToday = await session('zone-muscu', '2026-10-16T01:00:00.000Z')
      const hyroxTomorrow = await session('zone-hyrox', '2026-10-16T15:00:00.000Z')

      const staff = await staffRepo()
      const { membership } = await staff.registerManualPayment({
        userId: 'user_member_2',
        planId: pass.id,
        amountCents: 1000,
        manualMethod: 'cash',
      })
      expect(membership.planId).toBe(pass.id)
      expect(membership.endsAt).toBe('2026-10-16T04:59:59.000Z')
      expect(await staff.getMemberMembership('user_member_2')).toBeNull()

      const member = new LocalRepository()
      await member.signIn({ email: 'luis@gym.local', password: DEMO_PASSWORD })
      const booked = await member.createBooking(hyroxToday.id, 'user_member_2')
      expect('status' in booked && booked.status).toBe('confirmed')
      await expect(member.createBooking(muscuToday.id, 'user_member_2')).rejects.toThrow(
        /Zona Day Hyrox/,
      )
      await expect(member.createBooking(hyroxTomorrow.id, 'user_member_2')).rejects.toThrow()
    } finally {
      vi.useRealTimers()
    }
  })

  it('un pase del día no toca la membresía vigente', async () => {
    const pass = await createPlan({
      name: 'Zona Day Full',
      priceCents: 1000,
      durationDays: 1,
      kind: 'day_pass',
    })
    const staff = await staffRepo()
    const before = await staff.getMemberMembership('user_member')
    await staff.registerManualPayment({
      userId: 'user_member',
      planId: pass.id,
      amountCents: 1000,
      manualMethod: 'cash',
    })
    const after = await staff.getMemberMembership('user_member')
    expect(after).toEqual(before)
    // Comprar un plan distinto sigue permitido: el pase no cuenta como plan en espera
    const queued = await staff.registerManualPayment({
      userId: 'user_member',
      planId: 'plan-trimestral',
      amountCents: 12000,
      manualMethod: 'cash',
    })
    expect(queued.membership.status).toBe('scheduled')
  })

  it('cambiar plan hoy cierra el vigente, abre el nuevo y corre el plan en espera', async () => {
    const staff = await staffRepo()
    const before = await staff.getMemberMembership('user_member')
    const queued = await staff.registerManualPayment({
      userId: 'user_member',
      planId: 'plan-trimestral',
      amountCents: 12000,
      manualMethod: 'cash',
    })

    const { payment, membership } = await staff.changePlanNow({
      userId: 'user_member',
      planId: 'plan-dragon-fit',
      amountCents: 2000,
      manualMethod: 'card_pos',
    })

    expect(membership.planId).toBe('plan-dragon-fit')
    expect(payment.membershipId).toBe(membership.id)
    expect(payment.amountCents).toBe(2000)
    expect(payment.notes).toMatch(/Crédito por días no usados: \$\d+\.\d{2}/)

    const all = await staff.listMemberships()
    const old = all.find((m) => m.id === before!.id)!
    expect(new Date(old.endsAt).getTime()).toBeLessThanOrEqual(Date.now())
    const shifted = all.find((m) => m.id === queued.membership.id)!
    expect(shifted.startsAt).toBe(membership.endsAt)
    expect((await staff.getMemberMembership('user_member'))?.id).toBe(membership.id)
  })

  it('marcar reembolsado cambia el pago y opcionalmente cancela su membresía', async () => {
    const staff = await staffRepo()
    const { payment, membership } = await staff.registerManualPayment({
      userId: 'user_member_2',
      planId: 'plan-mensual-full',
      amountCents: 4500,
      manualMethod: 'cash',
    })

    const refunded = await staff.refundPayment({ paymentId: payment.id, cancelMembership: true })
    expect(refunded.status).toBe('refunded')
    const shown = await staff.getMemberMembership('user_member_2')
    expect(shown?.id).toBe(membership.id)
    expect(shown?.status).toBe('cancelled')

    await expect(
      staff.refundPayment({ paymentId: payment.id, cancelMembership: false }),
    ).rejects.toThrow(/aprobados/)
  })
})
