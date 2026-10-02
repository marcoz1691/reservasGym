import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Loader2, ShieldCheck } from 'lucide-react'
import { useAppData, useCurrentUser, useGym } from '@/data/RepositoryProvider'
import { formatCurrency } from '@/lib/format'
import { PageHeader } from '@/ui/primitives'
import { isOnlinePayEnabled, isOnlinePayEnvEnabled } from './onlinePay'

/**
 * Checkout Datafast Dataweb (COPYandPay widget).
 * Entry: /membresia/pago?planId=
 * Return: /membresia/pago?paymentId=&resourcePath=
 */
export function DatafastCheckoutPage() {
  const user = useCurrentUser()
  const data = useAppData()
  const { repo, refresh } = useGym()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const planId = searchParams.get('planId')
  const paymentId = searchParams.get('paymentId')
  const resourcePath = searchParams.get('resourcePath')

  const plan = useMemo(
    () => (data.membershipPlans ?? []).find((p) => p.id === planId && p.active) ?? null,
    [data.membershipPlans, planId],
  )

  const [phone, setPhone] = useState('')
  const [identification, setIdentification] = useState('')
  const [street, setStreet] = useState(user?.residence ?? 'Quito')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<{
    checkoutId: string
    paymentId: string
    widgetScriptUrl: string
    shopperResultUrl: string
  } | null>(null)

  // Un pago que vuelve de Datafast se verifica aunque el admin haya apagado el interruptor.
  const onlineOk =
    typeof repo.createOnlineCheckout === 'function' &&
    (resourcePath && paymentId ? isOnlinePayEnvEnabled() : isOnlinePayEnabled(data.settings))

  // Handle return from Datafast widget
  useEffect(() => {
    // Se enlaza fuera del closure: dentro, TS pierde el estrechamiento del opcional.
    const verifyOnlinePayment = repo.verifyOnlinePayment?.bind(repo)
    if (!resourcePath || !paymentId || !verifyOnlinePayment) return
    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError(null)
      try {
        const result = await verifyOnlinePayment({ paymentId, resourcePath })
        if (cancelled) return
        if (result.ok) {
          setStatusMsg('Pago aprobado. Tu membresía ya está activa.')
          await refresh()
          setTimeout(() => navigate('/membresia', { replace: true }), 1800)
        } else {
          setError(result.description ?? 'El pago no fue aprobado.')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al verificar el pago')
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resourcePath, paymentId, repo, refresh, navigate])

  // Mount COPYandPay widget when checkout is ready
  useEffect(() => {
    if (!checkout) return
    const script = document.createElement('script')
    script.src = checkout.widgetScriptUrl
    script.async = true
    document.body.appendChild(script)
    return () => {
      script.remove()
      document.querySelectorAll('form.paymentWidgets').forEach((el) => {
        el.innerHTML = ''
      })
    }
  }, [checkout])

  async function handleStartCheckout(e: FormEvent) {
    e.preventDefault()
    if (!planId || !repo.createOnlineCheckout) return
    setBusy(true)
    setError(null)
    try {
      const result = await repo.createOnlineCheckout({
        planId,
        phone,
        identification,
        street,
      })
      setCheckout(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar Datafast')
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <div className="p-4 text-center text-ink-3">
        Inicia sesión para pagar.
      </div>
    )
  }

  if (!onlineOk) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-sm text-ink-2">
          El pago en línea con Datafast no está activo en este ambiente.
        </p>
        <Link to="/membresia" className="text-sm font-bold text-acc">
          Volver a Mi Plan
        </Link>
      </div>
    )
  }

  if (resourcePath && paymentId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <PageHeader title="Confirmando pago" subtitle="Datafast Dataweb" />
        {busy ? (
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando con Datafast…
          </div>
        ) : null}
        {statusMsg ? (
          <div className="rounded-2xl border border-success/40 bg-success/10 p-4 text-sm text-ink">
            {statusMsg}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </div>
        ) : null}
        <Link to="/membresia" className="inline-flex items-center gap-1 text-sm font-bold text-acc">
          <ArrowLeft className="h-4 w-4" />
          Volver a Mi Plan
        </Link>
      </div>
    )
  }

  if (!planId || !plan) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-sm text-ink-2">Selecciona un plan desde Mi Plan.</p>
        <Link to="/membresia" className="text-sm font-bold text-acc">
          Ir a Mi Plan
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <PageHeader
        title="Pagar con tarjeta"
        subtitle={`${plan.name} · ${formatCurrency(plan.priceCents)} · Datafast`}
      />

      <div className="flex items-center gap-2 rounded-2xl border border-line bg-bg-2/80 px-3 py-2 text-xs text-ink-2">
        <ShieldCheck className="h-4 w-4 text-acc shrink-0" />
        Pago seguro PCI (widget Dataweb). No guardamos datos de tu tarjeta.
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {!checkout ? (
        <form onSubmit={handleStartCheckout} className="space-y-4 rounded-3xl border border-line bg-bg-2/80 p-5">
          <p className="text-xs text-ink-3">
            Datafast exige cédula y teléfono reales (no valores inventados).
          </p>
          <label className="block space-y-1 text-sm">
            <span className="font-bold text-ink">Cédula</span>
            <input
              required
              inputMode="numeric"
              minLength={10}
              maxLength={13}
              value={identification}
              onChange={(e) => setIdentification(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink"
              placeholder="0102030405"
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
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink"
              placeholder="0991234567"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-bold text-ink">Dirección (facturación)</span>
            <input
              required
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink"
              placeholder="Calle y número"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cta px-4 py-3 text-sm font-bold text-cta-contrast disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparando…
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Continuar al formulario de pago
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-3 rounded-3xl border border-line bg-bg-2/80 p-5">
          <p className="text-sm font-bold text-ink">Ingresa los datos de tu tarjeta</p>
          <form
            action={checkout.shopperResultUrl}
            className="paymentWidgets"
            data-brands="VISA MASTER AMEX DINERS DISCOVER"
          />
        </div>
      )}

      <Link to="/membresia" className="inline-flex items-center gap-1 text-sm font-bold text-acc">
        <ArrowLeft className="h-4 w-4" />
        Cancelar y volver
      </Link>
    </div>
  )
}
