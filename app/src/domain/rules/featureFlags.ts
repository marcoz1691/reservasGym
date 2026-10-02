import type { GymSettings, MembershipPlan } from '../models'
import { isDayPassPlan } from './membershipPlan'

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

/** Planes que el socio puede comprar desde la app. Cobros no usa este filtro. */
export function plansForAppSale<T extends Pick<MembershipPlan, 'name' | 'kind'>>(
  plans: T[],
  settings: FeatureSettings | null | undefined,
): T[] {
  if (isFeatureEnabled(settings, 'dayPasses')) return plans
  return plans.filter((plan) => !isDayPassPlan(plan))
}

export function assertPlanSellableInApp(
  plan: Pick<MembershipPlan, 'name' | 'kind'>,
  settings: FeatureSettings | null | undefined,
): void {
  if (!isFeatureEnabled(settings, 'dayPasses') && isDayPassPlan(plan)) {
    throw new Error(DAY_PASSES_APP_DISABLED_MESSAGE)
  }
}
