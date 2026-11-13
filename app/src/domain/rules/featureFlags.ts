import type { GymSettings, MembershipPlan } from '../models'
import { isDayPassPlan } from './membershipPlan'

export type AppFeature =
  | 'onlinePayments'
  | 'recurringPayments'
  | 'waitlist'
  | 'measurements'
  | 'dayPasses'

const SETTING_BY_FEATURE = {
  onlinePayments: 'onlinePaymentsEnabled',
  recurringPayments: 'recurringPaymentsEnabled',
  waitlist: 'waitlistEnabled',
  measurements: 'measurementsEnabled',
  dayPasses: 'dayPassesEnabled',
} as const satisfies Record<AppFeature, keyof GymSettings>

type FeatureSettings = Partial<Pick<GymSettings, (typeof SETTING_BY_FEATURE)[AppFeature]>>

/**
 * Lista de espera, medidas y pases diarios nacen encendidos: sin dato cuentan como
 * activos. El pago en línea y el recurrente cobran dinero: solo valen con `true` explícito.
 */
export function isFeatureEnabled(
  settings: FeatureSettings | null | undefined,
  feature: AppFeature,
): boolean {
  const value = settings?.[SETTING_BY_FEATURE[feature]]
  return feature === 'onlinePayments' || feature === 'recurringPayments'
    ? value === true
    : value !== false
}

/**
 * La política de reembolsos solo aplica si se cobra en línea: se muestra cuando el admin
 * encendió el pago único, el recurrente o ambos.
 */
export function showsRefundPolicy(settings: FeatureSettings | null | undefined): boolean {
  return isFeatureEnabled(settings, 'onlinePayments') || isFeatureEnabled(settings, 'recurringPayments')
}

/** Mismo texto que el create de pagomedios-payment. */
export const DAY_PASSES_APP_DISABLED_MESSAGE = 'Los pases diarios se venden en recepción'

/** Planes que el socio puede comprar desde la app. Cobros no usa este filtro. */
export function plansForAppSale<T extends Pick<MembershipPlan, 'name' | 'kind' | 'active'>>(
  plans: T[],
  settings: FeatureSettings | null | undefined,
): T[] {
  const sellable = plans.filter((plan) => plan.active)
  if (isFeatureEnabled(settings, 'dayPasses')) return sellable
  return sellable.filter((plan) => !isDayPassPlan(plan))
}

export function assertPlanSellableInApp(
  plan: Pick<MembershipPlan, 'name' | 'kind'>,
  settings: FeatureSettings | null | undefined,
): void {
  if (!isFeatureEnabled(settings, 'dayPasses') && isDayPassPlan(plan)) {
    throw new Error(DAY_PASSES_APP_DISABLED_MESSAGE)
  }
}
