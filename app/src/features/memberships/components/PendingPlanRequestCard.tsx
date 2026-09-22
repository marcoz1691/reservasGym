import { Clock } from 'lucide-react'
import type { Payment } from '@/domain/models'
import { MANUAL_PAYMENT_LABELS } from '@/domain/rules/planRequest'
import { formatCurrency } from '@/lib/format'
import { Card } from '@/ui/primitives'

interface PendingPlanRequestCardProps {
  payment: Payment
  planName: string
}

export function PendingPlanRequestCard({
  payment,
  planName,
}: PendingPlanRequestCardProps) {
  const method = payment.manualMethod
    ? MANUAL_PAYMENT_LABELS[payment.manualMethod]
    : 'Recepción'

  return (
    <Card className="border-warn/40 bg-warn-soft/40 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-warn">
        <Clock className="h-4 w-4" />
        Solicitud enviada
      </div>
      <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
        {planName}
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        {formatCurrency(payment.amountCents)} · {method}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        Pendiente de pago en recepción. Acércate al counter para completar el
        pago. Tu acceso se activa cuando lo registren.
      </p>
    </Card>
  )
}
