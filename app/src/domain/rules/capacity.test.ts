import { describe, expect, it } from 'vitest'
import {
  canConfirmBooking,
  isSessionFull,
  remainingSpots,
} from './index'
import type { Session } from '../models'

const base: Session = {
  id: 's1',
  templateId: 't1',
  zoneId: 'z1',
  title: 'Test',
  kind: 'class',
  startsAt: '2030-01-01T10:00:00.000Z',
  endsAt: '2030-01-01T11:00:00.000Z',
  capacity: 2,
  trainerId: null,
  bookedCount: 0,
}

describe('capacity', () => {
  it('calculates remaining spots', () => {
    expect(remainingSpots({ ...base, bookedCount: 1 })).toBe(1)
    expect(isSessionFull({ ...base, bookedCount: 2 })).toBe(true)
    expect(canConfirmBooking({ ...base, bookedCount: 2 })).toBe(false)
  })
})
