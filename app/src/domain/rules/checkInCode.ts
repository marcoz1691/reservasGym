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

export type CheckInTiming =
  | { kind: 'early'; opensAt: Date }
  | { kind: 'open'; minutesToStart: number }
  | { kind: 'closed' }

/**
 * En qué momento de la ventana de check-in está una clase. Usa las mismas
 * reglas que la base (check_in_booking): desde `minutesBefore` antes del
 * inicio hasta `minutesAfter` después.
 */
export function getCheckInTiming(
  sessionStartsAt: string,
  now: Date,
  minutesBefore = 15,
  minutesAfter = 10,
): CheckInTiming {
  const start = new Date(sessionStartsAt).getTime()
  const t = now.getTime()
  const opensAt = start - minutesBefore * 60_000
  if (t < opensAt) return { kind: 'early', opensAt: new Date(opensAt) }
  if (t > start + minutesAfter * 60_000) return { kind: 'closed' }
  return { kind: 'open', minutesToStart: Math.round((start - t) / 60_000) }
}
