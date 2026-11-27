import {
  computeMembershipStatus,
  GRACE_PERIOD_DAYS,
} from '@/domain/rules/membership'
import type { Membership } from '@/domain/models'

export function getMemberMembershipChip(
  membership: Membership | null | undefined,
  now: Date = new Date(),
): { label: string; tone: 'neutral' | 'ok' | 'warn' | 'danger' } {
  if (!membership) {
    return { label: 'Sin Plan', tone: 'neutral' }
  }

  const status = computeMembershipStatus(membership, now)
  if (status === 'active') {
    return { label: 'Vigente', tone: 'ok' }
  }

  if (status === 'grace') {
    const endsAtMs = new Date(membership.endsAt).getTime()
    const graceEndsAtMs = membership.graceEndsAt
      ? new Date(membership.graceEndsAt).getTime()
      : endsAtMs + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    const diffMs = graceEndsAtMs - now.getTime()
    const graceDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
    return { label: `En Gracia (${graceDays} d)`, tone: 'warn' }
  }

  return { label: 'Vencido', tone: 'danger' }
}
