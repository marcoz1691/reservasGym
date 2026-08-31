import { describe, expect, it } from 'vitest'
import {
  canBookSession,
  canCancelFree,
  canManageWeight,
  confirmedCount,
  hasOverlap,
  isCheckInWindow,
  nextWaitlistPosition,
  promoteFirstWaitlist,
} from './rules'
import type { Booking, Session, WaitlistEntry } from './models'

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
  bookedCount: 0,
}

function booking(
  partial: Partial<Booking> & Pick<Booking, 'id' | 'sessionId' | 'userId' | 'status'>,
): Booking {
  return {
    createdAt: '2026-08-01T00:00:00.000Z',
    cancelledAt: null,
    checkInCode: `QR-${partial.id}`,
    ...partial,
  }
}

describe('domain rules', () => {
  it('counts confirmed bookings', () => {
    expect(
      confirmedCount(
        [
          booking({ id: 'b1', sessionId: 's1', userId: 'u1', status: 'confirmed' }),
          booking({ id: 'b2', sessionId: 's1', userId: 'u2', status: 'cancelled' }),
        ],
        's1',
      ),
    ).toBe(1)
  })

  it('blocks booking when full', () => {
    const bookings = [
      booking({ id: 'b1', sessionId: 's1', userId: 'u1', status: 'confirmed' }),
      booking({ id: 'b2', sessionId: 's1', userId: 'u2', status: 'confirmed' }),
    ]
    expect(canBookSession(session, bookings)).toEqual({
      ok: false,
      reason: 'full',
    })
  })

  it('detects overlap', () => {
    const bookings = [
      booking({ id: 'b1', sessionId: 's1', userId: 'u1', status: 'confirmed' }),
    ]
    const other: Session = {
      ...session,
      id: 's2',
      startsAt: '2026-09-01T10:30:00.000Z',
      endsAt: '2026-09-01T11:30:00.000Z',
    }
    expect(hasOverlap([session, other], bookings, 'u1', other)).toBe(true)
  })

  it('assigns waitlist position and promotes first', () => {
    const waitlist: WaitlistEntry[] = [
      { id: 'w2', sessionId: 's1', userId: 'u2', position: 2, createdAt: '' },
      { id: 'w1', sessionId: 's1', userId: 'u1', position: 1, createdAt: '' },
    ]
    expect(nextWaitlistPosition(waitlist, 's1')).toBe(3)
    expect(promoteFirstWaitlist(waitlist, 's1')?.id).toBe('w1')
  })

  it('enforces cancel and check-in windows', () => {
    const start = '2026-09-01T12:00:00.000Z'
    expect(canCancelFree(start, new Date('2026-09-01T09:00:00.000Z'), 2)).toBe(
      true,
    )
    expect(canCancelFree(start, new Date('2026-09-01T11:00:00.000Z'), 2)).toBe(
      false,
    )
    expect(
      isCheckInWindow(start, new Date('2026-09-01T11:50:00.000Z'), 15, 10),
    ).toBe(true)
  })

  it('authorizes weight CRUD', () => {
    expect(canManageWeight('staff', 's1', 'm1')).toBe(true)
    expect(canManageWeight('member', 'm1', 'm2')).toBe(false)
    expect(canManageWeight('member', 'm1', 'm1')).toBe(true)
  })
})
