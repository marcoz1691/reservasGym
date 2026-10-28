import type { Membership, MembershipPlan } from '../models'
import { canBookMembership } from './membership'

/**
 * Validates if a membership plan grants access to a specific zone.
 * If allowedZoneIds is empty or not defined, all zones are allowed.
 */
export function canBookZone(
  plan: MembershipPlan | null | undefined,
  zoneId: string,
): { allowed: boolean; reason?: string } {
  if (!plan) {
    return {
      allowed: false,
      reason: 'No se encontró un plan asociado para verificar el acceso a la zona.',
    }
  }

  if (!plan.allowedZoneIds || plan.allowedZoneIds.length === 0) {
    return { allowed: true }
  }

  const normalized = zoneId.replace(/[_-]/g, '').toLowerCase()
  const hasAccess = plan.allowedZoneIds.some((allowedId) => {
    if (allowedId === zoneId) return true
    if (allowedId.replace(/_/g, '-') === zoneId.replace(/_/g, '-')) return true
    return allowedId.replace(/[_-]/g, '').toLowerCase() === normalized
  })

  if (hasAccess) {
    return { allowed: true }
  }

  return {
    allowed: false,
    reason: `Tu plan (${plan.name}) no incluye acceso a esta zona.`,
  }
}

/** Acceso a una zona = unión del plan vigente y los pases del día activos. */
export function canAccessZone(
  plan: MembershipPlan | null | undefined,
  dayPassPlans: MembershipPlan[],
  zoneId: string,
): boolean {
  if (dayPassPlans.some((pass) => canBookZone(pass, zoneId).allowed)) return true
  return plan ? canBookZone(plan, zoneId).allowed : false
}

/** `dayPassPlans`: planes de los pases del día activos del socio. */
export function assertMemberBookingAllowed(
  membership: Membership | null | undefined,
  plan: MembershipPlan | null | undefined,
  zoneId: string,
  dayPassPlans: MembershipPlan[] = [],
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (dayPassPlans.some((pass) => canBookZone(pass, zoneId).allowed)) {
    return { ok: true }
  }
  const mem = canBookMembership(membership, now)
  if (!mem.allowed) {
    if (dayPassPlans.length > 0) {
      const names = dayPassPlans.map((pass) => pass.name).join(', ')
      return { ok: false, reason: `Tu pase (${names}) no incluye acceso a esta zona.` }
    }
    return { ok: false, reason: mem.reason ?? 'No puedes reservar ahora.' }
  }
  const zone = canBookZone(plan, zoneId)
  if (!zone.allowed) {
    return { ok: false, reason: zone.reason ?? 'Tu plan no incluye esta disciplina.' }
  }
  return { ok: true }
}
