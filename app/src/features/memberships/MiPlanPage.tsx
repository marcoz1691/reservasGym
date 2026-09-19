import { useMemo } from 'react'
import {
  Building2,
  CalendarCheck,
  Dumbbell,
  ShieldAlert,
} from 'lucide-react'
import { useAppData, useCurrentUser } from '@/data/RepositoryProvider'
import { selectMyMembership } from '@/app/store'
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

      {/* Hero Section: Membership Card or Empty State */}
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
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-300">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <span>Sin membresía activa</span>
            </div>

            <h2 className="text-2xl font-black tracking-tight text-ink md:text-3xl">
              Activa tu plan en recepción para empezar a entrenar
            </h2>

            <p className="text-sm text-ink-2 leading-relaxed">
              Actualmente no cuentas con una membresía activa en Zona Cero Performance.
              Para reservar clases grupales, acceder a las salas de entrenamiento y registrar tu progreso, acércate a la recepción del gimnasio.
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
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                  <Building2 className="h-4 w-4" />
                  <span>2. Visita recepción</span>
                </div>
                <p className="text-[11px] text-ink-3">
                  Paga en efectivo, transferencia o tarjeta Datafast.
                </p>
              </div>

              <div className="rounded-2xl border border-line/60 bg-bg/50 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CalendarCheck className="h-4 w-4" />
                  <span>3. Reserva y entrena</span>
                </div>
                <p className="text-[11px] text-ink-3">
                  Tu acceso se habilita de inmediato en la app.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA Notice Card */}
      <RenewalNoticeCard />

      {/* Available Plans Showcase */}
      <PlansShowcase
        plans={data.membershipPlans ?? []}
        currentPlanId={
          currentMembership?.status === 'active' || currentMembership?.status === 'grace'
            ? currentMembership.planId
            : null
        }
        zones={data.zones ?? []}
      />

      {/* Payment History Section */}
      <PaymentHistory
        payments={myPayments}
        plans={data.membershipPlans ?? []}
      />
    </div>
  )
}
