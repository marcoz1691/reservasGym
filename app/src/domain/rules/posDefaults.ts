import type { ManualPaymentMethod, Membership, MembershipPlan, Payment } from '../models'
import { isDayPassPlan } from './membershipPlan'
import { memberMembership } from './memberships'

/** El primer mes del pago recurrente queda en línea con una nota "Pago recurrente (ID …)". */
const RECURRING_NOTE = /^Pago recurrente \(ID /

/**
 * Lo que Cobros propone al elegir a un socio (ZCAPP-78): su plan de siempre y el medio con
 * el que pagó la última vez, para renovar sin volver a buscar el plan ni el medio.
 *
 * - Plan: el de su membresía actual o, si ya venció, la última; solo si sigue a la venta.
 * - Medio: el del último pago aprobado. Si fue el primer mes de un pago recurrente en
 *   línea, «Pago recurrente Pagomedios». Un pago único en línea no sugiere medio.
 */
export function suggestPosDefaults(params: {
  memberships: Membership[]
  payments: Payment[]
  plans: MembershipPlan[]
  now?: Date
}): { planId: string | null; method: ManualPaymentMethod | null } {
  const { memberships, payments, plans, now } = params
  const shown = memberMembership(memberships, plans, now)
  const plan = plans.find((p) => p.id === shown?.planId)
  const planId = plan && plan.active !== false && !isDayPassPlan(plan) ? plan.id : null

  const last = payments
    .filter((p) => p.status === 'approved')
    .sort((a, b) => paidAt(b) - paidAt(a))[0]
  let method: ManualPaymentMethod | null = null
  if (last?.provider === 'manual') method = last.manualMethod
  else if (last?.provider === 'pagomedios' && RECURRING_NOTE.test(last.notes ?? '')) method = 'pagomedios_recurring'

  return { planId, method }
}

function paidAt(p: Payment) {
  return new Date(p.approvedAt ?? p.createdAt).getTime()
}
