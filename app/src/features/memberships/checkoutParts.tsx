import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Repeat } from 'lucide-react'
import type { OnlinePaymentReceipt } from '@/data/types'
import { formatCurrency, formatDateSpanish } from '@/lib/format'

/** Piezas de presentación del pago: formulario, resumen, comprobante y volver. */
export const INPUT_CLASS =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-ink placeholder:text-ink-3/70 focus:border-ink focus:outline-none aria-[invalid=true]:border-danger'

export function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 text-sm">
      <label className="block space-y-1.5">
        <span className="font-medium text-ink-2">{label}</span>
        {children}
      </label>
      <p aria-live="polite" className="min-h-8 text-xs text-danger">{error ?? ''}</p>
    </div>
  )
}

export function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'text-base font-bold text-ink' : 'text-ink-2'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function ApprovedReceipt({ receipt }: { receipt?: OnlinePaymentReceipt }) {
  const rows: [string, string][] = receipt
    ? [
        ['Plan', receipt.planName ?? '—'],
        ['Monto', formatCurrency(receipt.amountCents)],
        ['Código de autorización', receipt.authorizationCode ?? '—'],
        ...(receipt.membershipStartsAt
          ? [['Empieza el', formatDateSpanish(receipt.membershipStartsAt)] as [string, string]]
          : []),
        [
          'Membresía activa hasta',
          receipt.membershipEndsAt ? formatDateSpanish(receipt.membershipEndsAt) : '—',
        ],
      ]
    : []
  return (
    <div
      role="status"
      className="space-y-4 rounded-2xl border border-success/40 bg-success/10 p-4 text-sm text-ink"
    >
      <p className="flex items-center gap-2 text-base font-bold">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        ¡Pago aprobado!
      </p>
      {/* Cobrado pero sin membresía aplicada (p. ej. otro plan en espera): recepción revisa. */}
      <p>
        {receipt && !receipt.membershipEndsAt
          ? 'Tu pago quedó registrado. Recepción confirmará tu membresía.'
          : 'Tu membresía ya está activa.'}
      </p>
      {receipt?.recurring ? (
        <p className="flex items-start gap-2">
          <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          Tu tarjeta quedó registrada. Los meses siguientes Zona Cero hará el cobro a través de
          Pagomedios. Cada renovación puede tardar hasta 24 horas en verse en la app.
          Para cancelar el débito, avisa en recepción.
        </p>
      ) : null}
      {rows.length > 0 ? (
        <dl className="space-y-1.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-ink-3">{label}</dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <Link
        to="/membresia"
        replace
        className="flex w-full items-center justify-center rounded-xl bg-cta px-4 py-2.5 font-semibold text-cta-contrast"
      >
        Ir a Mi Plan
      </Link>
    </div>
  )
}

export function BackLink({ label = 'Volver a Mi Plan' }: { label?: string }) {
  return (
    <Link to="/membresia" className="inline-flex items-center gap-1 text-sm font-bold text-acc-dark">
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  )
}
