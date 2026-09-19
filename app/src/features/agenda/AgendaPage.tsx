import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Grid,
  Lock,
  UserCheck,
  Users,
} from 'lucide-react'
import {
  useAppData,
  useCurrentUser,
  useRefresh,
  useRepo,
} from '@/data/RepositoryProvider'
import type { Session } from '@/domain/models'
import { selectMyMembership } from '@/app/store'
import { canBookMembership, canBookZone } from '@/domain/rules'
import { getDisciplineMeta, ZONA_CERO_DISCIPLINES } from '@/domain/disciplines'
import {
  formatEcuadorTime,
  formatDateSpanish,
} from '@/lib/format'
import { Badge, Button, Card, PageHeader } from '@/ui/primitives'
import { ButtonLink } from '@/ui/ButtonLink'
import { BookingGateModal, PlanRequiredNotice, type BookingGateType } from '@/features/memberships'
import { StaffBookingModal } from './StaffBookingModal'

type View = 'dia' | 'semana' | 'mes'

export function AgendaPage() {
  const data = useAppData()
  const user = useCurrentUser()
  const repo = useRepo()
  const refresh = useRefresh()
  const [params, setParams] = useSearchParams()

  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin'

  const isMember = user?.role === 'member'

  const membership = useMemo(
    () => (user ? selectMyMembership(data, user.id) : null),
    [data, user],
  )

  // Estado de plan evaluado en el render: el botón de cada sesión no debe
  // invitar a un clic que siempre falla.
  const planStatus = useMemo(
    () => canBookMembership(membership).status,
    [membership],
  )
  const neverHadPlan = isMember && planStatus === 'none'
  const needsPlan =
    isMember &&
    (planStatus === 'none' ||
      planStatus === 'expired' ||
      planStatus === 'cancelled')

  const [view, setView] = useState<View>('semana')
  const [anchor, setAnchor] = useState(() => new Date())
  const [zoneFilter, setZoneFilter] = useState(params.get('zone') ?? 'all')
  const [msg, setMsg] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // Gate Modal for Members
  const [gateModal, setGateModal] = useState<{
    isOpen: boolean
    type: BookingGateType | null
    zoneName?: string
    message?: string
  }>({
    isOpen: false,
    type: null,
  })

  // Staff Booking Modal
  const [staffModalSession, setStaffModalSession] = useState<Session | null>(null)

  // Days interval based on current view
  const days = useMemo(() => {
    if (view === 'dia') return [anchor]
    if (view === 'semana') {
      const start = startOfWeek(anchor, { weekStartsOn: 1 })
      const end = endOfWeek(anchor, { weekStartsOn: 1 })
      return eachDayOfInterval({ start, end })
    }
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [anchor, view])

  // Week strip days for easy horizontal picker
  const weekStripDays = useMemo(() => {
    const start = startOfWeek(anchor, { weekStartsOn: 1 })
    const end = endOfWeek(anchor, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [anchor])

  // Filtered sessions
  const filtered = useMemo(() => {
    return data.sessions.filter((s) => {
      if (zoneFilter !== 'all') {
        const zone = data.zones.find((z) => z.id === s.zoneId)
        const matchesId = s.zoneId === zoneFilter
        const matchesType = zone?.type === zoneFilter
        const matchesNorm =
          s.zoneId.replace(/[_-]/g, '').toLowerCase() ===
          zoneFilter.replace(/[_-]/g, '').toLowerCase()
        if (!matchesId && !matchesType && !matchesNorm) return false
      }
      const d = parseISO(s.startsAt)
      return days.some((day) => isSameDay(day, d))
    })
  }, [data.sessions, data.zones, zoneFilter, days])

  // Counts per discipline
  const disciplineCounts = useMemo(() => {
    const counts: Record<string, number> = { all: data.sessions.length }
    for (const session of data.sessions) {
      const zone = data.zones.find((z) => z.id === session.zoneId)
      const type = zone?.type ?? session.zoneId
      counts[type] = (counts[type] ?? 0) + 1
      counts[session.zoneId] = (counts[session.zoneId] ?? 0) + 1
    }
    return counts
  }, [data.sessions, data.zones])

  function handleFilterChange(newZone: string) {
    setZoneFilter(newZone)
    setParams(newZone === 'all' ? {} : { zone: newZone })
  }

  function shift(dir: -1 | 1) {
    setAnchor((a) => {
      if (view === 'dia') return addDays(a, dir)
      if (view === 'semana') return addWeeks(a, dir)
      return addMonths(a, dir)
    })
  }

  function jumpToToday() {
    setAnchor(new Date())
  }

  async function onBook(sessionId: string) {
    if (!user) return
    setBusyId(sessionId)
    setMsg('')
    try {
      const session = data.sessions.find((s) => s.id === sessionId)
      if (!session) {
        setMsg('Sesión no encontrada')
        return
      }

      // 1. Membership check
      const membership = selectMyMembership(data, user.id)
      const memCheck = canBookMembership(membership)
      if (!memCheck.allowed) {
        const gateType: BookingGateType =
          memCheck.status === 'none' ? 'no_membership' : 'membership_expired'
        const reason =
          memCheck.status === 'none'
            ? 'Para reservar necesitas un plan activo. Elige tu plan en Mi Plan y actívalo en recepción.'
            : memCheck.status === 'expired' || memCheck.status === 'cancelled'
              ? 'Tu membresía está vencida. Renueva tu plan para volver a reservar.'
              : (memCheck.reason ?? 'No puedes crear nuevas reservas ahora.')
        setGateModal({
          isOpen: true,
          type: gateType,
          message: reason,
        })
        setMsg(reason)
        return
      }

      // 2. Zone check
      const plan = membership
        ? (data.membershipPlans ?? []).find((p) => p.id === membership.planId)
        : null
      const zoneCheck = canBookZone(plan, session.zoneId)
      if (!zoneCheck.allowed) {
        const zone = data.zones.find((z) => z.id === session.zoneId)
        const zoneName = zone ? zone.name : 'esta área'
        const reason = `Tu plan actual no incluye acceso al área ${zoneName}. Consulta en recepción para actualizar tu plan.`
        setGateModal({
          isOpen: true,
          type: 'zone_restricted',
          zoneName,
          message: reason,
        })
        setMsg(reason)
        return
      }

      // 3. Create booking
      const result = await repo.createBooking(sessionId, user.id)
      setMsg(
        'position' in result
          ? `Lista de espera #${result.position}`
          : 'Reserva confirmada',
      )
      await refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo reservar')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agenda Multizona"
        subtitle="9 disciplinas en Zona Cero · Ecuador (UTC-5) · Reservas y Lista de Espera"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Staff Reception Booking Shortcut */}
            {isStaffOrAdmin && data.sessions.length > 0 && (
              <Button
                variant="secondary"
                className="gap-2 border-acc/40 text-acc hover:bg-acc/10"
                onClick={() => setStaffModalSession(data.sessions[0]!)}
              >
                <UserCheck className="h-4 w-4" />
                Reservar por un Socio
              </Button>
            )}

            {/* View Selector Tabs */}
            <div className="flex rounded-2xl border border-line bg-surface p-1">
              {(['dia', 'semana', 'mes'] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                    view === v
                      ? 'bg-acc text-[var(--color-acc-contrast)] shadow-xs'
                      : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {msg ? (
        <div className="rounded-2xl border border-acc/30 bg-acc/10 p-3 text-xs font-bold text-acc">
          {msg}
        </div>
      ) : null}

      {neverHadPlan ? <PlanRequiredNotice /> : null}

      {/* 9 DISCIPLINES FILTER BAR */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-ink-3">
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-acc" />
            Disciplinas Zona Cero (9 Áreas)
          </span>
          <span className="text-[11px] font-normal lowercase text-ink-3">
            {zoneFilter === 'all'
              ? `${data.sessions.length} sesiones totales`
              : `${filtered.length} sesiones filtradas`}
          </span>
        </div>

        {/* Horizontal Chips / Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold transition ${
              zoneFilter === 'all'
                ? 'border-acc bg-acc text-[var(--color-acc-contrast)] shadow-md'
                : 'border-line bg-bg-2 text-ink-2 hover:border-acc/40 hover:bg-surface'
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            <span>Todas</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                zoneFilter === 'all'
                  ? 'bg-black/20 text-[var(--color-acc-contrast)]'
                  : 'bg-surface text-ink-3'
              }`}
            >
              {disciplineCounts.all ?? 0}
            </span>
          </button>

          {Object.entries(ZONA_CERO_DISCIPLINES).map(([typeKey, meta]) => {
            const Icon = meta.icon
            const isSelected =
              zoneFilter === typeKey ||
              zoneFilter === meta.defaultZoneId ||
              zoneFilter === `zone_${typeKey}`
            const count =
              (disciplineCounts[typeKey] ?? 0) +
              (disciplineCounts[meta.defaultZoneId] ?? 0) +
              (disciplineCounts[`zone_${typeKey}`] ?? 0)

            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => handleFilterChange(meta.defaultZoneId)}
                className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold transition ${
                  isSelected
                    ? 'border-acc bg-acc text-[var(--color-acc-contrast)] shadow-md'
                    : 'border-line bg-bg-2 text-ink-2 hover:border-acc/40 hover:bg-surface'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isSelected ? 'text-[var(--color-acc-contrast)]' : meta.colorClass
                  }`}
                />
                <span>{meta.name}</span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      isSelected
                        ? 'bg-black/20 text-[var(--color-acc-contrast)]'
                        : 'bg-surface text-ink-3'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* DATE NAVIGATION & HORIZONTAL DATE PICKER STRIP */}
      <Card className="p-3 bg-bg-2/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => shift(-1)}
              className="h-8 w-8 !p-0"
              title="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              onClick={jumpToToday}
              className="h-8 text-xs font-bold px-3"
            >
              Hoy
            </Button>
            <Button
              variant="secondary"
              onClick={() => shift(1)}
              className="h-8 w-8 !p-0"
              title="Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="ml-2 font-bold capitalize text-ink text-sm">
              {view === 'mes'
                ? format(anchor, 'MMMM yyyy', { locale: es })
                : view === 'dia'
                  ? formatDateSpanish(anchor)
                  : `${format(days[0]!, 'd MMM', { locale: es })} – ${format(
                      days[days.length - 1]!,
                      'd MMM yyyy',
                      { locale: es },
                    )}`}
            </div>
          </div>

          <div className="text-xs text-ink-3 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-acc" />
            Horarios en hora de Ecuador (UTC-5)
          </div>
        </div>

        {/* Date Strip for Quick Day Picking */}
        <div className="mt-3 grid grid-cols-7 gap-1.5 border-t border-line/60 pt-3">
          {weekStripDays.map((day) => {
            const isSelected = isSameDay(day, anchor)
            const isCurrentDay = isToday(day)
            const daySessionsCount = data.sessions.filter((s) =>
              isSameDay(parseISO(s.startsAt), day),
            ).length

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  setAnchor(day)
                  if (view === 'mes') setView('dia')
                }}
                className={`flex flex-col items-center justify-center rounded-2xl py-2 px-1 text-center transition ${
                  isSelected
                    ? 'border border-acc bg-acc/15 text-acc font-black shadow-xs'
                    : isCurrentDay
                      ? 'border border-line bg-surface text-ink font-bold'
                      : 'hover:bg-surface/50 text-ink-3'
                }`}
              >
                <span className="text-[10px] uppercase">
                  {format(day, 'EEE', { locale: es })}
                </span>
                <span className="text-base font-extrabold leading-tight">
                  {format(day, 'd')}
                </span>
                {daySessionsCount > 0 ? (
                  <span
                    className={`mt-0.5 rounded-full px-1.5 text-[9px] font-bold ${
                      isSelected
                        ? 'bg-acc text-[var(--color-acc-contrast)]'
                        : 'bg-surface text-ink-2'
                    }`}
                  >
                    {daySessionsCount}
                  </span>
                ) : (
                  <span className="mt-0.5 text-[9px] text-ink-3/40">-</span>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {/* AGENDA SESSIONS GRID */}
      <div
        className={`grid gap-3 ${
          view === 'mes'
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-7'
            : view === 'semana'
              ? 'grid-cols-1 lg:grid-cols-7'
              : 'grid-cols-1'
        }`}
      >
        {days.map((day) => {
          const daySessions = filtered.filter((s) =>
            isSameDay(parseISO(s.startsAt), day),
          )
          const inMonth = view !== 'mes' || isSameMonth(day, anchor)
          const dayIsToday = isToday(day)

          return (
            <Card
              key={day.toISOString()}
              className={`min-h-32 flex flex-col justify-between ${
                inMonth ? '' : 'opacity-40'
              } ${
                dayIsToday
                  ? 'border-acc/40 bg-gradient-to-b from-acc/5 to-bg-2'
                  : 'bg-bg-2'
              }`}
            >
              <div>
                {/* Day Header */}
                <div className="mb-2.5 flex items-center justify-between border-b border-line pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase text-ink">
                      {format(day, view === 'mes' ? 'd MMMM' : 'EEE d MMM', {
                        locale: es,
                      })}
                    </span>
                    {dayIsToday && (
                      <span className="rounded-md bg-acc px-1.5 py-0.2 text-[9px] font-black text-[var(--color-acc-contrast)]">
                        Hoy
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-ink-3">
                    {daySessions.length} ses.
                  </span>
                </div>

                {/* Day Sessions List */}
                <div className="space-y-2">
                  {daySessions.length === 0 ? (
                    <div className="py-4 text-center text-[11px] text-ink-3/60 italic">
                      Sin sesiones
                    </div>
                  ) : null}

                  {daySessions.slice(0, view === 'mes' ? 3 : 20).map((s) => {
                    const zone = data.zones.find((z) => z.id === s.zoneId)
                    const meta = getDisciplineMeta(zone?.type ?? s.zoneId)
                    const Icon = meta.icon
                    const left = s.capacity - s.bookedCount
                    const isFull = left <= 0
                    const trainer = data.trainers.find(
                      (t) => t.id === s.trainerId,
                    )

                    return (
                      <div
                        key={s.id}
                        className="group rounded-2xl border border-line bg-surface/70 p-2.5 transition hover:border-acc/40 hover:bg-surface"
                      >
                        {/* Title & Icon */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${meta.bgLightClass} ${meta.colorClass}`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-xs font-bold text-ink truncate">
                              {s.title}
                            </span>
                          </div>
                          <Badge
                            tone={isFull ? 'danger' : 'ok'}
                            className="text-[10px] shrink-0"
                          >
                            {s.bookedCount}/{s.capacity}
                          </Badge>
                        </div>

                        {/* Meta info: Time & Discipline */}
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-ink-3">
                          <span className="flex items-center gap-1 font-semibold text-ink-2">
                            <Clock className="h-3 w-3 text-acc" />
                            {formatEcuadorTime(s.startsAt)} -{' '}
                            {formatEcuadorTime(s.endsAt)}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.2 text-[10px] font-bold ${meta.badgeClass}`}
                          >
                            {meta.shortName}
                          </span>
                        </div>

                        {trainer && view !== 'mes' && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-3">
                            <Users className="h-2.5 w-2.5" />
                            <span>{trainer.fullName}</span>
                          </div>
                        )}

                        {/* Actions in Day & Week views */}
                        {view !== 'mes' ? (
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-2">
                            {/* Member standard booking */}
                            {needsPlan ? (
                              <ButtonLink
                                to="/membresia"
                                variant="secondary"
                                className="flex-1 !px-2.5 !py-1 text-[10px] h-7 gap-1 border-acc/40 text-acc hover:bg-acc/10"
                                aria-label={`${neverHadPlan ? 'Activar' : 'Renovar'} plan para reservar ${s.title}`}
                              >
                                <Lock className="h-3 w-3" />
                                {neverHadPlan ? 'Activar plan' : 'Renovar plan'}
                              </ButtonLink>
                            ) : (
                              <Button
                                variant={isFull ? 'secondary' : 'primary'}
                                className="!px-2.5 !py-1 text-[10px] h-7 flex-1"
                                disabled={busyId === s.id}
                                onClick={() => void onBook(s.id)}
                              >
                                {isFull ? 'Lista Espera' : 'Reservar'}
                              </Button>
                            )}

                            {/* Staff Action: Book on behalf of Member */}
                            {isStaffOrAdmin && (
                              <Button
                                variant="secondary"
                                className="!px-2 !py-1 text-[10px] h-7 gap-1 text-acc border-acc/30 hover:bg-acc/10"
                                onClick={() => setStaffModalSession(s)}
                                title="Reservar por un socio en recepción"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Por Socio</span>
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Booking Gate Modal for Members */}
      <BookingGateModal
        isOpen={gateModal.isOpen}
        onClose={() => setGateModal((prev) => ({ ...prev, isOpen: false }))}
        type={gateModal.type}
        zoneName={gateModal.zoneName}
        message={gateModal.message}
      />

      {/* Staff Booking Modal */}
      {staffModalSession && (
        <StaffBookingModal
          isOpen={Boolean(staffModalSession)}
          onClose={() => setStaffModalSession(null)}
          session={staffModalSession}
          onSuccess={() => {
            void refresh()
          }}
        />
      )}
    </div>
  )
}
