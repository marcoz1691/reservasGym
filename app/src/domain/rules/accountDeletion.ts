import type { Payment } from '../models'

/** La cédula que el pago recurrente guarda en la nota: "Pago recurrente (ID 1723456784): …". */
const DOCUMENT_IN_NOTE = /\(ID [^)]*\)/g

/**
 * Pagos de un socio que elimina su cuenta (LOPDP + conservación contable).
 *
 * - Aprobados y reembolsados: se conservan anonimizados (sin socio, sin membresía y sin
 *   la cédula de la nota) con monto, plan, medio, fecha y referencia, para la contabilidad.
 * - Pendientes y rechazados: no son un cobro, se borran.
 *
 * Igual que delete_user_account en anonimizar-pagos-al-eliminar.sql.
 */
export function anonymizeDeletedMemberPayments(payments: Payment[], userId: string): Payment[] {
  return payments.flatMap((p) => {
    if (p.userId !== userId) return [p]
    if (p.status !== 'approved' && p.status !== 'refunded') return []
    return [{ ...p, userId: null, membershipId: null, notes: p.notes?.replace(DOCUMENT_IN_NOTE, '(ID eliminado)') ?? null }]
  })
}
