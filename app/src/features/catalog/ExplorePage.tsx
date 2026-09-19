import { useMemo, useState } from 'react'
import {
  Clock,
  Filter,
  Grid,
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
import { Badge, Button, Card, PageHeader, Select } from '@/ui/primitives'
import { BookingGateModal, type BookingGateType } from '@/features/memberships'
import { StaffBookingModal } from '@/features/agenda/StaffBookingModal'

export function ExplorePage() {
  const data = useAppData()
  const user = useCurrentUser()!
  const repo = useRepo()
  const refresh = useRefresh()

  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin'

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

  const sessions = useMemo(() => {
    const now = new Date().toISOString()
    return data.sessions
      .filter((s) => s.startsAt >= now)
      .filter((s) => {
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
  }, [data, zoneType])

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

  async function onBookSession(sessionId: string) {
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
          'No puedes crear nuevas reservas: Tu membresía está vencida. Acércate a recepción.'
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Explorar Disciplinas"
        subtitle="Las 9 disciplinas oficiales de Zona Cero Performance Center (Ecuador UTC-5)"
      />

      {msg ? (
        <div className="rounded-2xl border border-acc/30 bg-acc/10 p-3 text-xs font-bold text-acc">
          {msg}
        </div>
      ) : null}

      {/* 9 DISCIPLINES FILTER CHIPS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-ink-3">
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-acc" />
            Filtrar por Disciplina
          </span>
          <span className="text-[11px] font-normal lowercase text-ink-3">
            {zoneType === 'all'
              ? `${sessions.length} sesiones disponibles`
              : `${sessions.length} en categoría`}
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setZoneType('all')}
            className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold transition ${
              zoneType === 'all'
                ? 'border-acc bg-acc text-[var(--color-acc-contrast)] shadow-md'
                : 'border-line bg-bg-2 text-ink-2 hover:border-acc/40 hover:bg-surface'
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            <span>Todas</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                zoneType === 'all'
                  ? 'bg-black/20 text-[var(--color-acc-contrast)]'
                  : 'bg-surface text-ink-3'
              }`}
            >
              {disciplineCounts.all ?? 0}
            </span>
          </button>

          {Object.entries(ZONA_CERO_DISCIPLINES).map(([typeKey, meta]) => {
            const Icon = meta.icon
            const isSelected = zoneType === typeKey || zoneType === meta.defaultZoneId
            const count =
              (disciplineCounts[typeKey] ?? 0) +
              (disciplineCounts[meta.defaultZoneId] ?? 0) +
              (disciplineCounts[`zone_${typeKey}`] ?? 0)

            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => setZoneType(typeKey)}
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

      {/* Fallback Dropdown for Mobile / Accessibility */}
      <Select
        label="Seleccionar Área"
        className="max-w-sm sm:hidden"
        value={zoneType}
        onChange={(e) => setZoneType(e.target.value)}
      >
        <option value="all">Todas las 9 Disciplinas</option>
        {Object.entries(ZONA_CERO_DISCIPLINES).map(([t, meta]) => (
          <option key={t} value={t}>
            {meta.name}
          </option>
        ))}
      </Select>

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
            return (
              <Card
                key={z.id}
                className="flex flex-col justify-between border-line bg-bg-2 p-4 transition hover:border-acc/40"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${meta.bgLightClass} ${meta.colorClass}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="font-extrabold text-ink">{z.name}</div>
                    </div>
                    <Badge tone={meta.tone}>{meta.shortName}</Badge>
                  </div>
                  <p className="text-xs text-ink-3">
                    {z.description || meta.description}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-[11px] text-ink-3">
                  <span>Capacidad base:</span>
                  <span className="font-bold text-ink-2">
                    {z.defaultCapacity} cupos
                  </span>
                </div>
              </Card>
            )
          })}
      </div>

      {/* Available Sessions List */}
      <div className="space-y-3">
        <h2 className="text-lg font-black text-ink">
          Próximas Sesiones Programadas
        </h2>

        {sessions.length === 0 ? (
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

              return (
                <Card
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 bg-bg-2 transition hover:border-acc/40"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.bgLightClass} ${meta.colorClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-ink text-sm">
                          {s.title}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.2 text-[10px] font-bold ${meta.badgeClass}`}
                        >
                          {meta.name}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                        <span className="flex items-center gap-1 font-medium text-ink-2">
                          <Clock className="h-3 w-3 text-acc" />
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
                    <Button
                      variant={full ? 'secondary' : 'primary'}
                      disabled={busyId === s.id}
                      onClick={() => void onBookSession(s.id)}
                      className="text-xs py-1.5 px-3"
                    >
                      {full ? 'Lista de espera' : 'Reservar'}
                    </Button>

                    {/* Staff action */}
                    {isStaffOrAdmin && (
                      <Button
                        variant="secondary"
                        className="text-xs py-1.5 px-3 gap-1.5 text-acc border-acc/30 hover:bg-acc/10"
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
