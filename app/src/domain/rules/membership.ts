import type { Membership, MembershipPlan, MembershipStatus } from '../models'

export const GRACE_PERIOD_DAYS = 3
export const EXPIRATION_WARNING_DAYS = 7

/** Zona horaria operativa del gym (fechas de membresía en pantalla). */
export const MEMBERSHIP_TIMEZONE = 'America/Guayaquil'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** YYYY-MM-DD en la zona del gym (sin DST en Ecuador). */
export function zonedDateKey(
  date: Date,
  timeZone: string = MEMBERSHIP_TIMEZONE,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Índice de día calendario en la zona del gym (mediodía UTC del YMD local).
 * Evita desalineación medianoche UTC vs America/Guayaquil (ZC18-O2).
 */
function zonedDayIndex(date: Date, timeZone: string = MEMBERSHIP_TIMEZONE): number {
  const ymd = zonedDateKey(date, timeZone)
  return Date.parse(`${ymd}T12:00:00.000Z`) / MS_PER_DAY
}

/**
 * Computes the real-time membership status based on end dates and grace period.
 * Usa instantes absolutos (acceso real); los “días restantes” usan calendario Guayaquil.
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
    : endsAtMs + GRACE_PERIOD_DAYS * MS_PER_DAY

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

/** Agenda y Reservas: el socio solo las ve si puede reservar. Staff/admin siempre. */
export function canUseBookingNav(
  role: 'member' | 'staff' | 'admin' | undefined,
  membership: Membership | null | undefined,
): boolean {
  if (role !== 'member') return true
  return canBookMembership(membership).allowed
}

/**
 * Días de calendario restantes hasta endsAt en America/Guayaquil (ZC18-O2).
 * Mismo día calendario que la fecha de vencimiento → 1 (“último día”).
 */
export function daysRemaining(
  membership: Membership,
  now: Date = new Date(),
): number {
  const endIdx = zonedDayIndex(new Date(membership.endsAt))
  const nowIdx = zonedDayIndex(now)
  const diff = Math.round(endIdx - nowIdx)
  if (diff < 0) return 0
  if (diff === 0) return 1
  return diff
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
