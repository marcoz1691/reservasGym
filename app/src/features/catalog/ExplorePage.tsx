import { useMemo, useState } from 'react'
import {
  Clock,
  Filter,
  Grid,
  Lock,
  UserCheck,
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
import { formatEcuadorSessionWhen, formatEcuadorTime } from '@/lib/format'
import { Badge, Button, Card, PageHeader, Spinner } from '@/ui/primitives'
import { ButtonLink } from '@/ui/ButtonLink'
import { BookingGateModal, type BookingGateType } from '@/features/memberships'
import { StaffBookingModal } from '@/features/agenda/StaffBookingModal'

export function ExplorePage() {
  const data = useAppData()
  const user = useCurrentUser()
  const repo = useRepo()
  const refresh = useRefresh()

  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin'
  const isMember = user?.role === 'member'
  const membership = user ? selectMyMembership(data, user.id) : null
  const memberPlan = membership
    ? (data.membershipPlans ?? []).find((p) => p.id === membership.planId)
    : undefined
  const planStatus = canBookMembership(membership).status
  const neverHadPlan = isMember && planStatus === 'none'
  const needsPlan =
    isMember &&
    (planStatus === 'none' ||
      planStatus === 'expired' ||
      planStatus === 'cancelled')

  const [zoneType, setZoneType] = useState('all')
  const [msg, setMsg] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
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

  const selectedAreaBlocked =
    isMember &&
    !!memberPlan &&
    zoneType !== 'all' &&
    !canBookZone(memberPlan, zoneType).allowed

  const sessions = useMemo(() => {
    const now = new Date().toISOString()
    return data.sessions
      .filter((s) => s.startsAt >= now)
      .filter((s) => {
        if (selectedAreaBlocked) return false
        if (isMember && memberPlan && !canBookZone(memberPlan, s.zoneId).allowed) {
          return false
        }
        if (zoneType === 'all') return true
        const z = data.zones.find((x) => x.id === s.zoneId)
        return (
          z?.type === zoneType ||
          s.zoneId === zoneType ||
          s.zoneId.replace(/[_-]/g, '').toLowerCase() ===
            zoneType.replace(/[_-]/g, '').toLowerCase()
        )
      })
      .slice(0, 50)
  }, [data, zoneType, isMember, memberPlan, selectedAreaBlocked])

  async function onBookSession(sessionId: string) {
    if (!user) return
    const alreadyBooked = (data.bookings ?? []).some(
      (item) =>
        item.sessionId === sessionId &&
        item.userId === user.id &&
        (item.status === 'confirmed' ||
          item.status === 'pending' ||
          item.status === 'waitlisted'),
    )
    const alreadyWaiting = (data.waitlist ?? []).some(
      (item) => item.sessionId === sessionId && item.userId === user.id,
    )
    if (alreadyBooked || alreadyWaiting) return
    setBusyId(sessionId)
    setMsg('')

    try {
      const session = data.sessions.find((s) => s.id === sessionId)
      if (!session) {
        setMsg('Sesión no encontrada')
        return
      }

      // 1. Check membership status
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

      // 2. Check zone access rule
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

      // 3. Perform booking
      const result = await repo.createBooking(session.id, user.id)
      setMsg(
        'position' in result
          ? `Lista de espera #${result.position}`
          : 'Reserva confirmada',
      )
      await refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusyId(null)
    }
  }

  if (!user) return <Spinner />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Explorar áreas"
        subtitle="Disciplinas de Zona Cero. Reserva solo las incluidas en tu plan."
      />

      {msg ? (
        <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink-2">
          {msg}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span className="flex items-center gap-1.5 font-medium">
            <Filter className="h-3.5 w-3.5" />
            Disciplinas
          </span>
          <span className="text-[11px]">
            {zoneType === 'all'
              ? `${sessions.length} sesiones`
              : `${sessions.length} en esta área`}
          </span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setZoneType('all')}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              zoneType === 'all'
                ? 'border-acc/40 bg-surface text-ink'
                : 'border-transparent text-ink-2 hover:bg-surface hover:text-ink'
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            <span>Todas</span>
          </button>

          {Object.entries(ZONA_CERO_DISCIPLINES).map(([typeKey, meta]) => {
            const Icon = meta.icon
            const isSelected = zoneType === typeKey || zoneType === meta.defaultZoneId

            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => setZoneType(typeKey)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  isSelected
                    ? 'border-acc/40 bg-surface text-ink'
                    : 'border-transparent text-ink-2 hover:bg-surface hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5 text-ink-3" />
                <span>{meta.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Disciplines Showcase Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.zones
          .filter(
            (z) =>
              zoneType === 'all' ||
              z.type === zoneType ||
              z.id === zoneType ||
              z.id.replace(/[_-]/g, '').toLowerCase() ===
                zoneType.replace(/[_-]/g, '').toLowerCase(),
          )
          .map((z) => {
            const meta = getDisciplineMeta(z.type ?? z.id)
            const Icon = meta.icon
            const included =
              !isMember ||
              needsPlan ||
              !memberPlan ||
              canBookZone(memberPlan, z.id).allowed
            return (
              <Card
                key={z.id}
                className={`flex flex-col justify-between p-4 ${
                  included ? '' : 'opacity-60'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-ink-3" />
                      <div className="font-semibold text-ink">{z.name}</div>
                    </div>
                    {included ? null : (
                      <Badge tone="neutral">No incluida</Badge>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-ink-3">
                    {z.description || meta.description}
                  </p>
                </div>

                <p className="mt-3 text-[11px] text-ink-3">
                  {z.defaultCapacity} cupos
                </p>
              </Card>
            )
          })}
      </div>

      {/* Available Sessions List */}
      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold text-ink">
          Próximas sesiones
        </h2>

        {selectedAreaBlocked && memberPlan ? (
          <Card className="p-8 text-center text-xs text-ink-3">
            Tu plan ({memberPlan.name}) no incluye esta área. Esas clases no se
            pueden reservar.
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="p-8 text-center text-xs text-ink-3">
            No hay sesiones programadas para este filtro en este momento.
          </Card>
        ) : (
          <div className="grid gap-2.5">
            {sessions.map((s) => {
              const zone = data.zones.find((z) => z.id === s.zoneId)
              const meta = getDisciplineMeta(zone?.type ?? s.zoneId)
              const Icon = meta.icon
              const full = s.bookedCount >= s.capacity
              const trainer = data.trainers.find((t) => t.id === s.trainerId)
              const mineReserved = Boolean(
                user &&
                  (data.bookings ?? []).some(
                    (item) =>
                      item.sessionId === s.id &&
                      item.userId === user.id &&
                      (item.status === 'confirmed' || item.status === 'pending'),
                  ),
              )
              const mineWaiting = Boolean(
                user &&
                  ((data.bookings ?? []).some(
                    (item) =>
                      item.sessionId === s.id &&
                      item.userId === user.id &&
                      item.status === 'waitlisted',
                  ) ||
                    (data.waitlist ?? []).some(
                      (item) => item.sessionId === s.id && item.userId === user.id,
                    )),
              )

              return (
                <Card
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-ink-3">
                      <Icon className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {s.title}
                        </span>
                        <span className="text-[11px] text-ink-3">
                          {meta.name}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatEcuadorSessionWhen(s.startsAt)} (
                          {formatEcuadorTime(s.startsAt)} -{' '}
                          {formatEcuadorTime(s.endsAt)})
                        </span>
                        {trainer && <span>· Coach {trainer.fullName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone={full ? 'warn' : 'ok'}>
                      {s.bookedCount}/{s.capacity} cupos
                    </Badge>

                    {/* Member action */}
                    {needsPlan ? (
                      <ButtonLink
                        to="/membresia"
                        variant="secondary"
                        className="text-xs py-1.5 px-3"
                      >
                        {neverHadPlan ? 'Activar plan' : 'Renovar plan'}
                      </ButtonLink>
                    ) : isMember &&
                      memberPlan &&
                      !canBookZone(memberPlan, s.zoneId).allowed ? (
                      <ButtonLink
                        to="/membresia"
                        variant="secondary"
                        className="text-xs py-1.5 px-3 text-ink-3"
                        aria-label={`No incluido en tu plan: ${s.title}`}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        No incluido
                      </ButtonLink>
                    ) : (
                      <Button
                        variant={
                          mineReserved || mineWaiting || full ? 'secondary' : 'primary'
                        }
                        disabled={mineReserved || mineWaiting}
                        isLoading={busyId === s.id}
                        onClick={() => void onBookSession(s.id)}
                        className="text-xs py-1.5 px-3"
                      >
                        {busyId === s.id
                          ? 'Reservando'
                          : mineReserved
                            ? 'Reservado'
                            : mineWaiting
                              ? 'En espera'
                              : full
                                ? 'Lista de espera'
                                : 'Reservar'}
                      </Button>
                    )}

                    {/* Staff action */}
                    {isStaffOrAdmin && (
                      <Button
                        variant="secondary"
                        className="gap-1.5 px-3 py-1.5 text-xs"
                        onClick={() => setStaffModalSession(s)}
                        title="Reservar por un socio en recepción"
                      >
                        <UserCheck className="h-4 w-4" />
                        <span className="hidden sm:inline">Por Socio</span>
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <BookingGateModal
        isOpen={gateModal.isOpen}
        onClose={() => setGateModal((prev) => ({ ...prev, isOpen: false }))}
        type={gateModal.type}
        zoneName={gateModal.zoneName}
        message={gateModal.message}
      />

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
