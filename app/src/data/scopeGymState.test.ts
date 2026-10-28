import { describe, expect, it } from 'vitest'
import { createSeedState } from './seed'
import { scopeGymState } from './scopeGymState'

describe('scopeGymState', () => {
  const state = createSeedState()
  const member = state.users.find((u) => u.role === 'member')!
  const admin = state.users.find((u) => u.role === 'admin')!

  it('gives staff/admin the full snapshot', () => {
    const scoped = scopeGymState(state, admin)
    expect(scoped.users).toHaveLength(state.users.length)
    expect(scoped.bookings).toHaveLength(state.bookings.length)
    expect(scoped.measurements).toHaveLength(state.measurements.length)
    expect(scoped.membershipPlans).toHaveLength(state.membershipPlans.length)
    expect(scoped.memberships).toHaveLength(state.memberships.length)
    expect(scoped.payments).toHaveLength(state.payments.length)
  })

  it('strips other members PII and private rows for members', () => {
    const scoped = scopeGymState(state, member)
    expect(scoped.users.every((u) => u.id === member.id)).toBe(true)
    expect(scoped.bookings.every((b) => b.userId === member.id)).toBe(true)
    expect(scoped.waitlist.every((w) => w.userId === member.id)).toBe(true)
    expect(scoped.checkIns.every((c) => c.userId === member.id)).toBe(true)
    expect(scoped.measurements.every((m) => m.userId === member.id)).toBe(true)
    expect(scoped.memberships.every((m) => m.userId === member.id)).toBe(true)
    expect(scoped.payments.every((p) => p.userId === member.id)).toBe(true)
    const heldPlanIds = new Set(scoped.memberships.map((m) => m.planId))
    expect(scoped.membershipPlans.every((p) => p.active || heldPlanIds.has(p.id))).toBe(true)
    expect(scoped.zones.length).toBe(state.zones.length)
    expect(scoped.sessions.length).toBe(state.sessions.length)
  })

  it('keeps a discontinued plan the member still holds, and hides other inactive plans', () => {
    const own = state.memberships.find((m) => m.userId === member.id)!
    const otherInactive = state.membershipPlans.find((p) => p.id !== own.planId)!
    const withInactive = {
      ...state,
      membershipPlans: state.membershipPlans.map((p) =>
        p.id === own.planId || p.id === otherInactive.id ? { ...p, active: false } : p,
      ),
    }
    const scoped = scopeGymState(withInactive, member)
    expect(scoped.membershipPlans.some((p) => p.id === own.planId)).toBe(true)
    expect(scoped.membershipPlans.some((p) => p.id === otherInactive.id)).toBe(false)
  })

  it('hides private collections when there is no session', () => {
    const scoped = scopeGymState(state, null)
    expect(scoped.users).toEqual([])
    expect(scoped.bookings).toEqual([])
    expect(scoped.measurements).toEqual([])
    expect(scoped.memberships).toEqual([])
    expect(scoped.payments).toEqual([])
    expect(scoped.membershipPlans.every((p) => p.active)).toBe(true)
    expect(scoped.zones.length).toBeGreaterThan(0)
  })
})
