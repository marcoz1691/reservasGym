import type { GymState, User } from '@/domain/models'

function cloneState(state: GymState): GymState {
  return structuredClone(state)
}

/** Returns the gym snapshot a client may hold for the given actor. */
export function scopeGymState(state: GymState, actor: User | null): GymState {
  const next = cloneState(state)
  if (!actor) {
    return {
      ...next,
      users: [],
      bookings: [],
      waitlist: [],
      checkIns: [],
      measurements: [],
      bodyGoals: [],
      membershipPlans: (next.membershipPlans ?? []).filter((p) => p.active),
      memberships: [],
      payments: [],
    }
  }
  if (actor.role === 'staff' || actor.role === 'admin') {
    return next
  }
  return {
    ...next,
    users: next.users.filter((u) => u.id === actor.id),
    bookings: next.bookings.filter((b) => b.userId === actor.id),
    waitlist: next.waitlist.filter((w) => w.userId === actor.id),
    checkIns: next.checkIns.filter((c) => c.userId === actor.id),
    measurements: next.measurements.filter((m) => m.userId === actor.id),
    bodyGoals: (next.bodyGoals ?? []).filter((g) => g.userId === actor.id),
    membershipPlans: (next.membershipPlans ?? []).filter((p) => p.active),
    memberships: (next.memberships ?? []).filter((m) => m.userId === actor.id),
    payments: (next.payments ?? []).filter((p) => p.userId === actor.id),
  }
}
