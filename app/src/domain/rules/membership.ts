import type { Membership, MembershipPlan, MembershipStatus } from '../models'

export const GRACE_PERIOD_DAYS = 3
export const EXPIRATION_WARNING_DAYS = 7

/**
 * Computes the real-time membership status based on end dates and grace period.
 */
export function computeMembershipStatus(
  membership: Pick<Membership, 'endsAt' | 'graceEndsAt' | 'status'>,
  now: Date = new Date(),
): MembershipStatus {
  if (membership.status === 'cancelled') {
    return 'cancelled'
  }

  const nowMs = now.getTime()
  const endsAtMs = new Date(membership.endsAt).getTime()
  const graceEndsAtMs = membership.graceEndsAt
    ? new Date(membership.graceEndsAt).getTime()
    : endsAtMs + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000

  if (nowMs <= endsAtMs) {
    return 'active'
  }

  if (nowMs <= graceEndsAtMs) {
    return 'grace'
  }

  return 'expired'
}

/**
 * Returns true if the membership is currently active or within its grace period.
 */
export function isMembershipValid(
  membership: Membership | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!membership) return false
  const status = computeMembershipStatus(membership, now)
  return status === 'active' || status === 'grace'
}

/**
 * Validates whether a member can book a session based on membership status and visits quota.
 */
export function canBookMembership(
  membership: Membership | null | undefined,
  now: Date = new Date(),
): { allowed: boolean; status: MembershipStatus | 'none'; reason?: string } {
  if (!membership) {
    return {
      allowed: false,
      status: 'none',
      reason: 'No cuenta con una membresía activa.',
    }
  }

  const status = computeMembershipStatus(membership, now)

  if (status === 'cancelled') {
    return {
      allowed: false,
      status: 'cancelled',
      reason: 'La membresía ha sido cancelada.',
    }
  }

  if (status === 'expired') {
    return {
      allowed: false,
      status: 'expired',
      reason: 'Membresía vencida. Por favor renueva tu plan.',
    }
  }

  if (
    membership.visitsLeft !== null &&
    membership.visitsLeft !== undefined &&
    membership.visitsLeft <= 0
  ) {
    return {
      allowed: false,
      status,
      reason: 'No quedan visitas disponibles en la membresía.',
    }
  }

  return {
    allowed: true,
    status,
  }
}

/**
 * Calculates calendar days remaining until endsAt (0 if already passed).
 */
export function daysRemaining(
  membership: Membership,
  now: Date = new Date(),
): number {
  const endMs = new Date(membership.endsAt).getTime()
  const nowMs = now.getTime()
  const diffMs = endMs - nowMs
  if (diffMs <= 0) return 0
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000))
}

/**
 * Returns true if remaining days <= warningDays (default 7) and > 0.
 */
export function isNearExpiration(
  membership: Membership,
  warningDays = EXPIRATION_WARNING_DAYS,
  now: Date = new Date(),
): boolean {
  if (membership.status === 'cancelled') return false
  const remaining = daysRemaining(membership, now)
  return remaining > 0 && remaining <= warningDays
}

/**
 * Returns true if membership is past endsAt but still within graceEndsAt.
 */
export function isInGracePeriod(
  membership: Membership,
  now: Date = new Date(),
): boolean {
  return computeMembershipStatus(membership, now) === 'grace'
}

/**
 * Extends or activates a membership based on plan duration and payment date.
 */
export function extendMembership(
  current: Membership | null | undefined,
  plan: MembershipPlan,
  paidAt: string | Date = new Date(),
): {
  startsAt: string
  endsAt: string
  graceEndsAt: string
  status: MembershipStatus
  visitsLeft: number | null
} {
  const paidDate = typeof paidAt === 'string' ? new Date(paidAt) : paidAt
  const paidMs = paidDate.getTime()

  const isCurrentActive =
    Boolean(current) &&
    current!.status !== 'cancelled' &&
    new Date(current!.endsAt).getTime() > paidMs

  const baseDate = isCurrentActive ? new Date(current!.endsAt) : paidDate
  const startsAtDate = isCurrentActive ? new Date(current!.endsAt) : paidDate

  const endDate = new Date(
    baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000,
  )
  const graceEndDate = new Date(
    endDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  )

  let visitsLeft: number | null = null
  if (plan.visitQuota !== null && plan.visitQuota !== undefined) {
    if (isCurrentActive && current?.visitsLeft !== null && current?.visitsLeft !== undefined) {
      visitsLeft = current.visitsLeft + plan.visitQuota
    } else {
      visitsLeft = plan.visitQuota
    }
  }

  const startsAt = startsAtDate.toISOString()
  const endsAt = endDate.toISOString()
  const graceEndsAt = graceEndDate.toISOString()
  const status = computeMembershipStatus(
    { endsAt, graceEndsAt, status: 'active' },
    paidDate,
  )

  return {
    startsAt,
    endsAt,
    graceEndsAt,
    status,
    visitsLeft,
  }
}
