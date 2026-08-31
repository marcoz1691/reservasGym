import { describe, expect, it } from 'vitest'
import type { MembershipPlan } from '../models'
import { canBookZone } from './zoneAccess'

describe('domain/rules/zoneAccess', () => {
  const allAccessPlan: MembershipPlan = {
    id: 'plan-all',
    name: 'Plan Total Access',
    priceCents: 8000,
    durationDays: 30,
    visitQuota: null,
    allowedZoneIds: [],
    active: true,
  }

  const singleZonePlan: MembershipPlan = {
    id: 'plan-dragon',
    name: 'Plan Dragon Fit',
    priceCents: 4500,
    durationDays: 30,
    visitQuota: null,
    allowedZoneIds: ['zone-dragon-fit'],
    active: true,
  }

  const multiZonePlan: MembershipPlan = {
    id: 'plan-combo',
    name: 'Combo Musculación + CrossFit',
    priceCents: 6000,
    durationDays: 30,
    visitQuota: null,
    allowedZoneIds: ['zone-musculacion', 'zone-crossfit'],
    active: true,
  }

  it('blocks booking when plan is null or undefined', () => {
    const resNull = canBookZone(null, 'zone-dragon-fit')
    expect(resNull.allowed).toBe(false)
    expect(resNull.reason).toBeDefined()

    const resUndefined = canBookZone(undefined, 'zone-dragon-fit')
    expect(resUndefined.allowed).toBe(false)
    expect(resUndefined.reason).toBeDefined()
  })

  it('allows access to any zone when allowedZoneIds is empty', () => {
    expect(canBookZone(allAccessPlan, 'zone-dragon-fit').allowed).toBe(true)
    expect(canBookZone(allAccessPlan, 'zone-musculacion').allowed).toBe(true)
    expect(canBookZone(allAccessPlan, 'zone-crossfit').allowed).toBe(true)
    expect(canBookZone(allAccessPlan, 'zone-fisioterapia').allowed).toBe(true)
  })

  it('allows access when zoneId is in allowedZoneIds', () => {
    const res = canBookZone(singleZonePlan, 'zone-dragon-fit')
    expect(res.allowed).toBe(true)
    expect(res.reason).toBeUndefined()
  })

  it('blocks access when zoneId is not in allowedZoneIds', () => {
    const res = canBookZone(singleZonePlan, 'zone-crossfit')
    expect(res.allowed).toBe(false)
    expect(res.reason).toContain('Plan Dragon Fit')
    expect(res.reason).toContain('no incluye acceso')
  })

  it('handles multiple allowed zones correctly', () => {
    expect(canBookZone(multiZonePlan, 'zone-musculacion').allowed).toBe(true)
    expect(canBookZone(multiZonePlan, 'zone-crossfit').allowed).toBe(true)
    expect(canBookZone(multiZonePlan, 'zone-dragon-fit').allowed).toBe(false)
    expect(canBookZone(multiZonePlan, 'zone-nutricion').allowed).toBe(false)
  })
})
