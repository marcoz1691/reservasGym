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
    expect(scoped.membershipPlans.every((p) => p.active)).toBe(true)
    expect(scoped.zones.length).toBe(state.zones.length)
    expect(scoped.sessions.length).toBe(state.sessions.length)
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
