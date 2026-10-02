import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeftRight, ArrowRight, Banknote, Check, CreditCard, ShieldAlert } from 'lucide-react'
import { useAppData, useCurrentUser, useGym, useRepo } from '@/data/RepositoryProvider'
import { selectMyMembership } from '@/app/store'
import type { ManualPaymentMethod } from '@/domain/models'
import {
  MANUAL_PAYMENT_LABELS,
  selectPendingPlanRequest,
} from '@/domain/rules/planRequest'
import { plansForAppSale } from '@/domain/rules/featureFlags'
import { formatCurrency } from '@/lib/format'
import { Button, PageHeader } from '@/ui/primitives'
import { isOnlinePayEnabled } from './onlinePay'
import {
  MembershipCard,
  PaymentHistory,
  PendingPlanRequestCard,
  PlansShowcase,
} from './components'

const PAYMENT_METHODS: ManualPaymentMethod[] = ['cash', 'transfer', 'card_pos']

const PAYMENT_ICONS = {
  cash: Banknote,
  transfer: ArrowLeftRight,
  card_pos: CreditCard,
} as const

const PAYMENT_HINTS: Record<ManualPaymentMethod, string> = {
  cash: 'En caja del counter',
  transfer: 'Bancos locales',
  card_pos: 'Datáfono en recepción',
}

