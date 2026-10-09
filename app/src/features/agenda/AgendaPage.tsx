import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Lock, UserCheck } from 'lucide-react'
import {
  useAppData,
  useCurrentUser,
  useRefresh,
  useRepo,
} from '@/data/RepositoryProvider'
import type { Booking, Session, WaitlistEntry } from '@/domain/models'
import { selectMyDayPassPlans, selectMyMembership } from '@/app/store'
import { canAccessZone, canBookMembership, canBookZone, isFeatureEnabled } from '@/domain/rules'
import { getDisciplineMeta, ZONA_CERO_DISCIPLINES } from '@/domain/disciplines'
import { ecuadorTodayYmd, formatDateSpanish, formatEcuadorTime } from '@/lib/format'
import {
  nextOpenDayYmd,
  sessionStillOpen,
  shiftYmd,
  weekYmds,
} from './agendaSchedule'
import { Button, PageHeader } from '@/ui/primitives'
import { ButtonLink } from '@/ui/ButtonLink'
import { BookingGateModal, type BookingGateType } from '@/features/memberships'
import { StaffBookingModal } from './StaffBookingModal'

const ACTIVE_BOOKING = new Set(['confirmed', 'pending', 'waitlisted'])

function mineOnSession(
  bookings: Booking[],
  waitlist: WaitlistEntry[],
  userId: string,
  sessionId: string,
): { booking?: Booking; wait?: WaitlistEntry } {
  const booking = bookings.find(
    (item) =>
      item.sessionId === sessionId &&
      item.userId === userId &&
      ACTIVE_BOOKING.has(item.status),
  )
  const wait = waitlist.find(
    (item) => item.sessionId === sessionId && item.userId === userId,
  )
  return { booking, wait }
}

