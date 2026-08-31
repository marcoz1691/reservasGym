import { describe, expect, it } from 'vitest'
import { hasOverlappingBooking } from './index'
import type { Booking, Session } from '../models'

const sessions: Session[] = [
  {
    id: 's1',
    templateId: 't',
    zoneId: 'z',
    title: 'A',
    kind: 'class',
    startsAt: '2030-01-01T10:00:00.000Z',
    endsAt: '2030-01-01T11:00:00.000Z',
    capacity: 10,
    trainerId: null,
    bookedCount: 1,
  },
  {
    id: 's2',
    templateId: 't',
    zoneId: 'z',
    title: 'B',
    kind: 'class',
    startsAt: '2030-01-01T10:30:00.000Z',
    endsAt: '2030-01-01T11:30:00.000Z',
    capacity: 10,
    trainerId: null,
    bookedCount: 0,
  },
]

const bookings: Booking[] = [
  {
    id: 'b1',
    sessionId: 's1',
    userId: 'u1',
    status: 'confirmed',
    createdAt: '2030-01-01T08:00:00.000Z',
    cancelledAt: null,
    checkInCode: 'x',
  },
]

describe('overlap', () => {
  it('detects overlapping sessions', () => {
    expect(
      hasOverlappingBooking('u1', sessions[1]!, bookings, sessions),
    ).toBe(true)
  })
})