export function MiPlanPage() {
  const user = useCurrentUser()
  const data = useAppData()
  const repo = useRepo()
  const { refresh } = useGym()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [payBanner, setPayBanner] = useState<string | null>(null)
  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null)
  const [chosenMethod, setChosenMethod] = useState<ManualPaymentMethod | null>(null)
  const [revising, setRevising] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState('')
  const paymentStepRef = useRef<HTMLDivElement>(null)

  const onlinePayEnabled = isOnlinePayEnabled(data.settings)

  const currentMembership = useMemo(
    () => selectMyMembership(data, user?.id),
    [data, user?.id],
  )

  const currentPlan = useMemo(() => {
    if (!currentMembership) return null
    return (
      (data.membershipPlans ?? []).find(
        (p) => p.id === currentMembership.planId,
      ) ?? null
    )
  }, [data.membershipPlans, currentMembership])

  const myPayments = useMemo(() => {
    if (!user) return []
    return (data.payments ?? [])
      .filter((p) => p.userId === user.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }, [data.payments, user])

  const pendingRequest = user
    ? selectPendingPlanRequest(data.payments ?? [], user.id)
    : null
  const pendingPlanName =
    (data.membershipPlans ?? []).find((plan) => plan.id === pendingRequest?.planId)
      ?.name ?? 'Plan solicitado'
  const chosenPlan = (data.membershipPlans ?? []).find(
    (plan) => plan.id === chosenPlanId,
  )

  const memberSince = user?.createdAt
    ? format(parseISO(user.createdAt), 'MMM yyyy', { locale: es })
    : undefined

  function scrollToCatalog() {
    document.getElementById('planes-catalogo')?.scrollIntoView({ block: 'start' })
  }

  async function handleRequestPayment(method: ManualPaymentMethod) {
    if (!chosenPlanId) return
    setRequesting(true)
    setRequestError('')
    try {
      await repo.requestPlanPayment({ planId: chosenPlanId, manualMethod: method })
      setChosenPlanId(null)
      setChosenMethod(null)
      setRevising(false)
      await refresh()
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : 'No se pudo enviar la solicitud.',
      )
    } finally {
      setRequesting(false)
    }
  }

  useEffect(() => {
    const payment = searchParams.get('payment')
    if (!payment) return

    if (payment === 'success') {
      setPayBanner('Pago recibido. Revisa el estado de tu membresía abajo.')
      void refresh()
    } else if (payment === 'failure') {
      setPayBanner('El pago no se completó. Puedes intentar de nuevo o pagar en recepción.')
    } else if (payment === 'pending') {
      setPayBanner('Pago pendiente de confirmación.')
    }

    const next = new URLSearchParams(searchParams)
    next.delete('payment')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, refresh])

  function handlePayOnline(selectedPlanId: string) {
    navigate(`/membresia/pago?planId=${encodeURIComponent(selectedPlanId)}`)
  }

  function handleChoosePlan(planId: string) {
    setChosenPlanId(planId)
    setChosenMethod(null)
    setRequestError('')
  }

  function handleChangePlan() {
    setChosenPlanId(null)
    setChosenMethod(null)
    setRevising(true)
    setRequestError('')
  }

  const choosingPayment = Boolean(chosenPlan) && !onlinePayEnabled
  const showCatalog = !choosingPayment && (onlinePayEnabled || !pendingRequest || revising)
  const showEmptyHero = !currentMembership && !pendingRequest && !choosingPayment

  useEffect(() => {
    if (!choosingPayment) return
    const node = paymentStepRef.current
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'start' })
    }
  }, [choosingPayment, chosenPlanId])

  if (!user) {
    return (
      <div className="p-4 text-center text-ink-3">
        Inicia sesión para ver tu membresía.
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        title="Mi Plan"
        subtitle="Consulta el estado de tu membresía, vigencia y comprobantes de pago"
      />

      {payBanner ? (
        <div
          role="status"
          className="rounded-2xl border border-acc/30 bg-acc/10 px-4 py-3 text-sm text-ink"
        >
          {payBanner}
        </div>
      ) : null}

      {pendingRequest && !choosingPayment && !revising ? (
        <div className="space-y-3">
          <PendingPlanRequestCard
            payment={pendingRequest}
            planName={pendingPlanName}
          />
          <button
            type="button"
            onClick={handleChangePlan}
            className="text-sm font-bold text-acc"
          >
            Cambiar
          </button>
        </div>
      ) : null}

      {currentMembership ? (
        <MembershipCard
          membership={currentMembership}
          plan={currentPlan}
          zones={data.zones ?? []}
          memberName={user.fullName}
          memberSince={memberSince}
          onRenew={scrollToCatalog}
        />
      ) : showEmptyHero ? (
        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-acc/50 via-acc/10 to-transparent"
          />
          <div className="relative z-10 space-y-6 p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-warn/25 bg-warn-soft px-3.5 py-1 text-xs font-bold text-warn">
              <ShieldAlert className="h-4 w-4 text-warn" />
              <span>Sin membresía activa</span>
            </div>

            <div className="max-w-xl space-y-3">
              <h2 className="font-display text-3xl font-bold leading-[1.08] tracking-tight text-ink md:text-[2.75rem]">
                {onlinePayEnabled ? (
                  <>
                    Activa tu plan{' '}
                    <span className="mt-1 block text-ink-2">en línea o en recepción.</span>
                  </>
                ) : (
                  <>
                    Elige tu plan{' '}
                    <span className="mt-1 block text-ink-2">y empieza a entrenar.</span>
                  </>
                )}
              </h2>
              <p className="max-w-lg text-base leading-relaxed text-ink-2 md:text-lg">
                {onlinePayEnabled
                  ? 'Paga con tarjeta o en recepción. En cuanto queda el pago, tu acceso se activa y reservas.'
                  : 'Pagas en recepción. En cuanto registramos el pago, tu acceso queda activo y reservas clase.'}
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-3">
                Eliges el plan y, en el siguiente paso, cómo pagarlo.
              </p>
              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto"
                onClick={scrollToCatalog}
              >
                Ver planes
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showCatalog ? (
        <PlansShowcase
          plans={plansForAppSale(data.membershipPlans ?? [], data.settings)}
          currentPlanId={
            currentMembership?.status === 'active' || currentMembership?.status === 'grace'
              ? currentMembership.planId
              : null
          }
          zones={data.zones ?? []}
          onlinePayEnabled={onlinePayEnabled}
          onPayOnline={onlinePayEnabled ? handlePayOnline : undefined}
          onChoosePlan={onlinePayEnabled ? undefined : handleChoosePlan}
        />
      ) : null}

      {choosingPayment && chosenPlan ? (
        <div ref={paymentStepRef} className="space-y-4 scroll-mt-4">
          {/* Resumen del plan elegido: contexto permanente mientras se decide el pago */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-elevated px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-2"
              >
                <Check className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  {currentMembership ? 'Plan a activar' : 'Plan elegido'}
                </p>
                <p className="truncate text-sm font-bold text-ink">{chosenPlan.name}</p>
                <p className="text-xs text-ink-2">
                  {formatCurrency(chosenPlan.priceCents)} · {chosenPlan.durationDays} días
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleChangePlan}
              className="focus-ring shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-acc hover:text-acc-hi"
            >
              Cambiar
            </button>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
            <h3 className="font-display text-lg font-bold tracking-tight text-ink">
              ¿Cómo vas a pagar?
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">
              El pago se completa en recepción. Tu acceso se activa cuando lo registren.
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {PAYMENT_METHODS.map((method) => {
                const selected = chosenMethod === method
                const Icon = PAYMENT_ICONS[method]
                return (
                  <button
                    key={method}
                    type="button"
                    aria-pressed={selected}
                    aria-label={MANUAL_PAYMENT_LABELS[method]}
                    disabled={requesting}
                    onClick={() => setChosenMethod(method)}
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition disabled:opacity-60 active:scale-[0.99] ${
                      selected
                        ? 'border-acc/45 bg-acc-soft ring-1 ring-inset ring-acc/15'
                        : 'border-line bg-surface hover:border-line-strong'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                        selected
                          ? 'border-acc/30 bg-surface text-acc'
                          : 'border-line bg-surface-elevated text-ink-3'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span aria-hidden className="min-w-0">
                      <span className="block text-sm font-bold text-ink">
                        {MANUAL_PAYMENT_LABELS[method]}
                      </span>
                      <span className="block text-[11px] text-ink-3">
                        {PAYMENT_HINTS[method]}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              disabled={!chosenMethod || requesting}
              onClick={() => {
                if (chosenMethod) void handleRequestPayment(chosenMethod)
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:opacity-40 active:scale-[0.99]"
            >
              Enviar solicitud
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <p className="mt-3 text-center text-xs text-ink-3">
              Reservamos tu plan y recepción lo activa al registrar el cobro.
            </p>
            {requestError ? (
              <p className="mt-3 text-sm text-danger" role="alert">
                {requestError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <PaymentHistory
        payments={myPayments}
        plans={data.membershipPlans ?? []}
      />
    </div>
  )
}
