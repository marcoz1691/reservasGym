import { ConsentCheckbox } from '@/features/legal/ConsentCheckbox'
import { LegalDocumentDialog } from '@/features/legal/LegalDocumentDialog'
import { PRIVACY, REFUND, legalPath } from '@/features/legal/legalDocuments'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  X,
  Banknote,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  QrCode,
  Repeat,
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
import { planPurchaseOutcome } from '@/domain/rules/memberships'
import { isFeatureEnabled } from '@/domain/rules/featureFlags'
import { isDayPassPlan } from '@/domain/rules/membershipPlan'
import {
  buildReceiptWhatsAppUrl,
  generatePaymentReference,
  isPaymentReference,
} from '@/domain/rules/paymentReceipt'
import {
  isDeunaConfigured,
  isRemotePaymentMethod,
  selectPendingPlanRequest,
} from '@/domain/rules/planRequest'
import { formatCurrency, formatDateSpanish } from '@/lib/format'
import { PageHeader } from '@/ui/primitives'
import { TermsDialog } from '@/features/legal/TermsDialog'
import { resolveTermsDocument } from '@/domain/rules/termsDocument'
import { CardBrandLogos } from './components/CardBrandLogos'
import { LeaveCheckoutSheet } from './components/LeaveCheckoutSheet'
import { ManualPaymentInstructions } from './components/ManualPaymentInstructions'
import { clearCheckoutDraft, readCheckoutDraft, saveCheckoutDraft, type CheckoutMethod } from './checkoutDraft'
import { INPUT_CLASS, ApprovedReceipt, BackLink, Field, Section, SummaryRow } from './checkoutParts'
import { leaveGuardedPage, useLeaveGuard } from './leaveGuard'
import { splitTax } from '../../../supabase/functions/pagomedios-payment/tax'
import { isRecurringEligiblePlan } from '../../../supabase/functions/pagomedios-payment/recurring'
import {
  ONLINE_PAYMENT_TAX_RATE,
  isNativeApp,
  isOnlinePayEnabled,
  isOnlinePayEnvEnabled,
  isRecurringPayEnabled,
  onPaymentScreenClosed,
  openPaymentPage,
  rememberPendingPayment,
  takePendingPayment,
} from './onlinePay'

/** Cómo paga el socio: tarjeta en línea (Pagomedios), en recepción, transferencia o Deuna. */
type ManualCheckoutMethod = Exclude<CheckoutMethod, 'card' | 'recurring'>

const METHOD_OPTIONS: { value: CheckoutMethod; title: string; detail: string; icon: LucideIcon }[] = [
  { value: 'card', title: 'Tarjeta de crédito o débito', detail: 'Un solo pago en línea, procesado por Pagomedios', icon: CreditCard },
  { value: 'recurring', title: 'Pago recurrente con tarjeta', detail: 'Pagas hoy y cada mes se cobra a tu tarjeta', icon: Repeat },
  { value: 'cash', title: 'Efectivo en recepción', detail: 'Pagas al llegar al gimnasio', icon: Banknote },
  { value: 'transfer', title: 'Transferencia bancaria', detail: 'Recepción confirma tu comprobante', icon: Landmark },
  { value: 'deuna', title: 'Deuna (Banco Pichincha)', detail: 'Pagas con el QR o el código del gym', icon: QrCode },
]

function onlineOffMessage(deunaAvailable: boolean): string {
  return deunaAvailable
    ? 'El pago en línea no está disponible en este momento. Puedes pagar en efectivo, por transferencia o con Deuna.'
    : 'El pago en línea no está disponible en este momento. Puedes pagar en efectivo o por transferencia.'
}

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

/** Texto que ve el socio antes de registrar su tarjeta (Adenda N.º 1, cláusula Tercera). */
export const RECURRING_NOTICE =
  'Registras tu tarjeta y pagas el primer mes ahora. Los meses siguientes Zona Cero hará el cobro a esta tarjeta a través de Pagomedios. Para cancelarlo, avisa en recepción.'

