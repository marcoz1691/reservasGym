import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Building2,
  CalendarCheck,
  Dumbbell,
  ShieldAlert,
} from 'lucide-react'
import { useAppData, useCurrentUser, useGym } from '@/data/RepositoryProvider'
import { isSupabaseConfigured } from '@/data/supabaseRepository'
import { computeMembershipStatus } from '@/domain/rules/membership'
import { PageHeader } from '@/ui/primitives'
import {
  MembershipCard,
  PaymentHistory,
  PlansShowcase,
  RenewalNoticeCard,
} from './components'

export function MiPlanPage() {
  const user = useCurrentUser()
  const data = useAppData()
  const { repo, refresh } = useGym()
  const [searchParams, setSearchParams] = useSearchParams()
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [payBanner, setPayBanner] = useState<string | null>(null)

  /**
   * Pago online desactivado para Ecuador.
   * Mercado Pago Checkout Pro no está disponible en EC (sí en AR/BR/CL/CO/MX/PE/UY).
   * Pasarelas locales: Datafast Dataweb, Kushki, PagoPlux — ver docs/tecnico/pasarelas-ecuador.md
   * Cuando haya credenciales de una pasarela EC, activar con VITE_ONLINE_PAYMENTS=1 + adaptador.
   */
  const onlinePayEnabled =
    import.meta.env.VITE_ONLINE_PAYMENTS === '1' &&
    isSupabaseConfigured() &&
    typeof repo.createOnlineCheckout === 'function'

  const currentMembership = useMemo(() => {
    if (!user) return null
    const userMems = (data.memberships ?? []).filter((m) => m.userId === user.id)
    if (userMems.length === 0) return null

    const active = userMems.find((m) => {
      const s = computeMembershipStatus(m)
      return s === 'active' || s === 'grace'
    })
    if (active) {
      return { ...active, status: computeMembershipStatus(active) }
    }

    const sorted = [...userMems].sort(
      (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime(),
    )
    const latest = sorted[0]
    if (!latest) return null
    return { ...latest, status: computeMembershipStatus(latest) }
  }, [data.memberships, user])

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

  useEffect(() => {
    const payment = searchParams.get('payment')
    if (!payment) return

    if (payment === 'success') {
      setPayBanner(
        'Pago recibido. Si tu plan aún no aparece activo, espera unos segundos y actualiza — el webhook confirma el cobro.',
      )
      void refresh()
    } else if (payment === 'failure') {
      setPayBanner('El pago no se completó. Puedes intentar de nuevo o pagar en recepción.')
    } else if (payment === 'pending') {
      setPayBanner('Pago pendiente de confirmación. Te avisaremos cuando Mercado Pago lo apruebe.')
    }

    const next = new URLSearchParams(searchParams)
    next.delete('payment')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, refresh])

  const handlePayOnline = useCallback(
    async (planId: string) => {
      if (!repo.createOnlineCheckout) {
        setPayError('Pago en línea no disponible en este ambiente.')
        return
      }
      setPayError(null)
      setPayingPlanId(planId)
      try {
        const { initPoint } = await repo.createOnlineCheckout(planId)
        window.location.assign(initPoint)
      } catch (err) {
        setPayError(
          err instanceof Error ? err.message : 'No se pudo iniciar el pago en línea',
        )
        setPayingPlanId(null)
      }
    },
    [repo],
  )

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

      {payError ? (
        <div
          role="alert"
          className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {payError}
        </div>
      ) : null}

      {currentMembership ? (
        <MembershipCard
          membership={currentMembership}
          plan={currentPlan}
          zones={data.zones ?? []}
        />
      ) : (
        <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-bg-2 via-bg-2 to-surface/60 p-8 shadow-2xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-acc/10 blur-3xl" />
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-warn/30 bg-warn-soft px-3.5 py-1 text-xs font-bold text-warn">
              <ShieldAlert className="h-4 w-4 text-warn" />
              <span>Sin membresía activa</span>
            </div>

            <h2 className="text-2xl font-black tracking-tight text-ink md:text-3xl">
              {onlinePayEnabled
                ? 'Activa tu plan en línea o en recepción'
                : 'Activa tu plan en recepción para empezar a entrenar'}
            </h2>

            <p className="text-sm text-ink-2 leading-relaxed">
              Actualmente no cuentas con una membresía activa en Zona Cero Performance.
              {onlinePayEnabled
                ? ' Elige un plan abajo y paga con tarjeta, o acércate a recepción.'
                : ' Para reservar clases, acércate a la recepción del gimnasio.'}
            </p>

            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-2xl border border-line/60 bg-bg/50 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-acc">
                  <Dumbbell className="h-4 w-4" />
                  <span>1. Elige tu plan</span>
                </div>
                <p className="text-[11px] text-ink-3">
                  Revisa los planes y disciplinas disponibles abajo.
                </p>
              </div>

              <div className="rounded-2xl border border-line/60 bg-bg/50 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-600">
                  <Building2 className="h-4 w-4" />
                  <span>{onlinePayEnabled ? '2. Paga en línea' : '2. Visita recepción'}</span>
                </div>
                <p className="text-[11px] text-ink-3">
                  {onlinePayEnabled
                    ? 'Mercado Pago seguro, o efectivo / transferencia / Datafast.'
                    : 'Paga en efectivo, transferencia o tarjeta Datafast.'}
                </p>
              </div>

              <div className="rounded-2xl border border-line/60 bg-bg/50 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-success">
                  <CalendarCheck className="h-4 w-4" />
                  <span>3. Reserva y entrena</span>
                </div>
                <p className="text-[11px] text-ink-3">
                  Tu acceso se habilita al confirmar el pago.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <RenewalNoticeCard onlinePayEnabled={onlinePayEnabled} />

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
        payingPlanId={payingPlanId}
      />

      <PaymentHistory
        payments={myPayments}
        plans={data.membershipPlans ?? []}
      />
    </div>
  )
}
