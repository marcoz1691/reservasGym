import { describe, expect, it } from 'vitest'
import {
  nextWaitlistPosition,
  pickWaitlistPromotion,
} from './index'
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
    expect(pickWaitlistPromotion(entries, 's1', () => true).promoted?.id).toBe('b')
  })

  it('assigns next position', () => {
    expect(nextWaitlistPosition(entries, 's1')).toBe(3)
  })

  it('salta a quien no es elegible y promueve al siguiente (ZCAPP-54)', () => {
    const result = pickWaitlistPromotion(entries, 's1', (e) => e.userId !== 'u2')
    expect(result.promoted?.id).toBe('a')
    expect(result.skipped.map((e) => e.id)).toEqual(['b'])
  })

  it('sin elegibles no promueve a nadie y devuelve toda la cola', () => {
    const result = pickWaitlistPromotion(entries, 's1', () => false)
    expect(result.promoted).toBeNull()
    expect(result.skipped.map((e) => e.id)).toEqual(['b', 'a'])
  })
})
