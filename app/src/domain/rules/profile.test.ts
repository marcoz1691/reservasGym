import { describe, expect, it } from 'vitest'
import type { User } from '../models'
import { isFichaPending } from './profile'

const member: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('isFichaPending', () => {
  it('es true cuando al socio le faltan estatura y peso inicial', () => {
    expect(isFichaPending(member)).toBe(true)
  })

  it('es true cuando solo tiene estatura', () => {
    expect(isFichaPending({ ...member, heightCm: 175 })).toBe(true)
  })

  it('es true cuando solo tiene peso inicial', () => {
    expect(isFichaPending({ ...member, initialWeightKg: 75 })).toBe(true)
  })

  it('es false cuando ya tiene estatura y peso inicial', () => {
    expect(
      isFichaPending({ ...member, heightCm: 175, initialWeightKg: 75 }),
    ).toBe(false)
  })

  it('es false para staff y admin aunque no tengan ficha', () => {
    expect(isFichaPending({ ...member, role: 'staff' })).toBe(false)
    expect(isFichaPending({ ...member, role: 'admin' })).toBe(false)
  })

  it('es false sin usuario', () => {
    expect(isFichaPending(null)).toBe(false)
    expect(isFichaPending(undefined)).toBe(false)
  })
})
