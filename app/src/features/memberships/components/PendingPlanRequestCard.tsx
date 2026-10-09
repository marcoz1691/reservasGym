import { Clock } from 'lucide-react'
import type { GymSettings, Payment } from '@/domain/models'
import { buildReceiptWhatsAppUrl } from '@/domain/rules/paymentReceipt'
import {
  MANUAL_PAYMENT_LABELS,
  isRemotePaymentMethod,
} from '@/domain/rules/planRequest'
import { formatCurrency } from '@/lib/format'
import { Card } from '@/ui/primitives'
import { ManualPaymentInstructions } from './ManualPaymentInstructions'

interface PendingPlanRequestCardProps {
  payment: Payment
  planName: string
  /** Con transferencia o Deuna, muestra los datos de pago y el botón de WhatsApp. */
  settings?: GymSettings
  memberName?: string
}

export function PendingPlanRequestCard({
  payment,
  planName,
  settings,
  memberName,
}: PendingPlanRequestCardProps) {
  const method = payment.manualMethod
    ? MANUAL_PAYMENT_LABELS[payment.manualMethod]
    : 'Recepción'
  const remoteMethod = isRemotePaymentMethod(payment.manualMethod) ? payment.manualMethod : null

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
      {remoteMethod && settings ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-relaxed text-ink-2">
            {settings.whatsappPayments
              ? 'Si ya pagaste, envíanos el comprobante por WhatsApp.'
              : 'Si ya pagaste, muestra tu comprobante en recepción.'}
          </p>
          <ManualPaymentInstructions
            method={remoteMethod}
            settings={settings}
            amountCents={payment.amountCents}
            reference={payment.reference}
            whatsappUrl={buildReceiptWhatsAppUrl({
              phone: settings.whatsappPayments,
              memberName: memberName ?? '',
              planName,
              amountCents: payment.amountCents,
              method: remoteMethod,
              reference: payment.reference,
            })}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Pendiente de pago en recepción. Acércate al counter para completar el
          pago. Tu acceso se activa cuando lo registren.
        </p>
      )}
    </Card>
  )
}
