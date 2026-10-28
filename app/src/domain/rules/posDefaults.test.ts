import { describe, expect, it } from 'vitest'
import type { Membership, MembershipPlan, Payment } from '../models'
import { suggestPosDefaults } from './posDefaults'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-10-15T15:00:00Z')
const at = (days: number) => new Date(now.getTime() + days * DAY).toISOString()

const plan = (id: string, extra: Partial<MembershipPlan> = {}) =>
  ({ id, name: id, priceCents: 1500, durationDays: 30, visitQuota: null, active: true, ...extra }) as MembershipPlan
const PLANS = [plan('mensual'), plan('pase', { kind: 'day_pass', durationDays: 1 }), plan('viejo', { active: false })]

const membership = (planId: string, startsIn: number, endsIn: number): Membership =>
  ({ id: `m-${planId}-${endsIn}`, userId: 'u', planId, status: 'active', startsAt: at(startsIn), endsAt: at(endsIn), graceEndsAt: at(endsIn + 3), visitsLeft: null }) as Membership

const payment = (daysAgo: number, extra: Partial<Payment>): Payment =>
  ({ id: `p${daysAgo}`, userId: 'u', planId: 'mensual', membershipId: null, amountCents: 1500, status: 'approved', provider: 'manual', manualMethod: 'cash', createdAt: at(-daysAgo), approvedAt: at(-daysAgo), ...extra }) as Payment

describe('suggestPosDefaults', () => {
  it('sugiere el plan vigente y el medio del último pago aprobado', () => {
    const r = suggestPosDefaults({
      memberships: [membership('mensual', -10, 20)],
      payments: [payment(40, { manualMethod: 'cash' }), payment(10, { manualMethod: 'transfer' })],
      plans: PLANS,
      now,
    })
    expect(r).toEqual({ planId: 'mensual', method: 'transfer' })
  })

  it('con el plan vencido sugiere ese mismo plan', () => {
    const r = suggestPosDefaults({ memberships: [membership('mensual', -40, -10)], payments: [], plans: PLANS, now })
    expect(r.planId).toBe('mensual')
  })

  it('el primer mes de un pago recurrente en línea sugiere «Pago recurrente Pagomedios»', () => {
    const r = suggestPosDefaults({
      memberships: [],
      payments: [payment(31, { provider: 'pagomedios', manualMethod: null, notes: 'Pago recurrente (ID 1723456784): primer mes cobrado.' })],
      plans: PLANS,
      now,
    })
    expect(r.method).toBe('pagomedios_recurring')
  })

  it('un pago único en línea, pendiente o rechazado no sugiere medio', () => {
    const r = suggestPosDefaults({
      memberships: [],
      payments: [
        payment(5, { provider: 'pagomedios', manualMethod: null, notes: null }),
        payment(1, { status: 'pending', manualMethod: 'deuna' }),
        payment(2, { status: 'rejected', manualMethod: 'transfer' }),
      ],
      plans: PLANS,
      now,
    })
    expect(r.method).toBeNull()
  })

  it('no sugiere planes fuera de venta ni pases del día', () => {
    expect(suggestPosDefaults({ memberships: [membership('viejo', -10, 20)], payments: [], plans: PLANS, now }).planId).toBeNull()
    expect(suggestPosDefaults({ memberships: [membership('pase', 0, 0.3)], payments: [], plans: PLANS, now }).planId).toBeNull()
  })

  it('socio sin historial: no sugiere nada', () => {
    expect(suggestPosDefaults({ memberships: [], payments: [], plans: PLANS, now })).toEqual({ planId: null, method: null })
  })
})
