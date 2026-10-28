import { beforeEach, expect, it } from 'vitest'
import { LocalRepository } from './localRepository'
import type { GymState } from '@/domain/models'
beforeEach(() => localStorage.clear())
const persisted = () => JSON.parse(localStorage.getItem('reservasgym.intermedia.v2')!) as GymState

it('persiste usuario, contexto, versión y fecha del registro y de la ficha sin sobrescribir', async () => {
  const repo = new LocalRepository()
  const user = await repo.signUp({
    fullName: 'Socio Legal', email: 'legal@example.com', password: 'password123',
    consents: [{ document: 'terms', version: '1.0' }, { document: 'privacy', version: '1.0' }],
  })
  await repo.recordLegalConsents('ficha', [{ document: 'health_data', version: '1.0' }])
  await repo.recordLegalConsents('checkout', [{ document: 'privacy', version: '2.0' }])
  const consents = persisted().legalConsents!
  expect(consents).toHaveLength(4)
  expect(consents.map(c => c.context)).toEqual(['signup', 'signup', 'ficha', 'checkout'])
  for (const consent of consents) {
    expect(consent.userId).toBe(user.id)
    expect(Number.isFinite(Date.parse(consent.acceptedAt))).toBe(true)
  }
  expect(consents[2]).toMatchObject({ document: 'health_data', version: '1.0' })
  expect(consents[3]).toMatchObject({ document: 'privacy', version: '2.0' })
  expect(new Set(consents.map(c => c.id)).size).toBe(4)
})

it('rechaza consentimientos sin sesión', async () => {
  await expect(new LocalRepository().recordLegalConsents('ficha', [
    { document: 'health_data', version: '1.0' },
  ])).rejects.toThrow()
})
