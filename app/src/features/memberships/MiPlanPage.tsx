import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftRight, ArrowRight, Banknote, CreditCard, ShieldAlert } from 'lucide-react'
import { useAppData, useCurrentUser, useGym, useRepo } from '@/data/RepositoryProvider'
import { selectMyMembership } from '@/app/store'
import type { ManualPaymentMethod } from '@/domain/models'
import {
  MANUAL_PAYMENT_LABELS,
  selectPendingPlanRequest,
} from '@/domain/rules/planRequest'
import { formatCurrency } from '@/lib/format'
import { Button, PageHeader } from '@/ui/primitives'
import { isOnlinePayEnabled } from './onlinePay'
import {
  MembershipCard,
  PaymentHistory,
  PendingPlanRequestCard,
  PlansShowcase,
  RenewalNoticeCard,
} from './components'

const PAYMENT_METHODS: ManualPaymentMethod[] = ['cash', 'transfer', 'card_pos']

const PAYMENT_ICONS = {
  cash: Banknote,
  transfer: ArrowLeftRight,
  card_pos: CreditCard,
} as const

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

  const onlinePayEnabled = isOnlinePayEnabled()

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
        />
      ) : showEmptyHero ? (
        <div className="relative overflow-hidden rounded-3xl border border-line bg-bg-2 shadow-2xl">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-acc" />
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-acc/15 blur-3xl" />
          <div className="relative z-10 space-y-6 p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-warn/30 bg-warn-soft px-3.5 py-1 text-xs font-bold text-warn">
              <ShieldAlert className="h-4 w-4 text-warn" />
              <span>Sin membresía activa</span>
            </div>

            <div className="max-w-xl space-y-3">
              <h2 className="font-display text-3xl font-black leading-[1.05] tracking-tight text-ink md:text-5xl">
                {onlinePayEnabled ? (
                  <>
                    Activa tu plan{' '}
                    <span className="mt-1 block text-acc">en línea o en recepción.</span>
                  </>
                ) : (
                  <>
                    Elige tu plan{' '}
                    <span className="mt-1 block text-acc">y empieza a entrenar.</span>
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
              <ul aria-label="Formas de pago en recepción" className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = PAYMENT_ICONS[method]
                  return (
                    <li
                      key={method}
                      className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink"
                    >
                      <Icon className="h-4 w-4 text-acc" aria-hidden />
                      {MANUAL_PAYMENT_LABELS[method]}
                    </li>
                  )
                })}
              </ul>
              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() =>
                  document
                    .getElementById('planes-catalogo')
                    ?.scrollIntoView({ block: 'start' })
                }
              >
                Ver planes
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <RenewalNoticeCard onlinePayEnabled={onlinePayEnabled} />

      {showCatalog ? (
        <PlansShowcase
          plans={data.membershipPlans ?? []}
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
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-ink">{chosenPlan.name}</p>
              <p className="text-xs text-ink-2">
                {formatCurrency(chosenPlan.priceCents)} · {chosenPlan.durationDays} días
              </p>
            </div>
            <button
              type="button"
              onClick={handleChangePlan}
              className="shrink-0 text-sm font-bold text-acc"
            >
              Cambiar
            </button>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-5">
            <h3 className="text-lg font-extrabold text-ink">¿Cómo vas a pagar?</h3>
            <p className="mt-1 text-sm text-ink-2">
              El pago se completa en recepción. Tu acceso se activa cuando lo registren.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {PAYMENT_METHODS.map((method) => {
                const selected = chosenMethod === method
                return (
                  <button
                    key={method}
                    type="button"
                    aria-pressed={selected}
                    disabled={requesting}
                    onClick={() => setChosenMethod(method)}
                    className={`min-h-12 rounded-2xl border-2 bg-bg px-4 py-3 text-sm font-bold text-ink transition disabled:opacity-60 ${
                      selected ? 'border-acc bg-acc-soft' : 'border-line'
                    }`}
                  >
                    {MANUAL_PAYMENT_LABELS[method]}
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
              className="mt-4 flex w-full items-center justify-center rounded-2xl bg-acc px-4 py-3 text-sm font-bold text-[var(--color-acc-contrast)] transition hover:brightness-110 disabled:opacity-60"
            >
              Enviar solicitud
            </button>
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
