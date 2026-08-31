import { Receipt } from 'lucide-react'
import type { MembershipPlan, Payment } from '@/domain/models'
import { PaymentMobileCard, PaymentRow } from './PaymentRow'

interface PaymentHistoryProps {
  payments: Payment[]
  plans: MembershipPlan[]
}

export function PaymentHistory({ payments, plans }: PaymentHistoryProps) {
  const planMap = new Map(plans.map((p) => [p.id, p.name]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-xl font-extrabold text-ink">Historial de pagos</h3>
          <p className="text-xs text-ink-3">
            Comprobantes y registros de pagos efectuados
          </p>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-3xl border border-line bg-bg-2/50 p-8 text-center space-y-2">
          <Receipt className="h-8 w-8 text-ink-3 mx-auto" />
          <p className="text-sm font-bold text-ink">Sin registros de pago</p>
          <p className="text-xs text-ink-3 max-w-sm mx-auto">
            Aún no tienes comprobantes registrados. Los pagos efectuados en recepción aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-line bg-bg-2/60 overflow-hidden shadow-lg">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-surface/60 text-[11px] font-bold uppercase tracking-wider text-ink-3">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Plan / Concepto</th>
                  <th className="py-3 px-4">Monto</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4">Referencia</th>
                  <th className="py-3 px-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    planName={planMap.get(payment.planId)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards List */}
          <div className="md:hidden p-4 space-y-3">
            {payments.map((payment) => (
              <PaymentMobileCard
                key={payment.id}
                payment={payment}
                planName={planMap.get(payment.planId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
