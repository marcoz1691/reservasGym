import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  Layers,
  QrCode,
  RotateCcw,
  Settings,
  UserCheck,
  Users,
} from 'lucide-react'
import {
  useAppData,
  useCurrentUser,
  useLocalRepo,
  useRefresh,
} from '@/data/RepositoryProvider'
import type { Session } from '@/domain/models'
import { seatsTaken } from '@/domain/rules'
import { getDisciplineMeta } from '@/domain/disciplines'
import { ecuadorTodayYmd, formatEcuadorTime } from '@/lib/format'
import { Badge, Button, Card, EmptyState, PageHeader } from '@/ui/primitives'
import { ButtonLink } from '@/ui/ButtonLink'
import { StaffBookingModal } from '@/features/agenda/StaffBookingModal'

export function AdminPage() {
  const user = useCurrentUser()
  const data = useAppData()
  const local = useLocalRepo()
  const refresh = useRefresh()
  const today = ecuadorTodayYmd()
  const todaySessions = data.sessions.filter(
    (s) => ecuadorTodayYmd(s.startsAt) === today,
  )
  const confirmed = data.bookings.filter((b) => b.status === 'confirmed').length

  const [staffBookingSession, setStaffBookingSession] = useState<Session | null>(null)

  if (user && user.role === 'member') {
    return (
      <div className="py-12 text-center">
        <EmptyState
          title="Acceso restringido"
          description="Este módulo es exclusivo para el equipo de staff y administradores de Zona Cero."
          action={
            <ButtonLink to="/">Volver al inicio</ButtonLink>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" subtitle="Resumen del día" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ButtonLink to="/check-in" variant="primary" size="lg" className="w-full gap-2 sm:w-auto">
          <QrCode className="h-5 w-5" />
          Check-in Recepción
        </ButtonLink>
        {local ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 self-start sm:self-auto"
            onClick={() => {
              local.resetDemo()
              void refresh()
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset demo
          </Button>
        ) : null}
      </div>

      {/* En móvil la barra inferior solo tiene 5 pestañas: el resto del admin se abre desde aquí */}
      <div className="grid grid-cols-3 gap-2 lg:hidden">
        {[
          { to: '/admin/planes', label: 'Planes', icon: Layers, show: true },
          { to: '/admin/sesiones', label: 'Sesiones', icon: CalendarClock, show: true },
          { to: '/admin/marca', label: 'Personalización', icon: Settings, show: user?.role === 'admin' },
        ]
          .filter((item) => item.show)
          .map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="focus-ring flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface-elevated px-2 py-3 text-center text-xs font-bold text-ink transition active:scale-[0.97]"
            >
              <Icon className="h-5 w-5 text-acc-dark" aria-hidden />
              {label}
            </Link>
          ))}
      </div>

      {/* Metrics Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-acc-soft text-acc-dark">
            <CalendarClock className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-none">{todaySessions.length}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-ink-3">
              Sesiones hoy
            </div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-acc-soft text-acc-dark">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-none">{confirmed}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-ink-3">
              Reservas activas
            </div>
          </div>
        </Card>
      </div>

      {/* Today's sessions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Sesiones de hoy</h2>
          <ButtonLink to="/admin/sesiones" variant="ghost" size="sm" className="text-acc-dark">
            Ver todas →
          </ButtonLink>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {todaySessions.length === 0 ? (
            <Card>
              <p className="text-ink-3">No hay sesiones programadas hoy.</p>
            </Card>
          ) : null}
          {todaySessions.map((s) => {
            const taken = seatsTaken(data.bookings, s.id)
            const zone = data.zones.find((z) => z.id === s.zoneId)
            const meta = getDisciplineMeta(zone?.type ?? s.zoneId)
            const Icon = meta.icon
            const full = taken >= s.capacity
            const pct = s.capacity > 0 ? Math.min(100, Math.round((taken / s.capacity) * 100)) : 0

            return (
              <Card key={s.id} className="space-y-3 p-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-bg py-2">
                    <span className="text-base font-extrabold leading-none">
                      {formatEcuadorTime(s.startsAt)}
                    </span>
                    <span className="mt-1 text-[10px] font-semibold text-ink-3">
                      a {formatEcuadorTime(s.endsAt)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-sm">{s.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg ${meta.bgLightClass} ${meta.colorClass}`}
                      >
                        <Icon className="h-3 w-3" aria-hidden />
                      </span>
                      <span className="truncate">{zone ? zone.name : meta.name}</span>
                    </div>
                  </div>

                  <Badge tone={full ? 'danger' : 'ok'}>
                    {taken}/{s.capacity}
                  </Badge>
                </div>

                <div
                  className="h-1.5 overflow-hidden rounded-full bg-bg"
                  role="progressbar"
                  aria-valuenow={taken}
                  aria-valuemin={0}
                  aria-valuemax={s.capacity}
                  aria-label={`Cupos ocupados de ${s.title}`}
                >
                  <div
                    className={`h-full rounded-full ${full ? 'bg-danger' : 'bg-acc'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full gap-1.5 text-acc-dark"
                  onClick={() => setStaffBookingSession(s)}
                  title="Reservar en nombre de un socio"
                >
                  <UserCheck className="h-4 w-4" />
                  Reservar socio
                </Button>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Staff Booking Modal */}
      {staffBookingSession && (
        <StaffBookingModal
          isOpen={Boolean(staffBookingSession)}
          onClose={() => setStaffBookingSession(null)}
          session={staffBookingSession}
          onSuccess={() => {
            void refresh()
          }}
        />
      )}
    </div>
  )
}
