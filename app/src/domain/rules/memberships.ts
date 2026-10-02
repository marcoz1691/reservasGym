import type { Membership, MembershipPlan } from '../models'
import {
  GRACE_PERIOD_DAYS,
  computeMembershipStatus,
  extendMembership,
  zonedDateKey,
  zonedDayIndex,
} from './membership'
import { isDayPassPlan } from './membershipPlan'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const QUEUED_PLAN_LIMIT_MESSAGE =
  'Ya tienes un plan en espera. Podrás comprar otro cuando empiece.'

function isDayPassRow(membership: Membership, plans: MembershipPlan[]): boolean {
  const plan = plans.find((p) => p.id === membership.planId)
  return plan ? isDayPassPlan(plan) : false
}

function planRows(memberships: Membership[], plans: MembershipPlan[]): Membership[] {
  return memberships.filter((m) => m.status !== 'cancelled' && !isDayPassRow(m, plans))
}

/** Membresía vigente: ya empezó, sigue activa o en gracia; si hay varias, la que termina más tarde. */
export function currentMembership(
  memberships: Membership[],
  plans: MembershipPlan[],
  now: Date = new Date(),
): Membership | null {
  const valid = planRows(memberships, plans).filter((m) => {
    const status = computeMembershipStatus(m, now)
    return status === 'active' || status === 'grace'
  })
  if (valid.length === 0) return null
  return valid.reduce((best, m) =>
    new Date(m.endsAt).getTime() > new Date(best.endsAt).getTime() ? m : best,
  )
}

/** Plan en espera: la fila que todavía no empieza (como máximo una). */
export function queuedMembership(
  memberships: Membership[],
  plans: MembershipPlan[],
  now: Date = new Date(),
): Membership | null {
  const queued = planRows(memberships, plans)
    .filter((m) => new Date(m.startsAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  return queued[0] ?? null
}

/** Pases del día vigentes en este momento. */
export function activeDayPasses(
  memberships: Membership[],
  plans: MembershipPlan[],
  now: Date = new Date(),
): Membership[] {
  const nowMs = now.getTime()
  return memberships.filter(
    (m) =>
      m.status !== 'cancelled' &&
      isDayPassRow(m, plans) &&
      new Date(m.startsAt).getTime() <= nowMs &&
      new Date(m.endsAt).getTime() >= nowMs,
  )
}

/**
 * Membresía que se le muestra al socio: la vigente o, si no hay, la última que ya empezó
 * (para enseñar "vencida"). Estado calculado; nunca devuelve un pase del día.
 */
export function memberMembership(
  memberships: Membership[],
  plans: MembershipPlan[],
  now: Date = new Date(),
): Membership | null {
  const current = currentMembership(memberships, plans, now)
  const shown =
    current ??
    memberships
      .filter((m) => !isDayPassRow(m, plans) && new Date(m.startsAt).getTime() <= now.getTime())
      .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime())[0]
  if (!shown) return null
  return { ...shown, status: computeMembershipStatus(shown, now) }
}

/** 23:59:59 del día en curso en America/Guayaquil (UTC-5 fijo, sin horario de verano). */
export function endOfGymDay(now: Date = new Date()): Date {
  return new Date(`${zonedDateKey(now)}T23:59:59.000-05:00`)
}

export type PlanPurchaseOutcome =
  | { kind: 'new'; startsAt: string }
  | { kind: 'extend'; target: Membership; queued?: Membership }
  | { kind: 'queue'; startsAt: string }
  | { kind: 'reject'; reason: string }
  | { kind: 'day_pass'; startsAt: string; endsAt: string }

/**
 * Qué pasa al comprar `plan`:
 * - pase del día → fila aparte válida hasta las 23:59 de hoy;
 * - mismo plan que el vigente o el que está en espera → suma días a esa fila;
 * - otro plan con uno vigente activo → queda en espera desde que termina el vigente;
 * - ya hay un plan en espera distinto → se rechaza;
 * - sin plan vigente (o en gracia) → membresía nueva desde hoy.
 */
export function planPurchaseOutcome(input: {
  memberships: Membership[]
  plans: MembershipPlan[]
  plan: MembershipPlan
  now?: Date
}): PlanPurchaseOutcome {
  const { memberships, plan } = input
  const now = input.now ?? new Date()
  const plans = input.plans.some((p) => p.id === plan.id) ? input.plans : [...input.plans, plan]

  if (isDayPassPlan(plan)) {
    return { kind: 'day_pass', startsAt: now.toISOString(), endsAt: endOfGymDay(now).toISOString() }
  }

  const current = currentMembership(memberships, plans, now)
  const queued = queuedMembership(memberships, plans, now)

  if (queued && queued.planId === plan.id) return { kind: 'extend', target: queued }
  if (current && current.planId === plan.id) {
    return queued ? { kind: 'extend', target: current, queued } : { kind: 'extend', target: current }
  }
  if (queued) return { kind: 'reject', reason: QUEUED_PLAN_LIMIT_MESSAGE }
  if (current && computeMembershipStatus(current, now) === 'active') {
    return { kind: 'queue', startsAt: current.endsAt }
  }
  return { kind: 'new', startsAt: now.toISOString() }
}

export interface PlanPurchaseDates {
  startsAt: string
  endsAt: string
  graceEndsAt: string
  visitsLeft: number | null
  /** Plan en espera que se corre al renovar el vigente (misma duración). */
  shiftedQueued?: { id: string; startsAt: string; endsAt: string; graceEndsAt: string }
}

function plusDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * MS_PER_DAY).toISOString()
}

