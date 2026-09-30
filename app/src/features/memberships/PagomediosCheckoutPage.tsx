import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, CreditCard, Loader2, ShieldCheck } from 'lucide-react'
import { useAppData, useCurrentUser, useGym } from '@/data/RepositoryProvider'
import type { PagomediosDocumentType } from '@/data/types'
import { formatCurrency } from '@/lib/format'
import { PageHeader } from '@/ui/primitives'
import { isNativeApp, isOnlinePayEnabled, openPaymentPage } from './onlinePay'

const DOCUMENT_OPTIONS: { value: PagomediosDocumentType; label: string }[] = [
  { value: '05', label: 'Cédula' },
  { value: '04', label: 'RUC' },
  { value: '06', label: 'Pasaporte' },
  { value: '08', label: 'Identificación del exterior' },
]

type VerifyState =
  | { kind: 'checking' }
  | { kind: 'approved' }
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

  const [documentType, setDocumentType] = useState<PagomediosDocumentType>('05')
  const [document, setDocument] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState(user?.residence ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verify, setVerify] = useState<VerifyState>({ kind: 'checking' })

  const onlineOk = isOnlinePayEnabled() && typeof repo.createPagomediosPayment === 'function'

  const runVerify = useCallback(async () => {
    const verifyPayment = repo.verifyPagomediosPayment?.bind(repo)
    if (!paymentId || !verifyPayment) return
    setVerify({ kind: 'checking' })
    try {
      const result = await verifyPayment({ paymentId })
      if (result.status === 'approved') {
        setVerify({ kind: 'approved' })
        await refresh()
        setTimeout(() => navigate('/membresia', { replace: true }), 1800)
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
  }, [paymentId, repo, refresh, navigate])

  useEffect(() => {
    void runVerify()
  }, [runVerify])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!planId || !repo.createPagomediosPayment) return
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
      await openPaymentPage(url, () => {
        navigate(`/membresia/pago?provider=pagomedios&paymentId=${encodeURIComponent(newPaymentId)}`, {
          replace: true,
        })
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
        {verify.kind === 'approved' ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-2xl border border-success/40 bg-success/10 p-4 text-sm text-ink"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            Pago aprobado. Tu membresía ya está activa.
          </div>
        ) : null}
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

  const inputClass =
    'w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink focus:border-acc focus:outline-none'

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <PageHeader
        title="Pagar en línea"
        subtitle={`${plan.name} · ${formatCurrency(plan.priceCents)} · pago único`}
      />

      <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-xs text-ink-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-acc" />
        Pagas en la página segura de Pagomedios. No guardamos datos de tu tarjeta ni se
        realizan cobros recurrentes.
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
      >
        <p className="text-xs text-ink-3">Datos para el comprobante de pago.</p>
        <label className="block space-y-1 text-sm">
          <span className="font-bold text-ink">Tipo de identificación</span>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as PagomediosDocumentType)}
            className={inputClass}
          >
            {DOCUMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-bold text-ink">Número de identificación</span>
          <input
            required
            inputMode={documentType === '05' || documentType === '04' ? 'numeric' : 'text'}
            minLength={documentType === '04' ? 13 : documentType === '05' ? 10 : 5}
            maxLength={documentType === '04' ? 13 : documentType === '05' ? 10 : 20}
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            className={inputClass}
            placeholder={documentType === '04' ? '1790012345001' : '0102030405'}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-bold text-ink">Celular</span>
          <input
            required
            inputMode="tel"
            minLength={9}
            maxLength={15}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            placeholder="0991234567"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-bold text-ink">Dirección</span>
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
            placeholder="Calle y número, ciudad"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-acc px-4 py-3 text-sm font-bold text-[var(--color-acc-contrast)] shadow-[var(--shadow-acc)] disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirigiendo a Pagomedios…
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Pagar {formatCurrency(plan.priceCents)} en Pagomedios
            </>
          )}
        </button>
      </form>

      <BackLink label="Cancelar y volver" />
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
