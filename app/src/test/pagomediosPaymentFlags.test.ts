import { describe, expect, it } from 'vitest'
import {
  DAY_PASSES_DISABLED,
  ONLINE_PAYMENTS_DISABLED,
  dayPassBlock,
  isDayPassPlan,
  onlinePaymentsBlock,
} from '../../supabase/functions/pagomedios-payment/flags'
import { DAY_PASSES_APP_DISABLED_MESSAGE, isDayPassPlan as domainIsDayPass } from '@/domain/rules'

describe('pagomedios-payment: interruptor del pago en línea', () => {
  it('apagado responde 503 "Pago en línea desactivado"', () => {
    expect(onlinePaymentsBlock({ online_payments_enabled: false })).toEqual({
      status: 503,
      error: ONLINE_PAYMENTS_DISABLED,
    })
  })

  it('sin fila o sin columna (migración pendiente) también bloquea', () => {
    expect(onlinePaymentsBlock(null)?.status).toBe(503)
    expect(onlinePaymentsBlock({})?.status).toBe(503)
  })

  it('encendido deja crear el cobro', () => {
    expect(onlinePaymentsBlock({ online_payments_enabled: true })).toBeNull()
  })
})

describe('pagomedios-payment: pases diarios apagados', () => {
  const zonaDay = { name: 'Zona Day Musculación', duration_days: 1 }
  const monthly = { name: 'Zero Start Mensual', duration_days: 30 }

  it('rechaza un pase diario con el mismo texto que la app', () => {
    expect(dayPassBlock({ day_passes_enabled: false }, zonaDay)).toEqual({
      status: 403,
      error: DAY_PASSES_DISABLED,
    })
    expect(DAY_PASSES_DISABLED).toBe(DAY_PASSES_APP_DISABLED_MESSAGE)
  })

  it('deja pasar planes normales y pases con el interruptor encendido o sin dato', () => {
    expect(dayPassBlock({ day_passes_enabled: false }, monthly)).toBeNull()
    expect(dayPassBlock({ day_passes_enabled: true }, zonaDay)).toBeNull()
    expect(dayPassBlock({}, zonaDay)).toBeNull()
  })

  it('reconoce el pase diario igual que el dominio de la app', () => {
    for (const plan of [zonaDay, monthly, { name: 'Pase Hyrox', duration_days: 1 }]) {
      expect(isDayPassPlan(plan)).toBe(
        domainIsDayPass({ name: plan.name, durationDays: plan.duration_days }),
      )
    }
  })
})
