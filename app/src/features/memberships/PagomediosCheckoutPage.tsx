import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  X,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  Store,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAppData, useCurrentUser, useGym } from '@/data/RepositoryProvider'
import type { OnlinePaymentReceipt } from '@/data/types'
import {
  BILLING_DOCUMENT_TYPES,
  isNumericDocument,
  sanitizeDocument,
  sanitizePhone,
  validateBilling,
  type BillingDocumentType,
  type BillingErrors,
} from '@/domain/rules/billing'
import { formatCurrency, formatDateSpanish } from '@/lib/format'
import { PageHeader } from '@/ui/primitives'
import { TermsDialog } from '@/features/legal/TermsDialog'
import { CardBrandLogos } from './components/CardBrandLogos'
import { LeaveCheckoutSheet } from './components/LeaveCheckoutSheet'
import { splitTax } from '../../../supabase/functions/pagomedios-payment/tax'
import {
  ONLINE_PAYMENT_TAX_RATE,
  isNativeApp,
  isOnlinePayEnabled,
  onPaymentScreenClosed,
  openPaymentPage,
  rememberPendingPayment,
  takePendingPayment,
} from './onlinePay'

/** Cómo paga el socio: tarjeta en línea (Pagomedios) o en recepción. */
type CheckoutMethod = 'card' | 'cash' | 'transfer'

const METHOD_OPTIONS: { value: CheckoutMethod; title: string; detail: string; icon: LucideIcon }[] = [
  { value: 'card', title: 'Tarjeta de crédito o débito', detail: 'En línea, procesado por Pagomedios', icon: CreditCard },
  { value: 'cash', title: 'Efectivo en recepción', detail: 'Pagas al llegar al gimnasio', icon: Banknote },
  { value: 'transfer', title: 'Transferencia bancaria', detail: 'Recepción confirma tu comprobante', icon: Landmark },
]

const DOCUMENT_PLACEHOLDER: Record<BillingDocumentType, string> = {
  '05': 'Ej. 1712345678',
  '04': 'Ej. 1712345678001',
  '06': 'Ej. A1234567',
  '08': 'Número de identificación',
}

const verifyUrl = (id: string) =>
  `/membresia/pago?provider=pagomedios&paymentId=${encodeURIComponent(id)}`

type VerifyState =
  | { kind: 'checking' }
  | { kind: 'approved'; receipt?: OnlinePaymentReceipt }
  | { kind: 'pending'; message: string }
  | { kind: 'error'; message: string }

/**
 * Pago único con Pagomedios.
 * Entrada: /membresia/pago?planId=  → formulario de facturación → redirect a payurl.link
 * Retorno: /membresia/pago?provider=pagomedios&paymentId=  → verificación
 */
