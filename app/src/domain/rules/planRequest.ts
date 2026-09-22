import type { ManualPaymentMethod, Payment } from '@/domain/models'

export const MANUAL_PAYMENT_LABELS: Record<ManualPaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card_pos: 'Tarjeta Datafast',
}

/** Cobro manual que el socio dejó y recepción todavía no registra. */
export function selectPendingPlanRequest(
  payments: Payment[],
  userId: string,
): Payment | null {
  const pending = payments
    .filter(
      (payment) =>
        payment.userId === userId &&
        payment.status === 'pending' &&
        payment.provider === 'manual' &&
        payment.membershipId == null,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  return pending[0] ?? null
}
