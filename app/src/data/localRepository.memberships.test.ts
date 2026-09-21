import { beforeEach, describe, expect, it } from 'vitest'
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

  it('Zero Active bloquea reserva de Hyrox y permite musculación', async () => {
    const staff = new LocalRepository()
    await staff.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
    const plan = await staff.upsertMembershipPlan({
      name: 'Zero Active Mensual',
      priceCents: 3500,
      durationDays: 30,
      allowedZoneIds: ['zone-gimnasio', 'zone-muscu', 'zone-bailo'],
    })
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
})
