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

/** Número de comprobante para mostrar: solo dígitos, mínimo 6 con ceros a la izquierda (000123). */
export function formatReceiptNumber(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) return null
  return String(n).padStart(6, '0')
}

/** Búsqueda por número de comprobante: acepta «000123», «123» o «N.º 000123». */
export function matchesReceiptNumber(query: string, n: number | null | undefined): boolean {
  if (formatReceiptNumber(n) === null) return false
  const match = /^\s*(?:n\.?\s*º?|#)?\s*(\d+)\s*$/i.exec(query)
  return match !== null && Number(match[1]) === n
}

const MEMBER_PHONE_ERROR =
  'Ingresa un celular válido: 09 seguido de 8 dígitos (ej. 0991234567) o, si es extranjero, con + y código de país.'

/**
 * Celular del socio (opcional). Ecuador: móvil 09xxxxxxxx / +5939xxxxxxxx. Extranjero: + y código de país.
 * Devuelve el mensaje de error o null si es válido o está vacío.
 */
export function memberPhoneError(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  if (!/^\+?[\d\s().-]+$/.test(value)) return MEMBER_PHONE_ERROR

  let digits = value.replace(/\D/g, '')
  const international = value.startsWith('+') || digits.startsWith('00')
  if (digits.startsWith('00')) digits = digits.slice(2)

  if (digits.startsWith(ECUADOR_CODE) && (international || digits.length === 12)) {
    return /^5939\d{8}$/.test(digits) ? null : MEMBER_PHONE_ERROR
  }
  if (international) return digits.length >= 8 && digits.length <= 15 ? null : MEMBER_PHONE_ERROR
  return /^0?9\d{8}$/.test(digits) ? null : MEMBER_PHONE_ERROR
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
