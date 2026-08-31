import type { MembershipPlan } from '../models'

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
