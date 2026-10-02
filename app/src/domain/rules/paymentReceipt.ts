import type { ManualPaymentMethod } from '@/domain/models'
import { MANUAL_PAYMENT_LABELS } from './planRequest'

const ECUADOR_CODE = '593'
const REFERENCE_PATTERN = /^ZC-[0-9A-F]{6}$/

/**
 * Número en formato internacional sin "+" para wa.me (Ecuador por defecto):
 * 0991234567 → 593991234567. Devuelve null si no parece un celular.
 */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  let digits = (raw ?? '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = ECUADOR_CODE + digits.slice(1)
  else if (digits.length === 9 && digits.startsWith('9')) digits = ECUADOR_CODE + digits
  return digits.length >= 10 && digits.length <= 15 ? digits : null
}

export interface ReceiptMessage {
  phone: string | null | undefined
  memberName: string
  planName: string
  amountCents: number
  method: ManualPaymentMethod
  reference?: string | null
}

/** Enlace para mandar el comprobante por WhatsApp; null si no hay número configurado. */
export function buildReceiptWhatsAppUrl(params: ReceiptMessage): string | null {
  const phone = normalizeWhatsAppPhone(params.phone)
  if (!phone) return null
  const lines = [
    'Hola, envío el comprobante de pago de mi plan.',
    `Nombre: ${params.memberName}`,
    `Plan: ${params.planName}`,
    `Monto: $${(params.amountCents / 100).toFixed(2)}`,
    `Medio: ${MANUAL_PAYMENT_LABELS[params.method]}`,
    ...(params.reference ? [`Referencia: ${params.reference}`] : []),
  ]
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
}

/** Código corto que el socio escribe en el motivo del pago, p. ej. ZC-4F7A2C. */
export function generatePaymentReference(
  bytes: (length: number) => Uint8Array = randomBytes,
): string {
  const hex = Array.from(bytes(3), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  return `ZC-${hex}`
}

export function isPaymentReference(value: string | null | undefined): value is string {
  return typeof value === 'string' && REFERENCE_PATTERN.test(value)
}

/**
 * Referencia de una solicitud del socio: se conserva la que ya tenía (quizá ya la
 * escribió en su transferencia); si no, la que vio en el checkout; si no, una nueva.
 */
export function resolveRequestReference(
  existing: string | null | undefined,
  proposed?: string | null,
): string {
  if (isPaymentReference(existing)) return existing
  if (isPaymentReference(proposed)) return proposed
  return generatePaymentReference()
}