/** Fechas de la fila resultante de una compra (no aplica a `reject`). */
export function planPurchaseDates(
  outcome: PlanPurchaseOutcome,
  plan: MembershipPlan,
  now: Date = new Date(),
): PlanPurchaseDates {
  switch (outcome.kind) {
    case 'reject':
      throw new Error(outcome.reason)
    case 'day_pass':
      return {
        startsAt: outcome.startsAt,
        endsAt: outcome.endsAt,
        graceEndsAt: outcome.endsAt,
        visitsLeft: plan.visitQuota ?? null,
      }
    case 'new':
    case 'queue': {
      const endsAt = plusDays(outcome.startsAt, plan.durationDays)
      return {
        startsAt: outcome.startsAt,
        endsAt,
        graceEndsAt: plusDays(endsAt, GRACE_PERIOD_DAYS),
        visitsLeft: plan.visitQuota ?? null,
      }
    }
    case 'extend': {
      const next = extendMembership(outcome.target, plan, now)
      const dates: PlanPurchaseDates = {
        startsAt: next.startsAt,
        endsAt: next.endsAt,
        graceEndsAt: next.graceEndsAt,
        visitsLeft: next.visitsLeft,
      }
      if (outcome.queued) dates.shiftedQueued = shiftQueuedMembership(outcome.queued, next.endsAt)
      return dates
    }
  }
}

/** Corre el plan en espera para que empiece en `startsAt`, con la misma duración. */
export function shiftQueuedMembership(
  queued: Pick<Membership, 'id' | 'startsAt' | 'endsAt'>,
  startsAt: string,
): { id: string; startsAt: string; endsAt: string; graceEndsAt: string } {
  const lengthMs = new Date(queued.endsAt).getTime() - new Date(queued.startsAt).getTime()
  const endsAt = new Date(new Date(startsAt).getTime() + lengthMs).toISOString()
  return { id: queued.id, startsAt, endsAt, graceEndsAt: plusDays(endsAt, GRACE_PERIOD_DAYS) }
}

/**
 * Crédito por días no usados al cambiar de plan hoy: precio × días restantes / días del período
 * (calendario Guayaquil). Ej.: $30 del 1 al 31, cambio el 15 → 16/30 × $30 = $16.
 */
export function planChangeCredit(
  current: Pick<Membership, 'startsAt' | 'endsAt'>,
  currentPlan: Pick<MembershipPlan, 'priceCents'> | null | undefined,
  now: Date = new Date(),
): number {
  if (!currentPlan) return 0
  const endIdx = zonedDayIndex(new Date(current.endsAt))
  const totalDays = Math.round(endIdx - zonedDayIndex(new Date(current.startsAt)))
  if (totalDays <= 0) return 0
  const remaining = Math.max(0, Math.min(totalDays, Math.round(endIdx - zonedDayIndex(now))))
  return Math.round((currentPlan.priceCents * remaining) / totalDays)
}
