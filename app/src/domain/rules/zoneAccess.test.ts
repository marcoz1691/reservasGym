import { describe, expect, it } from 'vitest'
import type { Membership, MembershipPlan } from '../models'
import { canBookZone, assertMemberBookingAllowed } from './zoneAccess'

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

  it('Zero Active (gimnasio, musculación, bailo) no incluye Hyrox ni CrossFit', () => {
    const zeroActive: MembershipPlan = {
      id: 'c2000000-0000-4000-8000-000000000030',
      name: 'Zero Active Mensual',
      priceCents: 3500,
      durationDays: 30,
      visitQuota: null,
      allowedZoneIds: ['zone-gimnasio', 'zone-muscu', 'zone-bailo'],
      active: true,
    }
    expect(canBookZone(zeroActive, 'zone-gimnasio').allowed).toBe(true)
    expect(canBookZone(zeroActive, 'zone-muscu').allowed).toBe(true)
    expect(canBookZone(zeroActive, 'zone-bailo').allowed).toBe(true)
    expect(canBookZone(zeroActive, 'zone-hyrox').allowed).toBe(false)
    expect(canBookZone(zeroActive, 'zone-crossfit').allowed).toBe(false)

    const membership: Membership = {
      id: 'mem-za',
      userId: 'u1',
      planId: zeroActive.id,
      status: 'active',
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-10-01T00:00:00.000Z',
      visitsLeft: null,
      graceEndsAt: '2026-10-04T00:00:00.000Z',
    }
    expect(
      assertMemberBookingAllowed(membership, zeroActive, 'zone-hyrox').ok,
    ).toBe(false)
    expect(
      assertMemberBookingAllowed(membership, zeroActive, 'zone-muscu').ok,
    ).toBe(true)
  })
})
