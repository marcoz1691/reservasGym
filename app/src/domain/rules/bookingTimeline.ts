import type { Booking, BookingStatus, Session } from '../models'

/** Estados de una reserva que el socio todavía tiene por delante. */
const OPEN_STATUSES: ReadonlySet<BookingStatus> = new Set(['confirmed', 'pending', 'waitlisted'])

/**
 * ¿La reserva sigue viva? Estado abierto y la clase todavía no terminó (las que
 * están en curso cuentan). Una clase pasada sin check-in ya no es una reserva
 * activa: no se cancela ni se reagenda (ZCAPP-57).
 */
export function isActiveBooking(
  booking: Pick<Booking, 'status'>,
  session: Pick<Session, 'endsAt'> | undefined,
  now: Date = new Date(),
): boolean {
  if (!OPEN_STATUSES.has(booking.status) || !session) return false
  return new Date(session.endsAt).getTime() > now.getTime()
}

/** Reservas activas de un socio (menú, Inicio y "Mis clases" usan la misma regla). */
export function selectActiveBookings<B extends Pick<Booking, 'userId' | 'status' | 'sessionId'>>(
  bookings: B[],
  sessions: Pick<Session, 'id' | 'endsAt'>[],
  userId: string,
  now: Date = new Date(),
): B[] {
  return bookings.filter(
    (b) =>
      b.userId === userId &&
      isActiveBooking(b, sessions.find((s) => s.id === b.sessionId), now),
  )
}

/** Estado de la reserva en palabras del socio, en español. */
export function bookingStatusLabel(
  booking: Pick<Booking, 'status'>,
  session: Pick<Session, 'endsAt'> | undefined,
  now: Date = new Date(),
): string {
  const ended = !session || new Date(session.endsAt).getTime() <= now.getTime()
  switch (booking.status) {
    case 'attended':
      return 'Asististe'
    case 'no_show':
      return 'No asististe'
    case 'cancelled':
      return 'Cancelada'
    case 'waitlisted':
      return ended ? 'Sin cupo' : 'En espera'
    case 'pending':
      return ended ? 'No asististe' : 'Pendiente'
    case 'confirmed':
      return ended ? 'No asististe' : 'Confirmada'
  }
}
