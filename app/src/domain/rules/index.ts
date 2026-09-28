import type { Booking, Session, WaitlistEntry } from '../models'

export function confirmedCount(bookings: Booking[], sessionId: string): number {
  return bookings.filter(
    (b) => b.sessionId === sessionId && b.status === 'confirmed',
  ).length
}

export function remainingSpots(session: Session): number {
  return Math.max(0, session.capacity - session.bookedCount)
}

export function isSessionFull(session: Session): boolean {
  return remainingSpots(session) <= 0
}

export function canBookSession(
  session: Session,
  bookings: Booking[],
): { ok: true } | { ok: false; reason: 'full' } {
  if (confirmedCount(bookings, session.id) >= session.capacity) {
    return { ok: false, reason: 'full' }
  }
  return { ok: true }
}

export function canConfirmBooking(session: Session): boolean {
  return !isSessionFull(session)
}

export function hasOverlap(
  sessions: Session[],
  bookings: Booking[],
  userId: string,
  candidate: Session,
  excludeBookingId?: string,
): boolean {
  const active = bookings.filter(
    (b) =>
      b.userId === userId &&
      b.id !== excludeBookingId &&
      (b.status === 'confirmed' || b.status === 'pending'),
  )
  const start = new Date(candidate.startsAt).getTime()
  const end = new Date(candidate.endsAt).getTime()
  return active.some((b) => {
    const s = sessions.find((x) => x.id === b.sessionId)
    if (!s) return false
    const a = new Date(s.startsAt).getTime()
    const z = new Date(s.endsAt).getTime()
    return start < z && end > a
  })
}

export function hasOverlappingBooking(
  userId: string,
  candidate: Session,
  bookings: Booking[],
  sessions: Session[],
  excludeBookingId?: string,
): boolean {
  return hasOverlap(sessions, bookings, userId, candidate, excludeBookingId)
}

export function nextWaitlistPosition(
  waitlist: WaitlistEntry[],
  sessionId: string,
): number {
  const forSession = waitlist.filter((w) => w.sessionId === sessionId)
  return forSession.length === 0
    ? 1
    : Math.max(...forSession.map((w) => w.position)) + 1
}


/** Mismo texto que `reschedule_booking` en booking-rpc.sql. */
export const RESCHEDULE_FULL_MESSAGE =
  'La clase nueva está llena. Tu reserva actual no cambió.'

/**
 * Primer socio de la cola que puede pasar a confirmado. Los que ya no son
 * elegibles (se solapan con otra reserva o su plan no les permite reservar)
 * vuelven en `skipped` para sacarlos de la cola (ZCAPP-54).
 */
export function pickWaitlistPromotion(
  waitlist: WaitlistEntry[],
  sessionId: string,
  isEligible: (entry: WaitlistEntry) => boolean,
): { promoted: WaitlistEntry | null; skipped: WaitlistEntry[] } {
  const skipped: WaitlistEntry[] = []
  const ordered = waitlist
    .filter((w) => w.sessionId === sessionId)
    .sort((a, b) => a.position - b.position)
  for (const entry of ordered) {
    if (isEligible(entry)) return { promoted: entry, skipped }
    skipped.push(entry)
  }
  return { promoted: null, skipped }
}

export function reindexWaitlist(
  waitlist: WaitlistEntry[],
  sessionId: string,
): WaitlistEntry[] {
  const others = waitlist.filter((w) => w.sessionId !== sessionId)
  const queue = waitlist
    .filter((w) => w.sessionId === sessionId)
    .sort((a, b) => a.position - b.position)
    .map((e, i) => ({ ...e, position: i + 1 }))
  return [...others, ...queue]
}

export function canCancelFree(
  sessionStartsAt: string,
  now: Date,
  hoursBefore = 2,
): boolean {
  const start = new Date(sessionStartsAt).getTime()
  return start - now.getTime() >= hoursBefore * 60 * 60 * 1000
}

/** (startsAt, cancelWindowHours, now?) */
export function canCancelBooking(
  sessionStartsAt: string,
  cancelWindowHours: number,
  now: Date = new Date(),
): boolean {
  return canCancelFree(sessionStartsAt, now, cancelWindowHours)
}

export function isCheckInWindow(
  sessionStartsAt: string,
  now: Date,
  minutesBefore = 15,
  minutesAfter = 10,
): boolean {
  const start = new Date(sessionStartsAt).getTime()
  const t = now.getTime()
  return (
    t >= start - minutesBefore * 60_000 && t <= start + minutesAfter * 60_000
  )
}

/** (startsAt, windowMinutes, now?) — ventana simétrica */
export function isCheckInWindowOpen(
  sessionStartsAt: string,
  windowMinutes: number,
  now: Date = new Date(),
): boolean {
  return isCheckInWindow(sessionStartsAt, now, windowMinutes, windowMinutes)
}

export function buildCheckInPayload(
  bookingId: string,
  sessionId: string,
  userId: string,
): string {
  return JSON.stringify({ bookingId, sessionId, userId, v: 1 })
}

export function canManageWeight(
  actorRole: 'member' | 'staff' | 'admin',
  actorId: string,
  targetUserId: string,
): boolean {
  if (actorRole === 'staff' || actorRole === 'admin') return true
  return actorId === targetUserId
}

export function canRecordWeight(
  actor: { id: string; role: 'member' | 'staff' | 'admin' },
  targetUserId: string,
): boolean {
  return canManageWeight(actor.role, actor.id, targetUserId)
}

export * from './membership'
export * from './membershipPlan'
export * from './zoneAccess'
export * from './anthropometrics'
export * from './profile'
export * from './planRequest'

export * from './bookingTimeline'