export function AgendaPage() {
  const data = useAppData()
  const waitlistOn = isFeatureEnabled(data.settings, 'waitlist')
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
  const passPlans = useMemo(
    () => (user ? selectMyDayPassPlans(data, user.id) : []),
    [data, user],
  )
  const planStatus = useMemo(
    () => canBookMembership(membership).status,
    [membership],
  )
  const neverHadPlan = isMember && planStatus === 'none' && passPlans.length === 0
  const needsPlan =
    isMember &&
    passPlans.length === 0 &&
    (planStatus === 'none' ||
      planStatus === 'expired' ||
      planStatus === 'cancelled')
  const memberPlan = membership
    ? (data.membershipPlans ?? []).find((p) => p.id === membership.planId)
    : undefined
  const filtersByAccess = isMember && (!!memberPlan || passPlans.length > 0)

  // ?dia=YYYY-MM-DD&sesion=<id>: viene de Inicio, abre ese día y resalta la clase (ZCAPP-58)
  const [anchorYmd, setAnchorYmd] = useState(() => {
    const day = params.get('dia')
    return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : ecuadorTodayYmd()
  })
  const focusSessionId = params.get('sesion')
  const scrolledToFocus = useRef(false)
  useEffect(() => {
    if (!focusSessionId || scrolledToFocus.current) return
    const row = document.getElementById(`sesion-${focusSessionId}`)
    if (!row) return
    scrolledToFocus.current = true
    row.scrollIntoView?.({ block: 'center' })
  })
  const [zoneFilter, setZoneFilter] = useState(params.get('zone') ?? 'all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ sessionId: string; message: string } | null>(
    null,
  )

  const [gateModal, setGateModal] = useState<{
    isOpen: boolean
    type: BookingGateType | null
    zoneName?: string
    message?: string
  }>({
    isOpen: false,
    type: null,
  })
  const [staffModalSession, setStaffModalSession] = useState<Session | null>(null)

  const todayYmd = ecuadorTodayYmd()
  const weekStrip = useMemo(() => weekYmds(anchorYmd), [anchorYmd])

  function matchesZone(session: Session): boolean {
    if (zoneFilter === 'all') return true
    const zone = data.zones.find((item) => item.id === session.zoneId)
    return (
      session.zoneId === zoneFilter ||
      zone?.type === zoneFilter ||
      session.zoneId.replace(/[_-]/g, '').toLowerCase() ===
        zoneFilter.replace(/[_-]/g, '').toLowerCase()
    )
  }

  const selectedAreaBlocked =
    filtersByAccess &&
    zoneFilter !== 'all' &&
    !canAccessZone(memberPlan, passPlans, zoneFilter)

  const daySessions = useMemo(() => {
    return data.sessions
      .filter((session) => {
        if (ecuadorTodayYmd(session.startsAt) !== anchorYmd) return false
        if (!sessionStillOpen(session.endsAt)) return false
        if (!matchesZone(session)) return false
        if (selectedAreaBlocked) return false
        if (filtersByAccess && zoneFilter === 'all') {
          return canAccessZone(memberPlan, passPlans, session.zoneId)
        }
        return true
      })
      .sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )
  }, [
    data.sessions,
    data.zones,
    zoneFilter,
    anchorYmd,
    filtersByAccess,
    memberPlan,
    passPlans,
    selectedAreaBlocked,
  ])

  const nextOpenDay = useMemo(() => {
    const visible = data.sessions.filter((session) => {
      if (!matchesZone(session)) return false
      if (selectedAreaBlocked) return false
      if (filtersByAccess && zoneFilter === 'all') {
        return canAccessZone(memberPlan, passPlans, session.zoneId)
      }
      return true
    })
    return nextOpenDayYmd(visible, anchorYmd)
  }, [
    data.sessions,
    data.zones,
    zoneFilter,
    anchorYmd,
    filtersByAccess,
    memberPlan,
    passPlans,
    selectedAreaBlocked,
  ])

  function handleFilterChange(newZone: string) {
    setZoneFilter(newZone)
    setParams(newZone === 'all' ? {} : { zone: newZone })
  }

  async function onBook(sessionId: string) {
    if (!user) return
    const already = mineOnSession(
      data.bookings ?? [],
      data.waitlist ?? [],
      user.id,
      sessionId,
    )
    if (already.booking || already.wait) return

    setBusyId(sessionId)
    setRowError(null)
    try {
      const session = data.sessions.find((item) => item.id === sessionId)
      if (!session) {
        setRowError({ sessionId, message: 'Sesión no encontrada' })
        return
      }

      const currentMembership = selectMyMembership(data, user.id)
      const coveringPasses = selectMyDayPassPlans(data, user.id, new Date(), session.startsAt)
      if (coveringPasses.some((pass) => canBookZone(pass, session.zoneId).allowed)) {
        await repo.createBooking(sessionId, user.id)
        await refresh()
        return
      }
      const memCheck = canBookMembership(currentMembership)
      if (!memCheck.allowed) {
        const gateType: BookingGateType =
          memCheck.status === 'none' ? 'no_membership' : 'membership_expired'
        const reason =
          memCheck.status === 'none'
            ? 'Para reservar necesitas un plan activo. Elige tu plan en Mi Plan y actívalo en recepción.'
            : memCheck.status === 'expired' || memCheck.status === 'cancelled'
              ? 'Tu membresía está vencida. Renueva tu plan para volver a reservar.'
              : (memCheck.reason ?? 'No puedes crear nuevas reservas ahora.')
        setGateModal({ isOpen: true, type: gateType, message: reason })
        setRowError({ sessionId, message: reason })
        return
      }

      const plan = currentMembership
        ? (data.membershipPlans ?? []).find((p) => p.id === currentMembership.planId)
        : null
      const zoneCheck = canBookZone(plan, session.zoneId)
      if (!zoneCheck.allowed) {
        const zone = data.zones.find((item) => item.id === session.zoneId)
        const zoneName = zone ? zone.name : 'esta área'
        const reason = `Tu plan actual no incluye acceso al área ${zoneName}. Consulta en recepción para actualizar tu plan.`
        setGateModal({
          isOpen: true,
          type: 'zone_restricted',
          zoneName,
          message: reason,
        })
        setRowError({ sessionId, message: reason })
        return
      }

      await repo.createBooking(sessionId, user.id)
      await refresh()
    } catch (error) {
      setRowError({
        sessionId,
        message: error instanceof Error ? error.message : 'No se pudo reservar',
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader
        title="Reservar clase"
        subtitle={`${formatDateSpanish(`${anchorYmd}T12:00:00-05:00`)}. Aquí apartas el cupo. Lo que ya tomaste está en Mis clases.`}
      />

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => setAnchorYmd((day) => shiftYmd(day, -7))}
          className="h-9 w-9 !p-0"
          title="Semana anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
          {weekStrip.map((ymd) => {
            const selected = ymd === anchorYmd
            const today = ymd === todayYmd
            const labelDate = new Date(`${ymd}T12:00:00-05:00`)
            const weekday = new Intl.DateTimeFormat('es-EC', {
              timeZone: 'America/Guayaquil',
              weekday: 'short',
            }).format(labelDate)
            const dayNumber = new Intl.DateTimeFormat('es-EC', {
              timeZone: 'America/Guayaquil',
              day: 'numeric',
            }).format(labelDate)
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => setAnchorYmd(ymd)}
                className={`flex flex-col items-center rounded-2xl py-2 text-center transition ${
                  selected
                    ? 'bg-cta text-cta-contrast'
                    : today
                      ? 'border border-line bg-surface text-ink'
                      : 'text-ink-3'
                }`}
              >
                <span className="text-[11px] font-bold uppercase">
                  {today ? 'Hoy' : weekday}
                </span>
                <span className="text-sm font-extrabold leading-none">
                  {dayNumber}
                </span>
              </button>
            )
          })}
        </div>
        <Button
          variant="secondary"
          onClick={() => setAnchorYmd((day) => shiftYmd(day, 7))}
          className="h-9 w-9 !p-0"
          title="Semana siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => handleFilterChange('all')}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
            zoneFilter === 'all'
              ? 'bg-cta text-cta-contrast'
              : 'border border-line text-ink-2'
          }`}
        >
          Todas
        </button>
        {Object.entries(ZONA_CERO_DISCIPLINES).map(([typeKey, meta]) => {
          const selected =
            zoneFilter === typeKey ||
            zoneFilter === meta.defaultZoneId ||
            zoneFilter === `zone_${typeKey}`
          return (
            <button
              key={typeKey}
              type="button"
              onClick={() => handleFilterChange(meta.defaultZoneId)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                selected
                  ? 'bg-cta text-cta-contrast'
                  : 'border border-line text-ink-2'
              }`}
            >
              {meta.name}
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        {selectedAreaBlocked ? (
          <p className="py-10 text-center text-sm text-ink-3">
            {memberPlan ? `Tu plan (${memberPlan.name})` : 'Tu pase del día'} no incluye esta
            área. Esas clases no se pueden reservar.
          </p>
        ) : null}

        {!selectedAreaBlocked && daySessions.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-ink-3">No hay clases abiertas este día.</p>
            {nextOpenDay ? (
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => setAnchorYmd(nextOpenDay)}
              >
                Ver{' '}
                {formatDateSpanish(`${nextOpenDay}T12:00:00-05:00`)}
              </Button>
            ) : (
              <p className="mt-2 text-sm text-ink-3">
                No hay clases próximas para reservar.
              </p>
            )}
          </div>
        ) : null}

        {daySessions.map((session) => {
          const zone = data.zones.find((item) => item.id === session.zoneId)
          const trainer = data.trainers.find((item) => item.id === session.trainerId)
          const meta = getDisciplineMeta(zone?.type ?? session.zoneId)
          const full = session.capacity - session.bookedCount <= 0
          const mine = user
            ? mineOnSession(
                data.bookings ?? [],
                data.waitlist ?? [],
                user.id,
                session.id,
              )
            : {}
          const reserved = Boolean(mine.booking && mine.booking.status !== 'waitlisted')
          const waiting = mine.booking?.status === 'waitlisted' || Boolean(mine.wait)
          const waitPosition = mine.wait?.position
          const error = rowError?.sessionId === session.id ? rowError.message : null
          const busy = busyId === session.id
          const zoneBlocked =
            filtersByAccess && !canAccessZone(memberPlan, passPlans, session.zoneId)

          let action: { label: string; disabled: boolean; loading: boolean } = {
            label: full ? (waitlistOn ? 'Lista de espera' : 'Clase llena') : 'Reservar',
            disabled: full && !waitlistOn,
            loading: false,
          }
          if (busy) {
            action = { label: 'Reservando', disabled: true, loading: true }
          } else if (reserved) {
            action = { label: 'Reservado', disabled: true, loading: false }
          } else if (waiting) {
            action = {
              label: waitPosition ? `En espera #${waitPosition}` : 'En espera',
              disabled: true,
              loading: false,
            }
          }

          return (
            <div
              key={session.id}
              id={`sesion-${session.id}`}
              aria-current={session.id === focusSessionId ? 'true' : undefined}
              className={`rounded-2xl border bg-surface px-3 py-3 ${
                session.id === focusSessionId ? 'border-acc ring-2 ring-acc/30' : 'border-line'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 shrink-0 text-sm font-extrabold text-ink">
                  {formatEcuadorTime(session.startsAt)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{session.title}</p>
                  <p className="truncate text-xs text-ink-3">
                    {session.bookedCount}/{session.capacity}
                    {trainer ? ` · ${trainer.fullName}` : ''}
                    {meta.shortName ? ` · ${meta.shortName}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {needsPlan ? (
                    <ButtonLink
                      to="/membresia"
                      variant="secondary"
                      size="sm"
                      aria-label={`${neverHadPlan ? 'Activar' : 'Renovar'} plan para reservar ${session.title}`}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {neverHadPlan ? 'Activar plan' : 'Renovar plan'}
                    </ButtonLink>
                  ) : zoneBlocked ? (
                    <ButtonLink
                      to="/membresia"
                      variant="secondary"
                      size="sm"
                      aria-label={`No incluido en tu plan: ${session.title}`}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      No incluido
                    </ButtonLink>
                  ) : (
                    <Button
                      variant={reserved || waiting ? 'secondary' : full ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={action.disabled}
                      isLoading={action.loading}
                      onClick={() => void onBook(session.id)}
                      aria-label={`${action.label} ${session.title}`}
                    >
                      {action.label}
                    </Button>
                  )}
                  {isStaffOrAdmin ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setStaffModalSession(session)}
                      title="Reservar por un socio en recepción"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Por socio</span>
                    </Button>
                  ) : null}
                </div>
              </div>
              {error ? (
                <p className="mt-2 text-xs text-danger" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>

      <BookingGateModal
        isOpen={gateModal.isOpen}
        onClose={() => setGateModal((prev) => ({ ...prev, isOpen: false }))}
        type={gateModal.type}
        zoneName={gateModal.zoneName}
        message={gateModal.message}
      />

      {staffModalSession ? (
        <StaffBookingModal
          isOpen={Boolean(staffModalSession)}
          onClose={() => setStaffModalSession(null)}
          session={staffModalSession}
          onSuccess={() => {
            void refresh()
          }}
        />
      ) : null}
    </div>
  )
}
