import { describe, expect, it } from 'vitest'
import {
  chargeReference,
  isRecurringEligiblePlan,
  isUnresolvedRecurring,
  parseRecurringNote,
  pickRegisteredCard,
  recurringNote,
  registrationOutcome,
} from '../../supabase/functions/pagomedios-payment/recurring'

describe('pagomedios-payment: pago recurrente', () => {
  describe('planes que admiten débito mensual', () => {
    it('solo los mensuales (28 a 31 días) que no son pase del día', () => {
      expect(isRecurringEligiblePlan({ duration_days: 30 })).toBe(true)
      expect(isRecurringEligiblePlan({ durationDays: 31 })).toBe(true)
      expect(isRecurringEligiblePlan({ duration_days: 90 })).toBe(false)
      expect(isRecurringEligiblePlan({ duration_days: 7 })).toBe(false)
      expect(isRecurringEligiblePlan({ duration_days: 30, kind: 'day_pass' })).toBe(false)
    })
  })

  describe('nota del pago', () => {
    it('es legible para recepción y se puede leer de vuelta', () => {
      const note = recurringNote('charging', '1723358400')
      expect(note).toBe('Pago recurrente (ID 1723358400): cobrando el primer mes.')
      expect(parseRecurringNote(note)).toEqual({ stage: 'charging', document: '1723358400' })
    })

    it('cada etapa se distingue', () => {
      for (const stage of ['registering', 'charging', 'charged', 'rejected', 'rejected_card_kept', 'review'] as const) {
        expect(parseRecurringNote(recurringNote(stage, 'A1234567'))?.stage).toBe(stage)
      }
    })

    it('cobrando, cobrado o en revisión cuentan como no resueltos', () => {
      expect(isUnresolvedRecurring(recurringNote('charging', '1'))).toBe(true)
      expect(isUnresolvedRecurring(recurringNote('charged', '1'))).toBe(true)
      expect(isUnresolvedRecurring(recurringNote('review', '1'))).toBe(true)
      expect(isUnresolvedRecurring(recurringNote('registering', '1'))).toBe(false)
      expect(isUnresolvedRecurring(recurringNote('rejected', '1'))).toBe(false)
      expect(isUnresolvedRecurring(null)).toBe(false)
    })

    it('un pago único u otra nota no es recurrente', () => {
      expect(parseRecurringNote(null)).toBeNull()
      expect(parseRecurringNote('Requiere revisión: ya había otro plan en espera al aprobar el pago.')).toBeNull()
    })
  })

  describe('resultado del registro de tarjeta', () => {
    it('autorizada y reversada (el $1,15 de validación) cuenta como registrada', () => {
      expect(
        registrationOutcome({ status: 3, transactions: [{ status: 3, auth_code: '134541' }] }),
      ).toBe('registered')
      expect(registrationOutcome({ status: 1, transactions: [{ auth_code: '1' }] })).toBe('registered')
    })

    it('sin respuesta o en estado 0 sigue pendiente', () => {
      expect(registrationOutcome(null)).toBe('pending')
      expect(registrationOutcome({ status: 0, transactions: [{ status: 0, auth_code: null }] })).toBe('pending')
    })

    it('rechazada, o reversada sin autorización, es rechazo', () => {
      expect(registrationOutcome({ status: 2, transactions: [{ auth_code: null }] })).toBe('rejected')
      expect(registrationOutcome({ status: 3, transactions: [] })).toBe('rejected')
    })
  })

  describe('tarjeta a cobrar', () => {
    const request = {
      created_at: '2026-10-11 00:14:30',
      transactions: [{ display_number: '420000******0000', auth_code: '1' }],
    }
    const cards = [
      { token: 'vieja', number: '420000******0000', created_at: '2026-09-01 10:00:00' },
      { token: 'otra-nueva', number: '510510******5100', created_at: '2026-10-11 00:15:00' },
      { token: 'nueva', number: '420000******0000', created_at: '2026-10-11 00:14:49' },
    ]

    it('el token del notify solo desempata entre las tarjetas del registro', () => {
      expect(pickRegisteredCard(cards, request, 'nueva')?.token).toBe('nueva')
      expect(pickRegisteredCard(cards, request, 'inventado')?.token).toBe('nueva')
    })

    it('un notify con un token antiguo del mismo documento no cambia la tarjeta cobrada', () => {
      expect(pickRegisteredCard(cards, request, 'vieja')?.token).toBe('nueva')
      expect(pickRegisteredCard(cards, request, 'otra-nueva')?.token).toBe('nueva')
    })

    it('sin token: la creada desde la solicitud con los mismos últimos 4 dígitos', () => {
      expect(pickRegisteredCard(cards, request)?.token).toBe('nueva')
    })

    it('si ninguna se creó después de la solicitud no cobra ninguna', () => {
      expect(pickRegisteredCard([cards[0]!], request)).toBeNull()
    })
  })

  it('la referencia del cobro es fija por pago y cabe en 20 caracteres', () => {
    const ref = chargeReference('3f2a9c1e-7b4d-4e8a-9f00-123456789abc')
    expect(ref).toBe('ZC3F2A9C1E7B4D4E8A9F')
    expect(ref).toHaveLength(20)
    expect(chargeReference('3f2a9c1e-7b4d-4e8a-9f00-123456789abc')).toBe(ref)
  })
})
