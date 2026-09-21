import { describe, expect, it } from 'vitest'
import type { User } from '../models'
import { displayFirstName, displayInitials, isFichaPending } from './profile'

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

describe('displayFirstName', () => {
  it('usa el primer nombre real', () => {
    expect(displayFirstName('Juan Pérez')).toBe('Juan')
    expect(displayFirstName('Ana Socio')).toBe('Ana')
  })

  it('no saluda como Socio/Staff/Admin cuando es solo el rol de la cuenta', () => {
    expect(displayFirstName('Socio Demo Staging')).toBe('Demo')
    expect(displayFirstName('Staff Zona Cero')).toBe('Zona')
  })

  it('tolera vacío', () => {
    expect(displayFirstName('')).toBe('')
    expect(displayFirstName(null)).toBe('')
  })
})

describe('displayInitials', () => {
  it('omite el prefijo de rol', () => {
    expect(displayInitials('Socio Demo Staging')).toBe('DS')
    expect(displayInitials('Juan Pérez')).toBe('JP')
  })
})
