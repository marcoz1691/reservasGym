import type { GymSettings, ManualPaymentMethod, Payment } from '@/domain/models'

export const MANUAL_PAYMENT_LABELS: Record<ManualPaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card_pos: 'Tarjeta Datafast',
  deuna: 'Deuna',
  pagomedios_recurring: 'Pago recurrente',
}

export const PAYMENT_VALIDATION_NOTICE =
  'Tu plan se activa cuando validemos el pago. Puede tardar hasta 24 horas después de enviar tu comprobante.'

/** Medios en los que el socio paga por su cuenta y envía el comprobante. */
export type RemotePaymentMethod = Extract<ManualPaymentMethod, 'transfer' | 'deuna'>

export function isRemotePaymentMethod(
  method: string | null | undefined,
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

const DISCARDED_NOTICE_DAYS = 30

export const DISCARDED_REQUEST_NOTE = 'Solicitud descartada por recepción.'

/**
 * Solicitud manual que recepción descartó, para avisar al socio. Solo si es lo último
 * que hizo (un pago o solicitud posterior la deja atrás) y es de los últimos 30 días.
 */
export function selectDiscardedPlanRequest(
  payments: Payment[],
  userId: string,
  now: Date = new Date(),
): Payment | null {
  const latest = payments
    .filter((payment) => payment.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  if (
    !latest ||
    latest.status !== 'rejected' ||
    latest.provider !== 'manual' ||
    latest.membershipId != null
  ) {
    return null
  }
  const ageMs = now.getTime() - new Date(latest.createdAt).getTime()
  return ageMs <= DISCARDED_NOTICE_DAYS * 86_400_000 ? latest : null
}
