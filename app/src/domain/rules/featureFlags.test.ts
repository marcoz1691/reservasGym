import { describe, expect, it } from 'vitest'
import type { GymSettings, MembershipPlan } from '../models'
import {
  DAY_PASSES_APP_DISABLED_MESSAGE,
  assertPlanSellableInApp,
  isDayPassPlan,
  isFeatureEnabled,
  plansForAppSale,
} from './featureFlags'

const base: GymSettings = {
  name: 'Zona Cero',
  logoUrl: null,
  primaryColor: '#000',
  accentColor: '#F26D17',
  bookingWindowHours: 72,
  cancelWindowHours: 2,
  checkInWindowMinutes: 20,
}

function plan(overrides: Partial<MembershipPlan>): MembershipPlan {
  return {
    id: 'p',
    name: 'Zero Start Mensual',
    priceCents: 3000,
    durationDays: 30,
    visitQuota: null,
    allowedZoneIds: [],
    active: true,
    ...overrides,
  }
}

describe('isFeatureEnabled', () => {
  it.each(['waitlist', 'measurements', 'dayPasses'] as const)(
    '%s: undefined cuenta como encendido',
    (feature) => {
      expect(isFeatureEnabled(base, feature)).toBe(true)
    },
  )

  it('waitlist, measurements y dayPasses se apagan con false', () => {
    const off = {
      ...base,
      waitlistEnabled: false,
      measurementsEnabled: false,
      dayPassesEnabled: false,
    }
    expect(isFeatureEnabled(off, 'waitlist')).toBe(false)
    expect(isFeatureEnabled(off, 'measurements')).toBe(false)
    expect(isFeatureEnabled(off, 'dayPasses')).toBe(false)
  })

  it('onlinePayments necesita true explícito', () => {
    expect(isFeatureEnabled(base, 'onlinePayments')).toBe(false)
    expect(isFeatureEnabled({ ...base, onlinePaymentsEnabled: false }, 'onlinePayments')).toBe(false)
    expect(isFeatureEnabled({ ...base, onlinePaymentsEnabled: true }, 'onlinePayments')).toBe(true)
  })

  it('sin settings: solo onlinePayments queda apagado', () => {
    expect(isFeatureEnabled(null, 'waitlist')).toBe(true)
    expect(isFeatureEnabled(undefined, 'onlinePayments')).toBe(false)
  })
})

describe('pases diarios en la app', () => {
  const monthly = plan({ id: 'm' })
  const zonaDay = plan({ id: 'zd', name: 'Zona Day Full', durationDays: 1, priceCents: 1000 })
  const dayByDuration = plan({ id: 'hx', name: 'Pase Hyrox', durationDays: 1 })

  it('reconoce el pase diario por nombre o por duración de un día', () => {
    expect(isDayPassPlan(zonaDay)).toBe(true)
    expect(isDayPassPlan(dayByDuration)).toBe(true)
    expect(isDayPassPlan(monthly)).toBe(false)
  })

  it('con el interruptor encendido la vitrina muestra todo', () => {
    expect(plansForAppSale([monthly, zonaDay], base)).toEqual([monthly, zonaDay])
  })

  it('con el interruptor apagado la vitrina oculta los pases diarios', () => {
    const off = { ...base, dayPassesEnabled: false }
    expect(plansForAppSale([monthly, zonaDay, dayByDuration], off)).toEqual([monthly])
  })

  it('la compra en la app de un pase diario se rechaza con el interruptor apagado', () => {
    const off = { ...base, dayPassesEnabled: false }
    expect(() => assertPlanSellableInApp(zonaDay, off)).toThrow(DAY_PASSES_APP_DISABLED_MESSAGE)
    expect(() => assertPlanSellableInApp(monthly, off)).not.toThrow()
    expect(() => assertPlanSellableInApp(zonaDay, base)).not.toThrow()
  })
})