export function PagomediosCheckoutPage() {
  const user = useCurrentUser()
  const data = useAppData()
  const { repo, refresh } = useGym()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const planId = searchParams.get('planId')
  const paymentId = searchParams.get('paymentId')

  const plan = useMemo(
    () => (data.membershipPlans ?? []).find((p) => p.id === planId && p.active) ?? null,
    [data.membershipPlans, planId],
  )

  const [documentType, setDocumentType] = useState<BillingDocumentType>('05')
  const [document, setDocument] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [touched, setTouched] = useState<Partial<Record<keyof BillingErrors, boolean>>>({})
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [payerOpen, setPayerOpen] = useState(true)
  const [method, setMethod] = useState<CheckoutMethod>('card')
  const [requestSent, setRequestSent] = useState<Exclude<CheckoutMethod, 'card'> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verify, setVerify] = useState<VerifyState>({ kind: 'checking' })
  const [confirmLeave, setConfirmLeave] = useState(false)
  const askToLeave = useCallback(() => setConfirmLeave(true), [])
  // El botón "atrás" del teléfono o del navegador también pregunta antes de salir del formulario.
  const guardActive = Boolean(plan) && !paymentId && !requestSent && !busy
  useLeaveGuard(guardActive, askToLeave)

  function leaveCheckout() {
    setConfirmLeave(false)
    leaveGuardedPage(() => navigate('/membresia', { replace: true }))
  }
  const billingErrors = validateBilling({ documentType, document, phone, address })
  const fieldError = (field: keyof BillingErrors) =>
    touched[field] ? billingErrors[field] : undefined

  const onlineOk = isOnlinePayEnabled() && typeof repo.createPagomediosPayment === 'function'

  const runVerify = useCallback(async () => {
    const verifyPayment = repo.verifyPagomediosPayment?.bind(repo)
    if (!paymentId || !verifyPayment) return
    setVerify({ kind: 'checking' })
    try {
      const result = await verifyPayment({ paymentId })
      if (result.status === 'approved') {
        // Se queda en el comprobante hasta que el socio vuelva a Mi Plan.
        setVerify({ kind: 'approved', receipt: result.receipt })
        await refresh()
      } else if (result.status === 'pending') {
        setVerify({
          kind: 'pending',
          message: result.description ?? 'Tu pago aún no se confirma.',
        })
      } else {
        setVerify({ kind: 'error', message: result.description ?? 'El pago no fue aprobado.' })
      }
    } catch (err) {
      setVerify({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Error al verificar el pago',
      })
    }
  }, [paymentId, repo, refresh])

  useEffect(() => {
    void runVerify()
  }, [runVerify])

  // Si la app se recargó mientras el socio pagaba, retoma la verificación.
  useEffect(() => {
    if (paymentId) return
    const pending = takePendingPayment()
    if (pending) navigate(verifyUrl(pending), { replace: true })
  }, [paymentId, navigate])

  // App nativa: al cerrarse la pantalla de pago (aun tras una recarga) vuelve a verificar.
  useEffect(() => {
    if (!paymentId || !isNativeApp()) return
    let stop: (() => void) | undefined
    let active = true
    void onPaymentScreenClosed(() => void runVerify()).then((unsubscribe) => {
      if (active) stop = unsubscribe
      else unsubscribe()
    })
    return () => {
      active = false
      stop?.()
    }
  }, [paymentId, runVerify])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!planId) return
    if (method !== 'card') {
      if (!acceptedTerms) return
      setBusy(true)
      setError(null)
      try {
        await repo.requestPlanPayment({ planId, manualMethod: method })
        await refresh()
        setRequestSent(method)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud')
      } finally {
        setBusy(false)
      }
      return
    }
    if (!repo.createPagomediosPayment) return
    if (Object.keys(billingErrors).length > 0 || !acceptedTerms) {
      setTouched({ document: true, phone: true, address: true })
      setPayerOpen(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const native = isNativeApp()
      const { url, paymentId: newPaymentId } = await repo.createPagomediosPayment({
        planId,
        document: document.trim(),
        documentType,
        phone: phone.trim(),
        address: address.trim(),
        native,
      })
      if (native) rememberPendingPayment(newPaymentId)
      await openPaymentPage(url, () => {
        takePendingPayment()
        navigate(verifyUrl(newPaymentId), { replace: true })
      })
      if (native) setBusy(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el pago')
      setBusy(false)
    }
  }

  if (!user) {
    return <div className="p-4 text-center text-ink-3">Inicia sesión para pagar.</div>
  }

  if (!onlineOk) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-sm text-ink-2">El pago en línea no está activo en este ambiente.</p>
        <BackLink />
      </div>
    )
  }

  if (paymentId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <PageHeader title="Confirmando pago" subtitle="Pagomedios · pago único" />
        {verify.kind === 'checking' ? (
          <div role="status" className="flex items-center gap-2 text-sm text-ink-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando con Pagomedios…
          </div>
        ) : null}
        {verify.kind === 'approved' ? <ApprovedReceipt receipt={verify.receipt} /> : null}
        {verify.kind === 'pending' ? (
          <div className="space-y-3 rounded-2xl border border-warn/30 bg-warn-soft p-4 text-sm text-ink">
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
              {verify.message}
            </p>
            <button
              type="button"
              onClick={() => void runVerify()}
              className="text-sm font-bold text-acc"
            >
              Volver a verificar
            </button>
          </div>
        ) : null}
        {verify.kind === 'error' ? (
          <div
            role="alert"
            className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger"
          >
            {verify.message}
          </div>
        ) : null}
        <BackLink />
      </div>
    )
  }

  if (!planId || !plan) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-sm text-ink-2">Selecciona un plan desde Mi Plan.</p>
        <BackLink label="Ir a Mi Plan" />
      </div>
    )
  }

  if (requestSent) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <PageHeader title="Solicitud enviada" subtitle={plan.name} />
        <div
          role="status"
          className="space-y-3 rounded-3xl border border-line bg-surface p-5 text-sm text-ink-2 shadow-[var(--shadow-card)]"
        >
          <p className="flex items-center gap-2 text-base font-bold text-ink">
            <Store className="h-5 w-5 shrink-0" aria-hidden />
            Paga en recepción
          </p>
          <p>
            {requestSent === 'cash'
              ? `Acércate a recepción y paga ${formatCurrency(plan.priceCents)} en efectivo.`
              : `Recepción te dará los datos de la cuenta para transferir ${formatCurrency(plan.priceCents)}. Muestra tu comprobante en recepción.`}
          </p>
          <p>Tu plan se activa cuando recepción registre el pago.</p>
          <Link
            to="/membresia"
            replace
            className="flex w-full items-center justify-center rounded-xl bg-cta px-4 py-2.5 font-semibold text-cta-contrast"
          >
            Ir a Mi Plan
          </Link>
        </div>
      </div>
    )
  }

  const amounts = splitTax(plan.priceCents, ONLINE_PAYMENT_TAX_RATE)
  const cents = (value: number) => Math.round(value * 100)
  const payingByCard = method === 'card'
  const formValid =
    acceptedTerms && (!payingByCard || Object.keys(billingErrors).length === 0)
  const docLabel = BILLING_DOCUMENT_TYPES.find((t) => t.value === documentType)?.label ?? 'ID'
  const payerSummary =
    Object.keys(billingErrors).length === 0
      ? `${docLabel} ${document} · ${phone}`
      : 'Completa tu identificación, celular y dirección'

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 pb-10">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={askToLeave}
          aria-label="Volver"
          className="rounded-xl p-2 text-ink transition hover:bg-surface"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={askToLeave}
          aria-label="Salir del pago"
          className="rounded-xl p-2 text-ink transition hover:bg-surface"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      <PageHeader title="Pago" subtitle="Elige cómo quieres pagar tu plan" />

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Tu plan</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="font-display text-lg font-bold text-ink">{plan.name}</p>
          <p className="shrink-0 text-lg font-bold text-ink">{formatCurrency(plan.priceCents)}</p>
        </div>
        <p className="text-sm text-ink-3">Vigencia de {plan.durationDays} días · sin cobros recurrentes</p>
      </section>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <Section title="Método de pago">
          <div role="radiogroup" aria-label="Método de pago" className="space-y-2">
            {METHOD_OPTIONS.map((option) => {
              const selected = method === option.value
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMethod(option.value)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    selected ? 'border-2 border-cta bg-surface' : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0 text-ink" aria-hidden />
                  <span className="flex-1">
                    <span className="block font-semibold text-ink">{option.title}</span>
                    <span className="block text-xs text-ink-3">{option.detail}</span>
                  </span>
                  {selected ? <Check className="h-5 w-5 shrink-0 text-ink" aria-hidden /> : null}
                </button>
              )
            })}
          </div>
          {payingByCard ? <CardBrandLogos /> : null}
        </Section>

        {payingByCard ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-ink">Datos del pagador</h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <button
              type="button"
              aria-expanded={payerOpen}
              aria-controls="datos-pagador"
              onClick={() => setPayerOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{user.fullName}</span>
                <span
                  className={`block truncate text-xs ${Object.keys(billingErrors).length ? 'text-ink-3' : 'text-ink-2'}`}
                >
                  {payerSummary}
                </span>
              </span>
              <ChevronDown
                aria-hidden
                className={`h-5 w-5 shrink-0 text-ink-2 transition-transform ${payerOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {payerOpen ? (
              <div id="datos-pagador" className="space-y-4 border-t border-line px-4 pb-4 pt-3">
                <p className="text-xs text-ink-3">Pagomedios los pide para procesar el pago con tarjeta.</p>
              <Field label="Tipo de identificación">
                <select
                  value={documentType}
                  onChange={(e) => {
                    const type = e.target.value as BillingDocumentType
                    setDocumentType(type)
                    setDocument((current) => sanitizeDocument(type, current))
                  }}
                  className={INPUT_CLASS}
                >
                  {BILLING_DOCUMENT_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Número de identificación" error={fieldError('document')}>
                <input
                  inputMode={isNumericDocument(documentType) ? 'numeric' : 'text'}
                  autoComplete="off"
                  value={document}
                  onChange={(e) => setDocument(sanitizeDocument(documentType, e.target.value))}
                  onBlur={() => setTouched((t) => ({ ...t, document: true }))}
                  aria-invalid={Boolean(fieldError('document'))}
                  className={INPUT_CLASS}
                  placeholder={DOCUMENT_PLACEHOLDER[documentType]}
                />
              </Field>
              <Field label="Celular" error={fieldError('phone')}>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                  onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                  aria-invalid={Boolean(fieldError('phone'))}
                  className={INPUT_CLASS}
                  placeholder="Ej. 0991234567"
                />
              </Field>
              <Field label="Dirección" error={fieldError('address')}>
                <input
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.slice(0, 150))}
                  onBlur={() => setTouched((t) => ({ ...t, address: true }))}
                  aria-invalid={Boolean(fieldError('address'))}
                  className={INPUT_CLASS}
                  placeholder="Ej. Av. Amazonas N34-120, Quito"
                />
              </Field>
              </div>
            ) : null}
          </div>
        </section>
        ) : null}


        <section
          aria-label="Resumen del pago"
          className="space-y-2 rounded-3xl border border-line bg-surface p-5 text-sm"
        >
          <SummaryRow label="Subtotal" value={formatCurrency(cents(amounts.amount_with_tax + amounts.amount_without_tax))} />
          <SummaryRow label={`IVA ${Math.round(ONLINE_PAYMENT_TAX_RATE * 100)}%`} value={formatCurrency(cents(amounts.tax_value))} />
          <div className="border-t border-dashed border-line-strong pt-2">
            <SummaryRow label="Total" value={formatCurrency(plan.priceCents)} strong />
          </div>
        </section>

        <label className="flex items-start gap-3 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-line-strong accent-[var(--color-cta)]"
          />
          <span>
            Acepto los{' '}
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="font-semibold text-ink underline underline-offset-2"
            >
              términos y condiciones
            </button>
          </span>
        </label>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          <button
            type="submit"
            disabled={busy || !formValid}
            className="flex w-full items-center justify-between rounded-2xl bg-cta px-5 py-4 text-base font-semibold text-cta-contrast transition hover:bg-cta-hi disabled:cursor-not-allowed disabled:bg-cta/25"
          >
            {busy ? (
              <span className="flex w-full items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {payingByCard ? 'Abriendo pago seguro…' : 'Enviando solicitud…'}
              </span>
            ) : (
              <>
                <span>{payingByCard ? 'Pagar' : 'Confirmar solicitud'}</span>
                <span>{formatCurrency(plan.priceCents)}</span>
              </>
            )}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-3">
            {payingByCard ? (
              <>
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Pago seguro en Pagomedios. No guardamos los datos de tu tarjeta.
              </>
            ) : (
              'Pagas en recepción. Tu plan se activa cuando lo registren.'
            )}
          </p>
        </div>
      </form>

      {showTerms ? <TermsDialog onClose={() => setShowTerms(false)} /> : null}
      {confirmLeave ? (
        <LeaveCheckoutSheet onStay={() => setConfirmLeave(false)} onLeave={leaveCheckout} />
      ) : null}
    </div>
  )
}

const INPUT_CLASS =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-ink placeholder:text-ink-3/70 focus:border-ink focus:outline-none aria-[invalid=true]:border-danger'

function Section({
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

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 text-sm">
      <label className="block space-y-1.5">
        <span className="font-medium text-ink-2">{label}</span>
        {children}
      </label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  )
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'text-base font-bold text-ink' : 'text-ink-2'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function ApprovedReceipt({ receipt }: { receipt?: OnlinePaymentReceipt }) {
  const rows: [string, string][] = receipt
    ? [
        ['Plan', receipt.planName ?? '—'],
        ['Monto', formatCurrency(receipt.amountCents)],
        ['Código de autorización', receipt.authorizationCode ?? '—'],
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
      <p>Tu membresía ya está activa.</p>
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

function BackLink({ label = 'Volver a Mi Plan' }: { label?: string }) {
  return (
    <Link to="/membresia" className="inline-flex items-center gap-1 text-sm font-bold text-acc">
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  )
}

const GUARD_KEY = 'zonaceroCheckoutGuard'
/** Mientras se sale a propósito, el guardia no vuelve a interceptar "atrás". */
let leavingCheckout = false

/**
 * Mientras está activo, "atrás" (teléfono o navegador) no saca al socio del
 * pago: se agrega una entrada igual al historial y, si vuelve sobre ella, se
 * repone y se pregunta. Conserva el estado de React Router (idx/key).
 */
function useLeaveGuard(active: boolean, onAttempt: () => void) {
  useEffect(() => {
    if (!active) return
    const state = window.history.state as Record<string, unknown> | null
    if (!state?.[GUARD_KEY]) window.history.pushState({ ...state, [GUARD_KEY]: true }, '')
    const onPop = () => {
      if (leavingCheckout) return
      window.history.pushState({ ...(window.history.state ?? {}), [GUARD_KEY]: true }, '')
      onAttempt()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [active, onAttempt])
}

/** Quita la entrada extra del historial (si existe) y luego sale. */
function leaveGuardedPage(go: () => void) {
  const state = window.history.state as Record<string, unknown> | null
  if (!state?.[GUARD_KEY]) {
    go()
    return
  }
  leavingCheckout = true
  const onPop = () => {
    window.removeEventListener('popstate', onPop)
    leavingCheckout = false
    go()
  }
  window.addEventListener('popstate', onPop)
  window.history.back()
}
