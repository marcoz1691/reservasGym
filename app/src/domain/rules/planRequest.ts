import type { GymSettings, ManualPaymentMethod, Payment } from '@/domain/models'

export const MANUAL_PAYMENT_LABELS: Record<ManualPaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card_pos: 'Tarjeta Datafast',
  deuna: 'Deuna',
}

/** Medios en los que el socio paga por su cuenta y envía el comprobante. */
export type RemotePaymentMethod = Extract<ManualPaymentMethod, 'transfer' | 'deuna'>

export function isRemotePaymentMethod(
  method: ManualPaymentMethod | null | undefined,
): method is RemotePaymentMethod {
  return method === 'transfer' || method === 'deuna'
}

/** Deuna solo se ofrece si el admin cargó el código o el QR. */
export function isDeunaConfigured(settings: GymSettings | null | undefined): boolean {
  return Boolean(settings?.deunaCode?.trim() || settings?.deunaQrUrl?.trim())
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
