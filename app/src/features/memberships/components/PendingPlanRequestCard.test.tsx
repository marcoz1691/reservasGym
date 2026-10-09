import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { GymSettings, Payment } from '@/domain/models'
import { PAYMENT_VALIDATION_NOTICE } from '@/domain/rules/planRequest'
import { PendingPlanRequestCard } from './PendingPlanRequestCard'

const settings: GymSettings = {
  name: 'Zona Cero',
  logoUrl: null,
  primaryColor: '#000000',
  accentColor: '#F26D17',
  bookingWindowHours: 168,
  cancelWindowHours: 2,
  checkInWindowMinutes: 15,
  whatsappPayments: '0991234567',
  bankName: 'Banco Pichincha',
  bankAccountNumber: '2201234567',
}

const request: Payment = {
  id: 'pay_1',
  userId: 'u1',
  planId: 'plan_1',
  membershipId: null,
  amountCents: 3500,
  status: 'pending',
  provider: 'manual',
  manualMethod: 'transfer',
  reference: 'ZC-4F7A2C',
  createdAt: '2026-10-01T12:00:00.000Z',
  approvedAt: null,
}

function renderCard(payment: Payment, overrides: Partial<GymSettings> = {}) {
  return render(
    <PendingPlanRequestCard
      payment={payment}
      planName="Zero Pro Mensual"
      settings={{ ...settings, ...overrides }}
      memberName="Ana Pérez"
    />,
  )
}

describe('PendingPlanRequestCard', () => {
  it.each(['transfer', 'deuna'] as const)(
    'con %s muestra el aviso, la referencia y el botón de WhatsApp',
    (manualMethod) => {
      renderCard({ ...request, manualMethod }, { deunaCode: 'ZONACERO01' })

      expect(screen.getByText(PAYMENT_VALIDATION_NOTICE)).toBeInTheDocument()
      expect(screen.getByText('ZC-4F7A2C')).toBeInTheDocument()
      const link = screen.getByRole('link', { name: 'Enviar comprobante por WhatsApp' })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      const text = new URL(link.getAttribute('href')!).searchParams.get('text')!
      expect(text).toContain('Ana Pérez')
      expect(text).toContain('ZC-4F7A2C')
      expect(screen.queryByText(/Pendiente de pago en recepción/)).toBeNull()
    },
  )

  it('sin WhatsApp configurado no hay botón y pide mostrar el comprobante en recepción', () => {
    renderCard(request, { whatsappPayments: null })

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText(/muestra tu comprobante en recepción/)).toBeInTheDocument()
    expect(screen.getByText(PAYMENT_VALIDATION_NOTICE)).toBeInTheDocument()
  })

  it('en efectivo mantiene el aviso de pagar en recepción', () => {
    renderCard({ ...request, manualMethod: 'cash' })

    expect(screen.getByText(/Pendiente de pago en recepción/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText(PAYMENT_VALIDATION_NOTICE)).toBeNull()
  })
})
