import { describe, expect, it } from 'vitest'
import type { Booking } from '../models'
import {
  findActiveBookingByCheckInCode,
  normalizeCheckInCode,
} from './checkInCode'

function booking(partial: Partial<Booking>): Booking {
  return {
    id: 'bk_1',
    sessionId: 'ses_1',
    userId: 'u_1',
    status: 'confirmed',
    createdAt: '2026-11-26T10:00:00.000Z',
    cancelledAt: null,
    checkInCode: 'QR-AB12CD34',
    ...partial,
  }
}

describe('normalizeCheckInCode', () => {
  it('deja vacío lo vacío', () => {
    expect(normalizeCheckInCode('')).toBe('')
    expect(normalizeCheckInCode('   \n')).toBe('')
  })

  it('pasa a mayúsculas y quita espacios y saltos de línea', () => {
    expect(normalizeCheckInCode('  qr-ab12cd34\n')).toBe('QR-AB12CD34')
  })

  it('corrige el guion cambiado por la distribución del teclado del lector', () => {
    expect(normalizeCheckInCode("QR'AB12CD34")).toBe('QR-AB12CD34')
    expect(normalizeCheckInCode('QR_AB12CD34')).toBe('QR-AB12CD34')
    expect(normalizeCheckInCode('QRAB12CD34')).toBe('QR-AB12CD34')
  })

  it('agrega el prefijo si llegan solo los 8 caracteres', () => {
    expect(normalizeCheckInCode('ab12cd34')).toBe('QR-AB12CD34')
  })
})

describe('findActiveBookingByCheckInCode', () => {
  const bookings = [
    booking({ id: 'bk_cancel', status: 'cancelled', checkInCode: 'QR-11111111' }),
    booking({ id: 'bk_ok', checkInCode: 'QR-AB12CD34' }),
    booking({ id: 'bk_pend', status: 'pending', checkInCode: 'QR-22222222' }),
    booking({ id: 'bk_done', status: 'attended', checkInCode: 'QR-33333333' }),
  ]

  it('encuentra la reserva confirmada aunque el código venga sucio', () => {
    expect(findActiveBookingByCheckInCode(bookings, ' qr-ab12cd34 ')?.id).toBe('bk_ok')
  })

  it('encuentra reservas pendientes', () => {
    expect(findActiveBookingByCheckInCode(bookings, 'QR-22222222')?.id).toBe('bk_pend')
  })

  it('ignora reservas canceladas o ya asistidas', () => {
    expect(findActiveBookingByCheckInCode(bookings, 'QR-11111111')).toBeNull()
    expect(findActiveBookingByCheckInCode(bookings, 'QR-33333333')).toBeNull()
  })

  it('devuelve null si no hay código o no coincide', () => {
    expect(findActiveBookingByCheckInCode(bookings, '')).toBeNull()
    expect(findActiveBookingByCheckInCode(bookings, 'QR-99999999')).toBeNull()
  })
})
