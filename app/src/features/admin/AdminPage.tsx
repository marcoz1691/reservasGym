import { useState } from 'react'
import {
  CalendarClock,
  Layers,
  QrCode,
  RotateCcw,
  Settings,
  UserCheck,
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
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Resumen del día"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink to="/check-in" variant="secondary" className="gap-2">
                <QrCode className="h-4 w-4" />
                Check-in Recepción
              </ButtonLink>
            {local ? (
              <Button
                variant="ghost"
                className="gap-2"
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
        }
      />

      {/* En móvil la barra inferior solo tiene 5 pestañas: el resto del admin se abre desde aquí */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden">
        <ButtonLink to="/admin/planes" variant="secondary" className="gap-2">
          <Layers className="h-4 w-4" />
          Planes
        </ButtonLink>
        <ButtonLink to="/admin/sesiones" variant="secondary" className="gap-2">
          <CalendarClock className="h-4 w-4" />
          Sesiones
        </ButtonLink>
        {user?.role === 'admin' ? (
          <ButtonLink to="/admin/marca" variant="secondary" className="gap-2">
            <Settings className="h-4 w-4" />
            Personalización
          </ButtonLink>
        ) : null}
      </div>

      {/* Metrics Stats */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="text-xs font-bold uppercase text-ink-3">Sesiones hoy</div>
          <div className="mt-1 text-3xl font-extrabold">{todaySessions.length}</div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase text-ink-3">Reservas activas</div>
          <div className="mt-1 text-3xl font-extrabold">{confirmed}</div>
        </Card>
      </div>

      {/* Today's sessions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Sesiones de hoy</h2>
          <ButtonLink to="/admin/sesiones" variant="ghost" className="text-xs text-acc-dark">
              Ver todas →
            </ButtonLink>
        </div>

        <div className="grid gap-2">
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

            return (
              <Card
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl ${meta.bgLightClass} ${meta.colorClass}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{s.title}</div>
                    <div className="text-xs text-ink-3">
                      {zone ? zone.name : meta.name} · {formatEcuadorTime(s.startsAt)} - {formatEcuadorTime(s.endsAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge tone={taken >= s.capacity ? 'danger' : 'ok'}>
                    {taken}/{s.capacity}
                  </Badge>

                  <Button
                    variant="secondary"
                    className="text-xs py-1 px-2.5 h-7 gap-1 text-acc-dark border-acc/30 hover:bg-acc/10"
                    onClick={() => setStaffBookingSession(s)}
                    title="Reservar en nombre de un socio"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Reservar socio</span>
                  </Button>
                </div>
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
