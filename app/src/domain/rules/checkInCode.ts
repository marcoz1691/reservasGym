import type { Booking } from '../models'

const ACTIVE_STATUSES: Booking['status'][] = ['confirmed', 'pending']

/**
 * Deja el código como lo guarda la base (`QR-XXXXXXXX`).
 * Tolera lo que mandan lectores QR USB/Bluetooth o la cámara: espacios,
 * minúsculas, saltos de línea y el guion cambiado por otro símbolo cuando el
 * lector está configurado con otra distribución de teclado (p. ej. `QR'AB12`).
 * Si llegan solo los 8 caracteres, agrega el prefijo `QR-`.
 */
export function normalizeCheckInCode(raw: string): string {
  const compact = raw.replace(/\s+/g, '').toUpperCase()
  if (!compact) return ''
  const withPrefix = compact.match(/^QR[^A-Z0-9]?([A-Z0-9]+)$/)
  if (withPrefix) return `QR-${withPrefix[1]}`
  if (/^[A-F0-9]{8}$/.test(compact)) return `QR-${compact}`
  return compact
}

/** Reserva activa (confirmada o pendiente) que tiene ese código, o null. */
export function findActiveBookingByCheckInCode(
  bookings: Booking[],
  raw: string,
): Booking | null {
  const code = normalizeCheckInCode(raw)
  if (!code) return null
  return (
    bookings.find(
      (b) =>
        ACTIVE_STATUSES.includes(b.status) &&
        normalizeCheckInCode(b.checkInCode) === code,
    ) ?? null
  )
}
