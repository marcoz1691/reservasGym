import { describe, expect, it } from 'vitest'
import { nextWaitlistPosition, nextWaitlistPromotion } from './index'
import type { WaitlistEntry } from '../models'

const entries: WaitlistEntry[] = [
  {
    id: 'a',
    sessionId: 's1',
    userId: 'u1',
    position: 2,
    createdAt: '2030-01-01T10:00:00.000Z',
  },
  {
    id: 'b',
    sessionId: 's1',
    userId: 'u2',
    position: 1,
    createdAt: '2030-01-01T09:00:00.000Z',
  },
]

describe('waitlist', () => {
  it('promotes lowest position first', () => {
    expect(nextWaitlistPromotion(entries, 's1')?.id).toBe('b')
  })

  it('assigns next position', () => {
    expect(nextWaitlistPosition(entries, 's1')).toBe(3)
  })
})
