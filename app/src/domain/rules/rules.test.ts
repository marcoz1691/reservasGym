import { describe, expect, it } from 'vitest'
import {
  canBookSession,
  canCancelBooking,
  canManageWeight,
  canRecordWeight,
  hasOverlap,
  isCheckInWindow,
  isCheckInWindowOpen,
  nextWaitlistPosition,
  pickWaitlistPromotion,
  seatsTaken,
} from './index'
import type { Booking, Session } from '../models'

const session: Session = {
  id: 's1',
  templateId: 't1',
  zoneId: 'z1',
  trainerId: 'tr1',
  title: 'CrossFit',
  startsAt: '2026-09-01T10:00:00.000Z',
  endsAt: '2026-09-01T11:00:00.000Z',
  capacity: 2,
  kind: 'class',
  bookedCount: 1,
}

function bk(
  partial: Partial<Booking> & Pick<Booking, 'id' | 'userId' | 'status'>,
): Booking {
  return {
    sessionId: 's1',
    createdAt: '',
    cancelledAt: null,
    checkInCode: 'X',
    ...partial,
  }
}

describe('rules', () => {
  it('blocks when full', () => {
    const bookings = [
      bk({ id: 'b1', userId: 'u1', status: 'confirmed' }),
      bk({ id: 'b2', userId: 'u2', status: 'confirmed' }),
    ]
    expect(seatsTaken(bookings, 's1')).toBe(2)
    expect(canBookSession(session, bookings)).toEqual({ ok: false, reason: 'full' })
  })

  it('el check-in no libera el cupo: asistió y pendiente siguen ocupando lugar', () => {
    const bookings = [
      bk({ id: 'b1', userId: 'u1', status: 'attended' }),
      bk({ id: 'b2', userId: 'u2', status: 'pending' }),
      bk({ id: 'b3', userId: 'u3', status: 'cancelled' }),
      bk({ id: 'b4', userId: 'u4', status: 'waitlisted' }),
    ]
    expect(seatsTaken(bookings, 's1')).toBe(2)
    expect(canBookSession(session, bookings)).toEqual({ ok: false, reason: 'full' })
  })

  it('waitlist helpers', () => {
    expect(
      nextWaitlistPosition(
        [{ id: 'w1', sessionId: 's1', userId: 'u1', position: 1, createdAt: '' }],
        's1',
      ),
    ).toBe(2)
    expect(
      pickWaitlistPromotion(
        [
          { id: 'w2', sessionId: 's1', userId: 'u2', position: 2, createdAt: '' },
          { id: 'w1', sessionId: 's1', userId: 'u1', position: 1, createdAt: '' },
        ],
        's1',
        () => true,
      ).promoted?.id,
    ).toBe('w1')
  })

  it('overlap', () => {
    const bookings = [bk({ id: 'b1', userId: 'u1', status: 'confirmed' })]
    const other: Session = {
      ...session,
      id: 's2',
      startsAt: '2026-09-01T10:30:00.000Z',
      endsAt: '2026-09-01T11:30:00.000Z',
    }
    expect(hasOverlap([session, other], bookings, 'u1', other)).toBe(true)
  })

  it('cancel / check-in / weight', () => {
    const start = '2030-06-01T15:00:00.000Z'
    const now = new Date('2030-06-01T12:00:00.000Z')
    expect(canCancelBooking(start, 2, now)).toBe(true)
    expect(isCheckInWindow(start, new Date('2030-06-01T15:05:00.000Z'), 15, 10)).toBe(
      true,
    )
    expect(isCheckInWindowOpen(start, 30, new Date('2030-06-01T15:10:00.000Z'))).toBe(
      true,
    )
    expect(canManageWeight('member', 'm1', 'm1')).toBe(true)
    expect(canManageWeight('member', 'm1', 'm2')).toBe(false)
    expect(canRecordWeight({ id: 's1', role: 'staff' }, 'm2')).toBe(true)
  })
})
