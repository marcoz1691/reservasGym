import { useState, type ReactNode } from 'react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarPlus,
  ChevronRight,
  CreditCard,
  Dumbbell,
  Lock,
  Minus,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useAppData, useCurrentUser, useGym } from '@/data/RepositoryProvider'
import { ZONE_LABELS } from '@/domain/models'
import type { Membership, MembershipPlan } from '@/domain/models'
import { canBookZone, canUseBookingNav, displayFirstName } from '@/domain/rules'
import { computeMembershipStatus, daysRemaining } from '@/domain/rules/membership'
import { AreaThumb } from './components/AreaThumb'
import { selectMyMembership } from '@/app/store'
import { WelcomeNoPlanCard, PendingPlanRequestCard, isOnlinePayEnabled } from '@/features/memberships'
import { selectPendingPlanRequest } from '@/domain/rules/planRequest'
import { Badge, Button, Card, SkeletonCard } from '@/ui/primitives'

const DAY_MS = 24 * 60 * 60 * 1000

function greeting(hour: number): string {
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function dayKey(value: Date | string): string {
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, 'yyyy-MM-dd')
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

  const myMeasurements = data.measurements
    .filter((m) => m.userId === user.id)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
  const lastWeight = myMeasurements[0]
  const previousWeight = myMeasurements[1]
  const weightDelta =
    lastWeight && previousWeight
      ? Math.round((lastWeight.weightKg - previousWeight.weightKg) * 10) / 10
      : null

  const myCheckIns = (data.checkIns ?? []).filter((c) => c.userId === user.id)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const checkInsThisMonth = myCheckIns.filter(
    (c) => new Date(c.checkedInAt).getTime() >= monthStart,
  ).length
  const attendedDays = new Set(myCheckIns.map((c) => dayKey(c.checkedInAt)))

  // Últimos 7 días, el de hoy al final: da lectura de racha sin pedir más datos.
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * DAY_MS)
    return {
      date,
      key: dayKey(date),
      attended: attendedDays.has(dayKey(date)),
      isToday: index === 6,
    }
  })

  const firstName = displayFirstName(user.fullName)
  const canBook = canUseBookingNav(user.role, membership)

  return (
    <div className="space-y-8">
      {/* Saludo */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-3">
            {format(now, "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
            {greeting(now.getHours())},{' '}
            <span className="text-acc">{firstName}</span>
          </h1>
        </div>
        {membership && memberPlan ? (
          <Link
            to="/membresia"
            className="focus-ring group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-line-strong"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            {memberPlan.name}
            <ChevronRight className="h-3.5 w-3.5 text-ink-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </header>

      {/* Próxima clase — hero */}
      {next?.session ? (
        <Card className="relative overflow-hidden p-0">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-acc/50 via-acc/10 to-transparent"
            aria-hidden
          />
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
        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)]">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-acc/70" aria-hidden />
          <div className="relative flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
                Agenda libre
              </p>
              <p className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
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

      {membership && memberPlan ? (
        <MembershipStrip membership={membership} plan={memberPlan} now={now} />
      ) : null}

      <section
        aria-label="Tu actividad"
        className="overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)]"
      >
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
          <PulseLink
            to={canBook ? '/reservas' : '/explorar'}
            label="Reservas activas"
            value={String(mine.length)}
            hint={bookingHint(mine.length)}
          />
          <PulseLink
            to="/check-in"
            label="Asistencias"
            value={String(checkInsThisMonth)}
            hint={checkInsThisMonth === 0 ? 'Aún sin check-in' : 'Este mes'}
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
        <div className="flex flex-wrap gap-2 border-t border-line bg-surface-elevated/60 px-4 py-3 sm:px-5">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Próximas sesiones */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl font-bold tracking-tight text-ink">
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
                const spots = Math.max(0, s.capacity - s.bookedCount)
                const pct = Math.min(
                  100,
                  Math.round((s.bookedCount / Math.max(1, s.capacity)) * 100),
                )
                return (
                  <Link key={s.id} to="/agenda" className="focus-ring rounded-3xl">
                    <Card className="h-full hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-pop)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 gap-3">
                          <AreaThumb zone={zone} zoneId={s.zoneId} />
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-3">
                              {zone ? ZONE_LABELS[zone.type] : 'Área'}
                            </p>
                            <p className="mt-0.5 truncate font-bold text-ink">
                              {s.title}
                            </p>
                            <p className="text-sm text-ink-3">
                              {format(parseISO(s.startsAt), "EEE d MMM · HH:mm", {
                                locale: es,
                              })}
                            </p>
                          </div>
                        </div>
                        <Badge tone={full ? 'danger' : almost ? 'warn' : 'ok'}>
                          {s.bookedCount}/{s.capacity}
                        </Badge>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                        <div
                          className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]"
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
                      <p className="mt-2 text-[11px] font-medium text-ink-3">
                        {full
                          ? 'Cupo completo · entra a lista de espera'
                          : `${spots} ${spots === 1 ? 'cupo libre' : 'cupos libres'}`}
                      </p>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Columna lateral: racha, progreso y áreas */}
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-display text-xl font-bold tracking-tight text-ink">
              Tu semana
            </h2>
            <Card>
              <div className="flex items-end justify-between gap-1.5">
                {week.map((day) => (
                  <div key={day.key} className="flex flex-1 flex-col items-center gap-1.5">
                    <span
                      aria-hidden
                      className={`flex h-9 w-full items-center justify-center rounded-xl border text-[11px] font-bold tabular-nums transition ${
                        day.attended
                          ? 'border-acc/30 bg-acc-soft text-acc'
                          : day.isToday
                            ? 'border-line-strong bg-surface-elevated text-ink-2'
                            : 'border-line bg-surface-elevated/60 text-ink-3'
                      }`}
                    >
                      {format(day.date, 'd')}
                    </span>
                    <span className="text-[10px] font-medium uppercase text-ink-3">
                      {format(day.date, 'EEEEE', { locale: es })}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 border-t border-line pt-3 text-xs text-ink-2">
                {attendedDays.size === 0
                  ? 'Marca tu primer check-in y empieza la racha.'
                  : `${week.filter((d) => d.attended).length} de 7 días con asistencia.`}
              </p>
            </Card>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-xl font-bold tracking-tight text-ink">
                Progreso
              </h2>
              <Link
                to="/peso"
                className="focus-ring rounded-lg text-xs font-bold text-acc hover:text-acc-hi"
              >
                Ver detalle
              </Link>
            </div>
            <Card>
              {lastWeight ? (
                <>
                  {/* El peso exacto vive en el panel de arriba; aquí manda la tendencia. */}
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
                      Tendencia
                    </p>
                    <DeltaPill delta={weightDelta} />
                  </div>
                  <p className="mt-2 text-sm text-ink-2">
                    {myMeasurements.length}{' '}
                    {myMeasurements.length === 1 ? 'registro' : 'registros'} · último el{' '}
                    {format(parseISO(lastWeight.measuredAt), "d 'de' MMM", { locale: es })}{' '}
                    con {lastWeight.weightKg} kg
                  </p>
                  <Sparkbars
                    values={myMeasurements
                      .slice(0, 8)
                      .map((m) => m.weightKg)
                      .reverse()}
                  />
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-ink-2">
                    Registra tu peso para ver la evolución aquí.
                  </p>
                  <Link
                    to="/peso"
                    className="focus-ring inline-flex items-center gap-1.5 rounded-lg text-sm font-bold text-acc hover:text-acc-hi"
                  >
                    Registrar peso
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </Card>
          </section>

          {data.zones.length > 0 ? (
            <section>
              <div className="mb-3 flex items-end justify-between">
                <h2 className="font-display text-xl font-bold tracking-tight text-ink">
                  Tus disciplinas
                </h2>
                <Link
                  to="/explorar"
                  className="focus-ring rounded-lg text-xs font-bold text-acc hover:text-acc-hi"
                >
                  Ver todas
                </Link>
              </div>
              <Card className="space-y-1.5">
                {data.zones.slice(0, 6).map((zone) => {
                  const included =
                    user.role !== 'member' ||
                    (memberPlan
                      ? canBookZone(memberPlan, zone.id).allowed
                      : Boolean(membership))
                  return (
                    <div
                      key={zone.id}
                      className="flex items-center gap-3 rounded-xl px-1 py-1.5"
                    >
                      <AreaThumb
                        zone={zone}
                        className={`h-9 w-9 ${included ? '' : 'opacity-50 grayscale'}`}
                        iconClassName="h-4 w-4"
                      />
                      <span
                        className={`min-w-0 flex-1 truncate text-sm font-semibold ${
                          included ? 'text-ink' : 'text-ink-3'
                        }`}
                      >
                        {zone.name}
                      </span>
                      {included ? (
                        <span className="shrink-0 text-[11px] font-semibold text-success">
                          Incluida
                        </span>
                      ) : (
                        <Lock
                          role="img"
                          aria-label="No incluida en tu plan"
                          className="h-3.5 w-3.5 shrink-0 text-ink-3"
                        />
                      )}
                    </div>
                  )
                })}
                {user.role === 'member' && !membership ? (
                  <Link
                    to="/membresia"
                    className="focus-ring mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-elevated px-3 py-2 text-sm font-semibold text-ink transition hover:border-line-strong"
                  >
                    Desbloquear con un plan
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </Card>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function bookingHint(count: number): string {
  if (count === 0) return 'Ninguna apartada'
  if (count === 1) return 'Una clase en tu agenda'
  return `${count} clases en tu agenda`
}

/** Vigencia del plan en una línea: estado, días restantes y avance del periodo. */
function MembershipStrip({
  membership,
  plan,
  now,
}: {
  membership: Membership
  plan: MembershipPlan
  now: Date
}) {
  const status = computeMembershipStatus(membership, now)
  if (status === 'cancelled') return null

  const remaining = daysRemaining(membership, now)
  const start = new Date(membership.startsAt).getTime()
  const end = new Date(membership.endsAt).getTime()
  const elapsed = Math.min(
    100,
    Math.max(0, Math.round(((now.getTime() - start) / Math.max(1, end - start)) * 100)),
  )
  const tone =
    status === 'active'
      ? remaining <= 5
        ? 'warn'
        : 'ok'
      : status === 'grace'
        ? 'warn'
        : 'danger'
  const barColor =
    tone === 'ok'
      ? 'var(--color-acc)'
      : tone === 'warn'
        ? 'var(--color-warn)'
        : 'var(--color-danger)'

  return (
    <Link to="/membresia" className="focus-ring block rounded-3xl">
      <Card className="hover:border-line-strong">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
              Tu membresía
            </p>
            <p className="mt-1 truncate font-display text-lg font-bold tracking-tight text-ink">
              {plan.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={tone === 'ok' ? 'ok' : tone === 'warn' ? 'warn' : 'danger'}>
              {status === 'active'
                ? remaining === 1
                  ? 'Último día'
                  : `${remaining} días`
                : status === 'grace'
                  ? 'En gracia'
                  : 'Vencida'}
            </Badge>
            <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]"
            style={{ width: `${elapsed}%`, background: barColor }}
          />
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Vence el {format(parseISO(membership.endsAt), "d 'de' MMMM", { locale: es })}
          {membership.visitsLeft !== null && membership.visitsLeft !== undefined
            ? ` · ${membership.visitsLeft} visitas disponibles`
            : ''}
        </p>
      </Card>
    </Link>
  )
}

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-elevated px-2.5 py-1 text-[11px] font-semibold text-ink-3">
        Primer registro
      </span>
    )
  }
  const flat = Math.abs(delta) < 0.05
  const Icon = flat ? Minus : delta < 0 ? TrendingDown : TrendingUp
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${
        flat ? 'bg-surface-elevated text-ink-3' : 'bg-success-soft text-success'
      }`}
    >
      <Icon className="h-3 w-3" />
      {flat ? 'Sin cambio' : `${delta > 0 ? '+' : ''}${delta} kg`}
    </span>
  )
}

/** Mini serie del peso: suficiente para leer la tendencia sin abrir la sección. */
function Sparkbars({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(0.1, max - min)
  return (
    <div className="mt-4 flex h-12 items-end gap-1" aria-hidden>
      {values.map((value, index) => (
        <div
          key={index}
          className="flex-1 rounded-t-sm bg-acc/25 transition-[height] duration-500 ease-[var(--ease-out)]"
          style={{ height: `${20 + ((value - min) / span) * 80}%` }}
        />
      ))}
    </div>
  )
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
      className="focus-ring group block px-4 py-5 transition-colors hover:bg-surface-elevated/70 sm:px-5 sm:py-6"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-1.5 font-display text-3xl font-bold tabular-nums tracking-tight text-ink sm:text-4xl">
        {value}
        {unit ? (
          <span className="text-base font-semibold text-ink-3">{unit}</span>
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
      className="focus-ring inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink-2 transition-[transform,border-color,color,background-color] duration-150 ease-[var(--ease-out)] hover:border-line-strong hover:text-ink active:scale-[0.97]"
    >
      <span className="text-ink-3">{icon}</span>
      {children}
    </Link>
  )
}
