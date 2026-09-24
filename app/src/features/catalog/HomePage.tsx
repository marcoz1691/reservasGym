import { useState, type ReactNode } from 'react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarPlus,
  CreditCard,
  Dumbbell,
  Plus,
  Sparkles,
} from 'lucide-react'
import { useAppData, useCurrentUser, useGym } from '@/data/RepositoryProvider'
import { ZONE_LABELS } from '@/domain/models'
import { canBookZone, canUseBookingNav, displayFirstName } from '@/domain/rules'
import { selectMyMembership } from '@/app/store'
import { WelcomeNoPlanCard, PendingPlanRequestCard, isOnlinePayEnabled } from '@/features/memberships'
import { selectPendingPlanRequest } from '@/domain/rules/planRequest'
import { Badge, Button, Card, SkeletonCard } from '@/ui/primitives'

function greeting(hour: number): string {
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function HomePage() {
  const user = useCurrentUser()
  const data = useAppData()
  const { loading } = useGym()
  const [now] = useState(() => new Date())

  if (loading || !user) {
    return (
      <div className="space-y-5">
        <SkeletonCard />
        <div className="grid gap-3 sm:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    )
  }

  const mine = data.bookings.filter(
    (b) =>
      b.userId === user.id &&
      (b.status === 'confirmed' || b.status === 'waitlisted'),
  )

  const membership = selectMyMembership(data, user.id)
  const pendingRequest = selectPendingPlanRequest(data.payments ?? [], user.id)
  const pendingPlanName =
    (data.membershipPlans ?? []).find((plan) => plan.id === pendingRequest?.planId)
      ?.name ?? 'Plan solicitado'

  const next = mine
    .map((b) => ({
      booking: b,
      session: data.sessions.find((s) => s.id === b.sessionId),
    }))
    .filter((x) => x.session && new Date(x.session.startsAt) >= new Date())
    .sort((a, b) => a.session!.startsAt.localeCompare(b.session!.startsAt))[0]

  const memberPlan = membership
    ? (data.membershipPlans ?? []).find((plan) => plan.id === membership.planId)
    : undefined
  const upcoming = data.sessions
    .filter((s) => new Date(s.startsAt) >= new Date())
    .filter((s) => {
      if (user.role !== 'member' || !memberPlan) return true
      return canBookZone(memberPlan, s.zoneId).allowed
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 4)

  const lastWeight = data.measurements
    .filter((m) => m.userId === user.id)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0]

  const firstName = displayFirstName(user.fullName)
  const canBook = canUseBookingNav(user.role, membership)

  return (
    <div className="space-y-7">
      {/* Saludo */}
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-3">
          {format(now, "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
          {greeting(now.getHours())},{' '}
          <span className="text-acc">{firstName}</span>
        </h1>
      </header>

      {/* Próxima clase — hero */}
      {next?.session ? (
        <Card className="relative overflow-hidden border-acc/25 p-0">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-acc-glow blur-3xl" />
          <div className="relative p-5 sm:p-6">
            <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-acc">
              <Sparkles className="h-3.5 w-3.5" />
              Tu próxima clase
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold text-ink">
              {next.session.title}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {format(parseISO(next.session.startsAt), "EEEE d MMM · HH:mm", {
                locale: es,
              })}
              <span className="text-ink-3">
                {' — '}
                {formatDistanceToNow(parseISO(next.session.startsAt), {
                  locale: es,
                  addSuffix: true,
                })}
              </span>
            </p>
            {canBook ? (
              <Link to="/reservas" className="mt-4 inline-block">
                <Button variant="primary" size="sm">
                  Ver mis clases
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
          </div>
        </Card>
      ) : !membership && pendingRequest ? (
        <PendingPlanRequestCard
          payment={pendingRequest}
          planName={pendingPlanName}
        />
      ) : !membership ? (
        <WelcomeNoPlanCard onlinePayEnabled={isOnlinePayEnabled()} />
      ) : (
        <div className="relative overflow-hidden rounded-3xl border border-line bg-bg-2 shadow-2xl">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-acc" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-acc/10 blur-3xl" />
          <div className="relative flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-acc">
                Agenda libre
              </p>
              <p className="mt-2 font-display text-2xl font-black tracking-tight text-ink">
                Sin clases próximas
              </p>
              <p className="mt-1 text-sm text-ink-2">
                Aparta tu próxima sesión en Reservar.
              </p>
            </div>
            <Link to={canBook ? '/agenda' : '/explorar'}>
              <Button variant="primary" size="lg">
                {canBook ? 'Reservar clase' : 'Explorar áreas'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      <section
        aria-label="Tu actividad"
        className="overflow-hidden rounded-3xl border border-line bg-bg-2 shadow-2xl"
      >
        <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <PulseLink
            to={canBook ? '/reservas' : '/explorar'}
            label="Reservas activas"
            value={String(mine.length)}
            hint={bookingHint(mine.length)}
          />
          <PulseLink
            to="/explorar"
            label="Áreas disponibles"
            value={String(data.zones.length)}
            hint="En el complejo"
          />
          <PulseLink
            to="/peso"
            label="Último peso"
            value={lastWeight ? String(lastWeight.weightKg) : '—'}
            unit={lastWeight ? 'kg' : undefined}
            hint={
              lastWeight
                ? formatDistanceToNow(parseISO(lastWeight.measuredAt), {
                    locale: es,
                    addSuffix: true,
                  })
                : 'Todavía sin registro'
            }
          />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3 sm:px-5">
          {canBook ? (
            <ActionChip to="/agenda" icon={<CalendarPlus className="h-4 w-4" />}>
              Reservar clase
            </ActionChip>
          ) : (
            <ActionChip to="/explorar" icon={<Dumbbell className="h-4 w-4" />}>
              Explorar áreas
            </ActionChip>
          )}
          <ActionChip to="/peso" icon={<Plus className="h-4 w-4" />}>
            Registrar peso
          </ActionChip>
          <ActionChip to="/membresia" icon={<CreditCard className="h-4 w-4" />}>
            Mi plan
          </ActionChip>
        </div>
      </section>

      {/* Próximas sesiones */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-black tracking-tight text-ink">
            Próximas sesiones
          </h2>
          {canBook ? (
          <Link
            to="/agenda"
            className="focus-ring rounded-lg text-xs font-bold text-acc hover:text-acc-hi"
          >
            Ver agenda
          </Link>
          ) : (
          <Link
            to="/explorar"
            className="focus-ring rounded-lg text-xs font-bold text-acc hover:text-acc-hi"
          >
            Explorar áreas
          </Link>
          )}
        </div>

        {upcoming.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-3">
              No hay sesiones programadas por ahora.
            </p>
          </Card>
        ) : (
          <div className="stagger-in grid gap-3 sm:grid-cols-2">
            {upcoming.map((s) => {
              const zone = data.zones.find((z) => z.id === s.zoneId)
              const full = s.bookedCount >= s.capacity
              const almost = !full && s.bookedCount / s.capacity >= 0.8
              const pct = Math.min(
                100,
                Math.round((s.bookedCount / Math.max(1, s.capacity)) * 100),
              )
              return (
                <Link key={s.id} to="/agenda" className="focus-ring rounded-3xl">
                  <Card className="h-full hover:-translate-y-0.5 hover:border-acc/30 hover:shadow-[var(--shadow-pop)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-3">
                          {zone ? ZONE_LABELS[zone.type] : 'Área'}
                        </p>
                        <p className="mt-1 truncate font-bold text-ink">
                          {s.title}
                        </p>
                        <p className="text-sm text-ink-3">
                          {format(parseISO(s.startsAt), "EEE d MMM · HH:mm", {
                            locale: es,
                          })}
                        </p>
                      </div>
                      <Badge tone={full ? 'danger' : almost ? 'warn' : 'ok'}>
                        {s.bookedCount}/{s.capacity}
                      </Badge>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                      <div
                        className="h-full rounded-full bg-acc transition-[width] duration-500 ease-[var(--ease-out)]"
                        style={{
                          width: `${pct}%`,
                          background: full
                            ? 'var(--color-danger)'
                            : almost
                              ? 'var(--color-warn)'
                              : 'var(--color-acc)',
                        }}
                      />
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function bookingHint(count: number): string {
  if (count === 0) return 'Ninguna apartada'
  if (count === 1) return 'Una clase en tu agenda'
  return `${count} clases en tu agenda`
}

function PulseLink({
  to,
  label,
  value,
  unit,
  hint,
}: {
  to: string
  label: string
  value: string
  unit?: string
  hint: string
}) {
  return (
    <Link
      to={to}
      className="focus-ring group block px-5 py-5 transition-colors hover:bg-surface/60 sm:px-6 sm:py-6"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-1.5 font-display text-4xl font-black tabular-nums tracking-tight text-ink">
        {value}
        {unit ? (
          <span className="text-base font-bold text-ink-3">{unit}</span>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-ink-2">{hint}</p>
    </Link>
  )
}

function ActionChip({
  to,
  icon,
  children,
}: {
  to: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className="focus-ring inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink-2 transition-[transform,border-color,color,background-color] duration-150 ease-[var(--ease-out)] hover:border-acc/40 hover:text-ink active:scale-[0.97]"
    >
      <span className="text-acc">{icon}</span>
      {children}
    </Link>
  )
}
