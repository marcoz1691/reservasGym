import { describe, expect, it } from 'vitest'
import type { Payment } from '../models'
import { anonymizeDeletedMemberPayments } from './accountDeletion'

const pay = (id: string, extra: Partial<Payment>): Payment => ({
  id,
  userId: 'u1',
  planId: 'mensual',
  membershipId: 'm1',
  amountCents: 1500,
  status: 'approved',
  provider: 'manual',
  manualMethod: 'cash',
  reference: 'REF-1',
  notes: null,
  createdAt: '2026-10-01T10:00:00Z',
  approvedAt: '2026-10-01T10:00:00Z',
  ...extra,
})

describe('anonymizeDeletedMemberPayments', () => {
  it('conserva los cobros aprobados y reembolsados sin socio ni membresía', () => {
    const out = anonymizeDeletedMemberPayments([pay('a', {}), pay('r', { status: 'refunded' })], 'u1')
    expect(out).toHaveLength(2)
    for (const p of out) {
      expect(p).toMatchObject({ userId: null, membershipId: null, amountCents: 1500, planId: 'mensual', reference: 'REF-1' })
    }
  })

  it('quita la cédula de la nota del pago recurrente', () => {
    const [p] = anonymizeDeletedMemberPayments(
      [pay('rec', { provider: 'pagomedios', manualMethod: null, notes: 'Pago recurrente (ID 1723456784): primer mes cobrado.' })],
      'u1',
    )
    expect(p!.notes).toBe('Pago recurrente (ID eliminado): primer mes cobrado.')
  })

  it('borra las solicitudes pendientes y los pagos rechazados', () => {
    const out = anonymizeDeletedMemberPayments([pay('p', { status: 'pending' }), pay('x', { status: 'rejected' })], 'u1')
    expect(out).toEqual([])
  })

  it('no toca los pagos de otros socios', () => {
    const other = pay('o', { userId: 'u2', status: 'pending' })
    expect(anonymizeDeletedMemberPayments([other], 'u1')).toEqual([other])
  })
})
