import { describe, expect, it } from 'vitest'
import type { MembershipPlan } from '@/domain/models'
import {
  describePlanOffer,
  groupPlansByFamily,
  selectUpgradePlan,
  validateMembershipPlanInput,
} from './membershipPlan'

function plan(partial: Partial<MembershipPlan> & Pick<MembershipPlan, 'name' | 'durationDays' | 'priceCents'>): MembershipPlan {
  return {
    id: partial.id ?? partial.name,
    visitQuota: null,
    allowedZoneIds: [],
    active: true,
    ...partial,
  }
}

describe('domain/rules/membershipPlan', () => {
  it('accepts a valid unlimited plan', () => {
    const res = validateMembershipPlanInput({
      name: '  Plan Mensual  ',
      priceCents: 4500,
      durationDays: 30,
      visitQuota: null,
      allowedZoneIds: [],
      active: true,
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.name).toBe('Plan Mensual')
      expect(res.value.priceCents).toBe(4500)
    }
  })

  it('accepts a punch-card plan with visit quota', () => {
    const res = validateMembershipPlanInput({
      name: 'Pase 10',
      priceCents: 3500,
      durationDays: 60,
      visitQuota: 10,
    })
    expect(res.ok).toBe(true)
  })

  it('rejects empty name', () => {
    const res = validateMembershipPlanInput({
      name: '   ',
      priceCents: 1000,
      durationDays: 30,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/nombre/i)
  })

  it('rejects negative price', () => {
    const res = validateMembershipPlanInput({
      name: 'Plan X',
      priceCents: -1,
      durationDays: 30,
    })
    expect(res.ok).toBe(false)
  })

  it('rejects zero duration', () => {
    const res = validateMembershipPlanInput({
      name: 'Plan X',
      priceCents: 1000,
      durationDays: 0,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/duración/i)
  })

  it('rejects invalid visit quota', () => {
    const res = validateMembershipPlanInput({
      name: 'Plan X',
      priceCents: 1000,
      durationDays: 30,
      visitQuota: 0,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/visita/i)
  })
})

describe('describePlanOffer', () => {
  it('marca Zero Pro Semestral como 7 meses con 1 mes gratis', () => {
    const offer = describePlanOffer(
      plan({ name: 'Zero Pro Semestral', durationDays: 210, priceCents: 33000 }),
    )
    expect(offer.familyId).toBe('zero-pro')
    expect(offer.durationLabel).toBe('7 meses')
    expect(offer.badge).toBe('1 mes gratis')
    expect(offer.featured).toBe(false)
    expect(offer.equivalentPerMonthCents).toBe(Math.round(33000 / 7))
  })

  it('marca Zero Elite Anual como 14 meses con 2 meses gratis y destacado', () => {
    const offer = describePlanOffer(
      plan({ name: 'Zero Elite Anual', durationDays: 420, priceCents: 90000 }),
    )
    expect(offer.familyId).toBe('zero-elite')
    expect(offer.durationLabel).toBe('14 meses')
    expect(offer.badge).toBe('2 meses gratis')
    expect(offer.featured).toBe(true)
    expect(offer.equivalentPerMonthCents).toBe(Math.round(90000 / 14))
  })

  it('marca trimestral como 3 meses con 15% off', () => {
    const offer = describePlanOffer(
      plan({ name: 'Zero Start Trimestral', durationDays: 90, priceCents: 3825 }),
    )
    expect(offer.familyId).toBe('zero-start')
    expect(offer.durationLabel).toBe('3 meses')
    expect(offer.badge).toBe('3 meses · 15% off')
    expect(offer.equivalentPerMonthCents).toBe(Math.round(3825 / 3))
  })

  it('deja el seed Plan Trimestral en Otros', () => {
    const offer = describePlanOffer(
      plan({ name: 'Plan Trimestral', durationDays: 90, priceCents: 12000 }),
    )
    expect(offer.familyId).toBe('otros')
  })

  it('describe un pase diario sin equivalente mensual', () => {
    const offer = describePlanOffer(
      plan({ name: 'Zona Day Full', durationDays: 1, priceCents: 1000 }),
    )
    expect(offer.familyId).toBe('zona-day')
    expect(offer.durationLabel).toBe('1 día')
    expect(offer.badge).toBeNull()
    expect(offer.equivalentPerMonthCents).toBeNull()
  })
})

describe('groupPlansByFamily', () => {
  it('agrupa por familia comercial y omite inactivos', () => {
    const groups = groupPlansByFamily([
      plan({ name: 'Zero Pro Semestral', durationDays: 210, priceCents: 33000 }),
      plan({ name: 'Zero Start Mensual', durationDays: 30, priceCents: 1500 }),
      plan({ name: 'Plan Trimestral', durationDays: 90, priceCents: 12000 }),
      plan({ name: 'Zona Day Full', durationDays: 1, priceCents: 1000 }),
      plan({ name: 'Zero Start Anual', durationDays: 420, priceCents: 18000, active: false }),
    ])

    expect(groups.map((g) => g.family.id)).toEqual([
      'zero-start',
      'zero-pro',
      'zona-day',
      'otros',
    ])
    expect(groups[0]?.family.label).toBe('Zero Start')
    expect(groups[0]?.offers).toHaveLength(1)
    expect(groups.find((g) => g.family.id === 'zero-elite')).toBeUndefined()
  })
})

describe('selectUpgradePlan', () => {
  const ladder = [
    plan({ id: 'start', name: 'Zero Start Mensual', durationDays: 30, priceCents: 1500 }),
    plan({ id: 'active', name: 'Zero Active Mensual', durationDays: 30, priceCents: 2500 }),
    plan({ id: 'elite', name: 'Zero Elite Mensual', durationDays: 30, priceCents: 4500 }),
    plan({ id: 'start-anual', name: 'Zero Start Anual', durationDays: 420, priceCents: 18000 }),
  ]

  it('sin plan activo recomienda el de mayor precio', () => {
    expect(selectUpgradePlan(ladder, null)?.id).toBe('start-anual')
  })

  it('con plan activo ofrece el siguiente nivel de familia, no uno más largo del mismo', () => {
    expect(selectUpgradePlan(ladder, 'start')?.id).toBe('active')
  })

  it('en el nivel más alto ofrece el siguiente precio dentro de la misma familia', () => {
    const others = [
      plan({ id: 'mensual', name: 'Plan Mensual Ilimitado', durationDays: 30, priceCents: 4500 }),
      plan({ id: 'dragon', name: 'Dragon Fit Mensual', durationDays: 30, priceCents: 5000 }),
      plan({ id: 'tri', name: 'Plan Trimestral', durationDays: 90, priceCents: 12000 }),
    ]
    expect(selectUpgradePlan(others, 'mensual')?.id).toBe('dragon')
  })

  it('no recomienda nada si ya está en el plan más alto', () => {
    const only = [plan({ id: 'elite', name: 'Zero Elite Anual', durationDays: 420, priceCents: 90000 })]
    expect(selectUpgradePlan(only, 'elite')).toBeNull()
  })
})
