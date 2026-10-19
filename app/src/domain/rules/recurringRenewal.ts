import type { Membership, MembershipPlan } from '../models'

const DAY = 24 * 60 * 60 * 1000

/**
 * Desde cuándo cuenta un cobro mensual del pago recurrente que registra recepción (ZCAPP-76).
 *
 * Pagomedios cobra cada mes en la misma fecha. Si recepción lo registra con el plan ya
 * vencido, la renovación cuenta desde el fin anterior: el plan sigue el ciclo de
 * Pagomedios y el socio no gana los días de atraso. Si el plan sigue vigente, o si ese
 * fin más la duración del plan ya pasó (más de un mes de atraso), cuenta desde `now`.
 */
export function recurringRenewalFrom(
  memberships: Pick<Membership, 'planId' | 'status' | 'endsAt'>[],
  plan: Pick<MembershipPlan, 'id' | 'durationDays'>,
  now: Date,
): Date {
  const ends = memberships
    .filter((m) => m.planId === plan.id && m.status !== 'cancelled')
    .map((m) => new Date(m.endsAt).getTime())
  if (ends.length === 0) return now
  const lastEnd = Math.max(...ends)
  if (lastEnd >= now.getTime()) return now
  if (lastEnd + plan.durationDays * DAY <= now.getTime()) return now
  return new Date(lastEnd)
}
