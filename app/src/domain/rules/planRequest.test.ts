import { describe, expect, it } from 'vitest'
import type { Payment } from '@/domain/models'
import { selectDiscardedPlanRequest, selectPendingPlanRequest } from './planRequest'

const now = new Date('2026-10-21T15:00:00Z')

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: 'pay-1',
    userId: 'u1',
    planId: 'plan-1',
    membershipId: null,
    amountCents: 3500,
    status: 'pending',
    provider: 'manual',
    manualMethod: 'transfer',
    reference: 'ZC-4F7A2C',
    createdAt: '2026-10-20T15:00:00Z',
    approvedAt: null,
    ...overrides,
  }
}

describe('selectPendingPlanRequest', () => {
  it('una solicitud descartada ya no es pendiente', () => {
    expect(selectPendingPlanRequest([payment({ status: 'rejected' })], 'u1')).toBeNull()
  })
})

describe('selectDiscardedPlanRequest (ZCAPP-84)', () => {
  it('devuelve la última solicitud manual descartada del socio', () => {
    const discarded = payment({ status: 'rejected' })
    expect(selectDiscardedPlanRequest([discarded], 'u1', now)?.id).toBe('pay-1')
  })

  it('no avisa si después hubo otro pago o solicitud', () => {
    const payments = [
      payment({ status: 'rejected' }),
      payment({ id: 'pay-2', status: 'pending', createdAt: '2026-10-21T10:00:00Z' }),
    ]
    expect(selectDiscardedPlanRequest(payments, 'u1', now)).toBeNull()
  })

  it('no avisa por solicitudes descartadas hace más de 30 días', () => {
    const old = payment({ status: 'rejected', createdAt: '2026-09-01T15:00:00Z' })
    expect(selectDiscardedPlanRequest([old], 'u1', now)).toBeNull()
  })

  it('ignora pagos en línea rechazados y los de otros socios', () => {
    const payments = [
      payment({ status: 'rejected', provider: 'pagomedios', manualMethod: null }),
      payment({ id: 'pay-3', userId: 'u2', status: 'rejected' }),
    ]
    expect(selectDiscardedPlanRequest(payments, 'u1', now)).toBeNull()
  })
})
