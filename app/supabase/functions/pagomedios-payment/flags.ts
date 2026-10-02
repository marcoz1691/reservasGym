// Interruptores del admin (gym_settings, feature-flags.sql) que frenan el create.
// Sin imports para que lo puedan probar los tests de la app (Vitest), igual que tax.ts.

export const ONLINE_PAYMENTS_DISABLED = "Pago en línea desactivado"
export const DAY_PASSES_DISABLED = "Los pases diarios se venden en recepción"

export type FlagSettings = {
  online_payments_enabled?: boolean | null
  day_passes_enabled?: boolean | null
} | null

export type PlanForFlags = { name: string; kind?: string | null }

export type CreateBlock = { status: number; error: string }

/** Sin fila o sin columna cuenta como apagado: cobrar exige que el admin lo encienda. */
export function onlinePaymentsBlock(settings: FlagSettings): CreateBlock | null {
  return settings?.online_payments_enabled === true
    ? null
    : { status: 503, error: ONLINE_PAYMENTS_DISABLED }
}

/** Misma regla que isDayPassPlan en src/domain/rules/membershipPlan.ts. */
export function isDayPassPlan(plan: PlanForFlags): boolean {
  if (plan.kind) return plan.kind === "day_pass"
  return plan.name.toLowerCase().includes("zona day")
}

export function dayPassBlock(settings: FlagSettings, plan: PlanForFlags): CreateBlock | null {
  return settings?.day_passes_enabled === false && isDayPassPlan(plan)
    ? { status: 403, error: DAY_PASSES_DISABLED }
    : null
}
