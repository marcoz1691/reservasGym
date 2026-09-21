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

export function assertMemberBookingAllowed(
  membership: Membership | null | undefined,
  plan: MembershipPlan | null | undefined,
  zoneId: string,
): { ok: true } | { ok: false; reason: string } {
  const mem = canBookMembership(membership)
  if (!mem.allowed) {
    return { ok: false, reason: mem.reason ?? 'No puedes reservar ahora.' }
  }
  const zone = canBookZone(plan, zoneId)
  if (!zone.allowed) {
    return { ok: false, reason: zone.reason ?? 'Tu plan no incluye esta disciplina.' }
  }
  return { ok: true }
}