/**
 * Pago único con Pagomedios.
 * Entrada: /membresia/pago?planId=  → formulario de facturación → redirect a payurl.link
 * Pago recurrente: /membresia/pago?planId=&modo=recurrente → registro de tarjeta en Pagomedios
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
  // ?modo=recurrente llega con el pago recurrente ya elegido.
  const wantsRecurring = searchParams.get('modo') === 'recurrente'

  const plan = useMemo(
    () => (data.membershipPlans ?? []).find((p) => p.id === planId && p.active) ?? null,
    [data.membershipPlans, planId],
  )
  const purchase = useMemo(
    () =>
      plan && user
        ? planPurchaseOutcome({
            memberships: (data.memberships ?? []).filter((m) => m.userId === user.id),
            plans: data.membershipPlans ?? [],
            plan,
          })
        : null,
    [data.memberships, data.membershipPlans, plan, user],
  )

  const [draft] = useState(() => readCheckoutDraft(user?.id, planId))
  const termsDocumentKey = resolveTermsDocument(data.settings, import.meta.env.BASE_URL).key
  const [previousPaymentId, setPreviousPaymentId] = useState(draft?.paymentId ?? null)
  const [documentType, setDocumentType] = useState<BillingDocumentType>(draft?.documentType ?? '05')
  const [document, setDocument] = useState(draft?.document ?? '')
  const [phone, setPhone] = useState(draft?.phone ?? '')
  const [address, setAddress] = useState(draft?.address ?? '')
  const [touched, setTouched] = useState<Partial<Record<keyof BillingErrors, boolean>>>({})
  const [acceptedTermsKey, setAcceptedTermsKey] = useState<string | null>(draft?.acceptedTerms && draft.termsDocumentKey === termsDocumentKey ? termsDocumentKey : null)
  const acceptedTerms = acceptedTermsKey === termsDocumentKey
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(draft?.acceptedPrivacy === true && draft.privacyVersion === PRIVACY.version)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [payerOpen, setPayerOpen] = useState(true)
  const [chosenMethod, setMethod] = useState<CheckoutMethod>(draft?.method ?? (wantsRecurring ? 'recurring' : 'card'))
  const termsId = useId()
  const [requestSent, setRequestSent] = useState<{
    method: ManualCheckoutMethod
    reference: string | null
  } | null>(null)
  const [draftReference] = useState(() => generatePaymentReference())
  const pendingRequest = user ? selectPendingPlanRequest(data.payments ?? [], user.id) : null
  // Si ya había una solicitud con referencia, se reutiliza: el socio quizá ya la usó al pagar.
  const reference = isPaymentReference(pendingRequest?.reference)
    ? pendingRequest.reference
    : draftReference
  const [busy, setBusy] = useState(false)
  // `busy` deshabilita el botón recién en el siguiente render: dos toques seguidos alcanzaban
  // a crear dos pagos. Este candado se toma en el mismo toque.
  const submitting = useRef(false)
  const [error, setError] = useState<string | null>(null)
  // Al volver de Pagomedios con "atrás", el navegador puede restaurar la página
  // desde su caché (bfcache) con el estado "procesando": se rehabilita el formulario.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        submitting.current = false
        setBusy(false)
        setError(null)
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])
  const [verify, setVerify] = useState<VerifyState>({ kind: 'checking' })
  const [confirmLeave, setConfirmLeave] = useState(false)
  const askToLeave = useCallback(() => setConfirmLeave(true), [])
  // El botón "atrás" del teléfono o del navegador también pregunta antes de salir del formulario.
  const guardActive = Boolean(plan) && !paymentId && !requestSent && !busy
  useLeaveGuard(guardActive, askToLeave)

  function leaveCheckout() {
    clearCheckoutDraft()
    setConfirmLeave(false)
    leaveGuardedPage(() => navigate('/membresia', { replace: true }))
  }
  const billingErrors = validateBilling({ documentType, document, phone, address })
  const fieldError = (field: keyof BillingErrors) =>
    touched[field] ? billingErrors[field] : undefined

  // El ambiente con pasarela basta para verificar un pago ya iniciado; cobrar con
  // tarjeta además requiere el interruptor del admin.
  const onlineOk = isOnlinePayEnvEnabled() && typeof repo.createPagomediosPayment === 'function'
  const cardEnabled = onlineOk && isOnlinePayEnabled(data.settings)
  const deunaEnabled = isDeunaConfigured(data.settings)
  // Pago recurrente: interruptor del admin encendido y plan mensual (no pase del día).
  const recurringEnabled =
    onlineOk && isRecurringPayEnabled(data.settings) && plan !== null && isRecurringEligiblePlan(plan)
  const methodOptions = METHOD_OPTIONS.filter(
    (o) =>
      (o.value !== 'card' || cardEnabled) &&
      (o.value !== 'recurring' || recurringEnabled) &&
      (o.value !== 'deuna' || deunaEnabled),
  )
  const method: CheckoutMethod = methodOptions.some((o) => o.value === chosenMethod)
    ? chosenMethod
    : cardEnabled
      ? 'card'
      : 'cash'
  const recurring = method === 'recurring'
  const dayPassBlocked =
    plan !== null && isDayPassPlan(plan) && !isFeatureEnabled(data.settings, 'dayPasses')

  const runVerify = useCallback(async () => {
    const verifyPayment = repo.verifyPagomediosPayment?.bind(repo)
    if (!paymentId || !verifyPayment) return
    setVerify({ kind: 'checking' })
    try {
      const result = await verifyPayment({ paymentId })
      if (result.status === 'approved') {
        clearCheckoutDraft()
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
    if (submitting.current) return
    if (method !== 'card' && method !== 'recurring') {
      if (!acceptedTerms) return
      submitting.current = true
      setBusy(true)
      setError(null)
      try {
        await repo.recordLegalConsents?.('checkout', [
          { document: 'terms', version: resolveTermsDocument(data.settings, import.meta.env.BASE_URL).version },
        ])
        const request = await repo.requestPlanPayment(
          isRemotePaymentMethod(method)
            ? { planId, manualMethod: method, reference }
            : { planId, manualMethod: method },
        )
        await refresh()
        clearCheckoutDraft()
        setRequestSent({
          method,
          reference: isPaymentReference(request?.reference) ? request.reference : reference,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud')
      } finally {
        submitting.current = false
        setBusy(false)
      }
      return
    }
    if (!repo.createPagomediosPayment) return
    if (Object.keys(billingErrors).length > 0 || !acceptedTerms || !acceptedPrivacy) {
      setTouched({ document: true, phone: true, address: true })
      setPayerOpen(true)
      return
    }
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      await repo.recordLegalConsents?.('checkout', [
        { document: 'terms', version: resolveTermsDocument(data.settings, import.meta.env.BASE_URL).version },
        { document: 'privacy', version: PRIVACY.version },
      ])
      const native = isNativeApp()
      const { url, paymentId: newPaymentId } = await repo.createPagomediosPayment({
        planId,
        document: document.trim(),
        documentType,
        phone: phone.trim(),
        address: address.trim(),
        native,
        ...(recurring ? { recurring: true } : {}),
      })
      if (native) rememberPendingPayment(newPaymentId)
      else if (user) {
        saveCheckoutDraft({
          userId: user.id, planId, documentType, document, phone, address,
          acceptedTerms, termsDocumentKey, acceptedPrivacy, privacyVersion: PRIVACY.version, method, paymentId: newPaymentId,
        })
        setPreviousPaymentId(newPaymentId)
      }
      await openPaymentPage(url, () => {
        takePendingPayment()
        navigate(verifyUrl(newPaymentId), { replace: true })
      })
      if (native) {
        submitting.current = false
        setBusy(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo iniciar el pago'
      submitting.current = false
      setBusy(false)
      if (/Pago en línea desactivado/i.test(message)) {
        setError(onlineOffMessage(deunaEnabled))
        await refresh()
      } else {
        setError(message)
      }
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
        <PageHeader title="Confirmando pago" subtitle="Pagomedios" />
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
              className="text-sm font-bold text-acc-dark"
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
        {verify.kind !== 'approved' ? <BackLink /> : null}
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

  if (dayPassBlocked) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-sm text-ink-2">Los pases diarios se venden en recepción.</p>
        <BackLink label="Ir a Mi Plan" />
      </div>
    )
  }

  const whatsappUrlFor = (manualMethod: ManualCheckoutMethod, ref: string | null) =>
    buildReceiptWhatsAppUrl({
      phone: data.settings?.whatsappPayments,
      memberName: user.fullName,
      planName: plan.name,
      amountCents: plan.priceCents,
      method: manualMethod,
      reference: ref,
    })

  if (requestSent) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <PageHeader title="Solicitud enviada" subtitle={plan.name} />
        <div
          role="status"
          className="space-y-3 rounded-3xl border border-line bg-surface p-5 text-sm text-ink-2 shadow-[var(--shadow-card)]"
        >
          {isRemotePaymentMethod(requestSent.method) ? (
            <>
              <p className="flex items-center gap-2 text-base font-bold text-ink">
                {requestSent.method === 'deuna' ? (
                  <QrCode className="h-5 w-5 shrink-0" aria-hidden />
                ) : (
                  <Landmark className="h-5 w-5 shrink-0" aria-hidden />
                )}
                Completa tu pago
              </p>
              <p>
                {data.settings?.whatsappPayments
                  ? 'Paga con estos datos y envíanos el comprobante por WhatsApp.'
                  : 'Paga con estos datos y muestra tu comprobante en recepción.'}
              </p>
              <ManualPaymentInstructions
                method={requestSent.method}
                settings={data.settings}
                amountCents={plan.priceCents}
                reference={requestSent.reference}
                whatsappUrl={whatsappUrlFor(requestSent.method, requestSent.reference)}
              />
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-base font-bold text-ink">
                <Store className="h-5 w-5 shrink-0" aria-hidden />
                Paga en recepción
              </p>
              <p>Acércate a recepción y paga {formatCurrency(plan.priceCents)} en efectivo.</p>
              <p>Tu plan se activa cuando recepción registre el pago.</p>
            </>
          )}
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
  const payingByCard = method === 'card' || recurring
  const formValid =
    acceptedTerms && (!payingByCard || (acceptedPrivacy && Object.keys(billingErrors).length === 0))
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
          className="rounded-xl p-2.5 text-ink transition hover:bg-surface"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={askToLeave}
          aria-label="Salir del pago"
          className="rounded-xl p-2.5 text-ink transition hover:bg-surface"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      <PageHeader title="Pago" subtitle="Elige cómo quieres pagar tu plan" />

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Tu plan</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="font-display text-lg font-bold text-ink">{plan.name}</p>
          <p className="shrink-0 text-lg font-bold text-ink">{formatCurrency(plan.priceCents)}</p>
        </div>
        <p className="text-sm text-ink-3">
          {purchase?.kind === 'day_pass'
            ? 'Válido solo hoy · sin cobros recurrentes'
            : recurring
              ? `Vigencia de ${plan.durationDays} días · se cobra cada mes a tu tarjeta`
              : `Vigencia de ${plan.durationDays} días · sin cobros recurrentes`}
        </p>
        {purchase?.kind === 'queue' ? (
          <p className="mt-2 text-sm font-semibold text-ink">
            Empieza el {formatDateSpanish(purchase.startsAt)} cuando termine tu plan actual
          </p>
        ) : purchase?.kind === 'reject' ? (
          <p className="mt-2 text-sm font-semibold text-danger" role="alert">
            {purchase.reason}
          </p>
        ) : null}
      </section>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <Section title="Método de pago">
          <div role="radiogroup" aria-label="Método de pago" className="space-y-2">
            {methodOptions.map((option) => {
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
          {recurring ? (
            <div className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-2">
              <p className="flex items-start gap-2 text-ink">
                <Repeat className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {RECURRING_NOTICE}
              </p>
              <p className="text-xs text-ink-3">
                Al registrar tu tarjeta, Pagomedios hace una validación de $1,15 que se reversa automáticamente.
              </p>
            </div>
          ) : null}
          {payingByCard ? <CardBrandLogos /> : null}
          {isRemotePaymentMethod(method) ? (
            <ManualPaymentInstructions
              method={method}
              settings={data.settings}
              amountCents={plan.priceCents}
              reference={reference}
            />
          ) : null}
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
            <Link to={legalPath(REFUND)} className="inline-flex min-h-11 items-center underline">Política de reembolsos</Link>
          </div>
        </section>

        {previousPaymentId ? (
          <p className="text-sm text-ink-2">
            Si ya completaste el pago,{' '}
            <Link to={verifyUrl(previousPaymentId)} className="font-semibold text-ink underline">
              verifica su estado antes de pagar otra vez
            </Link>.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-1 text-sm text-ink-2">
        <label htmlFor={termsId} className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            id={termsId}
            type="checkbox"
            aria-label="Acepto los términos y condiciones"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTermsKey(e.target.checked ? termsDocumentKey : null)}
            className="h-6 w-6 shrink-0 rounded border-line-strong accent-[var(--color-cta)]"
          />
          <span>Acepto los</span>
        </label>
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-2"
            >
              términos y condiciones
            </button>
        </div>

        {payingByCard && (
          <ConsentCheckbox checked={acceptedPrivacy} onChange={setAcceptedPrivacy}
            label="Acepto la política de privacidad" linkText="política de privacidad"
            onOpen={() => setShowPrivacy(true)}>
            Autorizo el tratamiento de mis datos de pago (identificación, celular y dirección) y su envío a Pagomedios según la
          </ConsentCheckbox>
        )}

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
            disabled={busy || !formValid || purchase?.kind === 'reject'}
            className="flex w-full items-center justify-between rounded-2xl bg-cta px-5 py-4 text-base font-semibold text-cta-contrast transition hover:bg-cta-hi disabled:cursor-not-allowed disabled:bg-cta/25"
          >
            {busy ? (
              <span className="flex w-full items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {payingByCard
                  ? recurring
                    ? 'Abriendo registro seguro…'
                    : 'Abriendo pago seguro…'
                  : 'Enviando solicitud…'}
              </span>
            ) : (
              <>
                <span>
                  {recurring ? 'Registrar tarjeta y pagar' : payingByCard ? 'Pagar' : 'Confirmar solicitud'}
                </span>
                <span>{formatCurrency(plan.priceCents)}</span>
              </>
            )}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-3">
            {payingByCard ? (
              <>
                <Lock className="h-3.5 w-3.5" aria-hidden />
                {recurring
                  ? 'Registro seguro en Pagomedios. No guardamos los datos de tu tarjeta.'
                  : 'Pago seguro en Pagomedios. No guardamos los datos de tu tarjeta.'}
              </>
            ) : isRemotePaymentMethod(method) ? (
              data.settings?.whatsappPayments
                ? 'Al confirmar podrás enviar tu comprobante por WhatsApp.'
                : 'Al confirmar, muestra tu comprobante en recepción.'
            ) : (
              'Pagas en recepción. Tu plan se activa cuando lo registren.'
            )}
          </p>
        </div>
      </form>

      {showPrivacy && <LegalDocumentDialog doc={PRIVACY} onClose={() => setShowPrivacy(false)} />}
      {showTerms ? <TermsDialog settings={data.settings} onClose={() => setShowTerms(false)} /> : null}
      {confirmLeave ? (
        <LeaveCheckoutSheet onStay={() => setConfirmLeave(false)} onLeave={leaveCheckout} />
      ) : null}
    </div>
  )
}
