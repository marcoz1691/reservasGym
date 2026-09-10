import { describe, expect, it } from 'vitest'
import { validateMembershipPlanInput } from './membershipPlan'

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
