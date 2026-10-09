import { useState } from 'react'
import { Check, Clock, Copy, MessageCircle } from 'lucide-react'
import type { GymSettings } from '@/domain/models'
import {
  PAYMENT_VALIDATION_NOTICE,
  type RemotePaymentMethod,
} from '@/domain/rules/planRequest'
import { formatCurrency } from '@/lib/format'

interface ManualPaymentInstructionsProps {
  method: RemotePaymentMethod
  settings: GymSettings
  amountCents: number
  reference?: string | null
  /** Sin enlace (no hay WhatsApp configurado) no se muestra el botón. */
  whatsappUrl?: string | null
}

/** Datos para pagar por transferencia o Deuna: cuenta o QR, monto, referencia y aviso de 24 h. */
export function ManualPaymentInstructions({
  method,
  settings,
  amountCents,
  reference,
  whatsappUrl,
}: ManualPaymentInstructionsProps) {
  const bankRows = (
    [
      ['Banco', settings.bankName],
      ['Tipo de cuenta', settings.bankAccountType],
      ['Número de cuenta', settings.bankAccountNumber, true],
      ['Titular', settings.bankAccountHolder],
      ['RUC o cédula', settings.bankAccountId],
    ] as [string, string | null | undefined, boolean?][]
  ).filter(([, value]) => value?.trim())
  const deunaCode = settings.deunaCode?.trim()
  const deunaQrUrl = settings.deunaQrUrl?.trim()

  return (
    <section
      aria-label="Datos para pagar"
      className="space-y-3 rounded-2xl border border-line bg-surface-elevated p-4 text-sm text-ink-2"
    >
      {method === 'transfer' ? (
        bankRows.length > 0 ? (
          <dl className="space-y-1.5">
            {bankRows.map(([label, value, copyable]) => (
              <DetailRow key={label} label={label} value={value!.trim()} copyable={copyable} />
            ))}
          </dl>
        ) : (
          <p>
            Recepción te dará los datos de la cuenta para transferir {formatCurrency(amountCents)}.
          </p>
        )
      ) : (
        <div className="space-y-2">
          {deunaQrUrl ? (
            <img
              src={deunaQrUrl}
              alt="QR de Deuna del gym"
              className="mx-auto h-48 w-48 rounded-xl border border-line bg-white object-contain p-2"
            />
          ) : null}
          {deunaCode ? (
            <dl>
              <DetailRow label="Código Deuna" value={deunaCode} copyable />
            </dl>
          ) : null}
          <p className="text-xs text-ink-3">Abre Deuna, escanea el QR o usa el código y paga el monto exacto.</p>
        </div>
      )}

      <dl className="space-y-1.5 border-t border-dashed border-line-strong pt-3">
        <DetailRow label="Monto exacto" value={formatCurrency(amountCents)} strong />
        {reference ? <DetailRow label="Referencia" value={reference} copyable strong /> : null}
      </dl>
      {reference ? (
        <p className="text-xs text-ink-3">
          Escribe la referencia en el motivo o la descripción del pago.
        </p>
      ) : null}

      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 font-semibold text-[#06361F] transition hover:brightness-95"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Enviar comprobante por WhatsApp
        </a>
      ) : null}

      <p className="flex items-start gap-2 text-xs text-ink-2">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />
        {PAYMENT_VALIDATION_NOTICE}
      </p>
    </section>
  )
}

function DetailRow({
  label,
  value,
  copyable = false,
  strong = false,
}: {
  label: string
  value: string
  copyable?: boolean
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="min-w-0 text-ink-3">{label}</dt>
      <dd className={`flex items-center gap-2 text-right ${strong ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>
        <span className={copyable ? 'whitespace-nowrap' : 'break-all'}>{value}</span>
        {copyable ? <CopyButton label={label} value={value} /> : null}
      </dd>
    </div>
  )
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard?.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copiar ${label.toLowerCase()}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-2 text-xs font-semibold text-acc-dark transition hover:border-acc"
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}
