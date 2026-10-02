import type { GymSettings, MembershipPlan } from '../models'

export type AppFeature = 'onlinePayments' | 'waitlist' | 'measurements' | 'dayPasses'

const SETTING_BY_FEATURE = {
  onlinePayments: 'onlinePaymentsEnabled',
  waitlist: 'waitlistEnabled',
  measurements: 'measurementsEnabled',
  dayPasses: 'dayPassesEnabled',
} as const satisfies Record<AppFeature, keyof GymSettings>

type FeatureSettings = Partial<Pick<GymSettings, (typeof SETTING_BY_FEATURE)[AppFeature]>>

/**
 * Lista de espera, medidas y pases diarios nacen encendidos: sin dato cuentan como
 * activos. El pago en línea cobra dinero, así que solo vale con `true` explícito.
 */
export function isFeatureEnabled(
  settings: FeatureSettings | null | undefined,
  feature: AppFeature,
): boolean {
  const value = settings?.[SETTING_BY_FEATURE[feature]]
  return feature === 'onlinePayments' ? value === true : value !== false
}

/** Mismo texto que el create de pagomedios-payment. */
export const DAY_PASSES_APP_DISABLED_MESSAGE = 'Los pases diarios se venden en recepción'

/**
 * Provisional hasta que exista membership_plans.kind (Parte A): entonces pasa a
 * `plan.kind === 'day_pass'`. Misma regla que isDayPassPlan en pagomedios-payment/flags.ts.
 */
export function isDayPassPlan(plan: Pick<MembershipPlan, 'name' | 'durationDays'>): boolean {
  return plan.durationDays === 1 || /zona\s*day/i.test(plan.name)
}

/** Planes que el socio puede comprar desde la app. Cobros no usa este filtro. */
export function plansForAppSale<T extends Pick<MembershipPlan, 'name' | 'durationDays'>>(
  plans: T[],
  settings: FeatureSettings | null | undefined,
): T[] {
  if (isFeatureEnabled(settings, 'dayPasses')) return plans
  return plans.filter((plan) => !isDayPassPlan(plan))
}

export function assertPlanSellableInApp(
  plan: Pick<MembershipPlan, 'name' | 'durationDays'>,
  settings: FeatureSettings | null | undefined,
): void {
  if (!isFeatureEnabled(settings, 'dayPasses') && isDayPassPlan(plan)) {
    throw new Error(DAY_PASSES_APP_DISABLED_MESSAGE)
  }
}
