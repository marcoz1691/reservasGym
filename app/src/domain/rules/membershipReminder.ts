import type { MembershipStatus } from '../models'
import { normalizeWhatsAppPhone } from './paymentReceipt'

export interface MembershipReminder {
  phone: string | null | undefined
  memberName: string
  gymName: string
  planName: string
  /** Fecha de fin ya formateada para mostrar (ej. 20 oct 2026). */
  endsOn: string
  status: MembershipStatus
  /** Enlace donde el socio renueva su plan. */
  renewalUrl: string
}

function reminderText(params: MembershipReminder): string {
  const { memberName, gymName, planName, endsOn, status, renewalUrl } = params
  const firstName = memberName.trim().split(/\s+/)[0] || memberName
  const state =
    status === 'active'
      ? `tu plan ${planName} vence el ${endsOn}.`
      : status === 'grace'
        ? `tu plan ${planName} venció el ${endsOn} y estás en periodo de gracia.`
        : `tu plan ${planName} venció el ${endsOn}.`
  return [`Hola ${firstName}, te escribimos de ${gymName}: ${state}`, `Renuévalo aquí: ${renewalUrl}`].join(
    '\n',
  )
}

/** Enlace de WhatsApp con el recordatorio listo para enviar; null si el socio no tiene celular válido. */
export function buildMembershipReminderUrl(params: MembershipReminder): string | null {
  const phone = normalizeWhatsAppPhone(params.phone)
  if (!phone) return null
  return `https://wa.me/${phone}?text=${encodeURIComponent(reminderText(params))}`
}
