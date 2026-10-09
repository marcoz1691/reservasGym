import { Calendar, CreditCard, Hash } from 'lucide-react'
import type { Payment, PaymentStatus } from '@/domain/models'
import { formatCurrency, formatDateShort, formatPaymentMethod } from '@/lib/format'

interface PaymentItemProps {
  payment: Payment
  planName?: string
}

function getPaymentStatusBadge(status: PaymentStatus) {
  switch (status) {
    case 'approved':
      return {
        label: 'Aprobado',
        className: 'bg-success/15 text-success border border-success/30',
      }
    case 'pending':
      return {
        label: 'Pendiente',
        className: 'bg-warn/15 text-warn border border-warn/30',
      }
    case 'rejected':
      return {
        label: 'Rechazado',
        className: 'bg-danger/15 text-danger border border-danger/30',
      }
    case 'refunded':
      return {
        label: 'Reembolsado',
        className: 'bg-purple-500/15 text-purple-600 border border-purple-500/30',
      }
    default:
      return {
        label: status,
        className: 'bg-surface text-ink-3 border border-line',
      }
  }
}

/** Desktop table row */
export function PaymentRow({ payment, planName }: PaymentItemProps) {
  const methodLabel = formatPaymentMethod(payment.provider, payment.manualMethod)
  const statusBadge = getPaymentStatusBadge(payment.status)

  return (
    <tr className="border-b border-line/40 hover:bg-surface/30 transition-colors">
      <td className="py-3.5 px-4 text-xs font-semibold text-ink">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-acc-dark" />
          <span>{formatDateShort(payment.createdAt)}</span>
        </div>
      </td>
      <td className="py-3.5 px-4 text-xs font-bold text-ink">
        {planName ?? 'Plan de Membresía'}
      </td>
      <td className="py-3.5 px-4 text-xs font-extrabold text-ink">
        {formatCurrency(payment.amountCents)}
      </td>
      <td className="py-3.5 px-4 text-xs text-ink-2">
        <div className="flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5 text-ink-3" />
          <span>{methodLabel}</span>
        </div>
      </td>
      <td className="py-3.5 px-4 text-xs font-mono text-ink-3">
        {payment.reference || '—'}
      </td>
      <td className="py-3.5 px-4 text-right">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadge.className}`}
        >
          {statusBadge.label}
        </span>
      </td>
    </tr>
  )
}

/** Mobile responsive card */
export function PaymentMobileCard({ payment, planName }: PaymentItemProps) {
  const methodLabel = formatPaymentMethod(payment.provider, payment.manualMethod)
  const statusBadge = getPaymentStatusBadge(payment.status)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line/60 bg-bg-2/80 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3 block">
            {formatDateShort(payment.createdAt)}
          </span>
          <p className="text-sm font-bold text-ink">{planName ?? 'Plan de Membresía'}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadge.className}`}
        >
          {statusBadge.label}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-line/50 pt-2.5 text-xs">
        <div className="space-y-0.5">
          <span className="text-[11px] text-ink-3 block">Método de pago</span>
          <span className="font-semibold text-ink-2 flex items-center gap-1">
            <CreditCard className="h-3 w-3 text-ink-3" />
            {methodLabel}
          </span>
        </div>

        <div className="text-right space-y-0.5">
          <span className="text-[11px] text-ink-3 block">Monto total</span>
          <span className="text-sm font-black text-ink">
            {formatCurrency(payment.amountCents)}
          </span>
        </div>
      </div>

      {payment.reference && (
        <div className="flex items-center gap-1.5 text-xs font-mono text-ink-3 border-t border-line/40 pt-2">
          <Hash className="h-3 w-3 text-ink-3" />
          <span>Ref: {payment.reference}</span>
        </div>
      )}
    </div>
  )
}
