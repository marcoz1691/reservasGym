import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  CreditCard,
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
            <Link to="/">
              <Button>Volver al inicio</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de Administración"
        subtitle="Gestión comercial, clases, ocupación, áreas y sesiones en Zona Cero"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/check-in">
              <Button variant="secondary" className="gap-2">
                <QrCode className="h-4 w-4" />
                Check-in Recepción
              </Button>
            </Link>
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

      {/* Primary Commercial & Operational Hub Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/admin/cobros" className="group">
          <Card className="h-full border-acc/30 bg-gradient-to-br from-bg-2 to-surface/80 p-5 transition hover:border-acc hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-acc/15 text-acc group-hover:scale-105 transition">
                <CreditCard className="h-6 w-6" />
              </div>
              <Badge tone="ok">Staff & Admin</Badge>
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-black text-ink group-hover:text-acc transition">
                Panel de Cobros POS
              </h3>
              <p className="mt-1 text-xs text-ink-3">
                Registrar cobros en efectivo, transferencia o datáfono POS Datafast, renovaciones y socios por vencer.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-bold text-acc">
              Abrir caja y cobros →
            </div>
          </Card>
        </Link>

        <Link to="/admin/sesiones" className="group">
          <Card className="h-full border-acc/30 bg-gradient-to-br from-bg-2 to-surface/80 p-5 transition hover:border-acc hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-acc/15 text-acc group-hover:scale-105 transition">
                <Calendar className="h-6 w-6" />
              </div>
              <Badge tone="ok">Staff & Admin</Badge>
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-black text-ink group-hover:text-acc transition">
                Gestión de Clases
              </h3>
              <p className="mt-1 text-xs text-ink-3">
                Programar nuevas sesiones, horarios, instructores y cupos de las 9 disciplinas en Zona Cero.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-bold text-acc">
              Administrar clases →
            </div>
          </Card>
        </Link>

        <Link to="/admin/planes" className="group">
          <Card className="h-full border-line bg-gradient-to-br from-bg-2 to-surface/80 p-5 transition hover:border-acc/60 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-ink-2 group-hover:text-acc group-hover:scale-105 transition">
                <Layers className="h-6 w-6" />
              </div>
              <Badge tone="neutral">Admin</Badge>
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-black text-ink group-hover:text-acc transition">
                Gestión de Planes
              </h3>
              <p className="mt-1 text-xs text-ink-3">
                Configuración de tarifas en USD, duraciones en días, cupos de visitas y control de acceso multi-zona.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-bold text-ink-2 group-hover:text-acc transition">
              Administrar planes →
            </div>
          </Card>
        </Link>
      </div>

      {/* Metrics Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-xs font-bold uppercase text-ink-3">Sesiones hoy</div>
          <div className="mt-1 text-3xl font-extrabold">{todaySessions.length}</div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase text-ink-3">Reservas activas</div>
          <div className="mt-1 text-3xl font-extrabold">{confirmed}</div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase text-ink-3">Áreas del Gym</div>
          <div className="mt-1 text-3xl font-extrabold">{data.zones.length}</div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/admin/marca">
          <Button variant="ghost" className="gap-2">
            <Settings className="h-4 w-4" />
            Marca y Colores del Gym
          </Button>
        </Link>
      </div>

      {/* 9 Areas */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Áreas y Disciplinas ({data.zones.length})</h2>
          <Link to="/admin/sesiones">
            <Button variant="ghost" className="text-xs text-acc">
              Ver programación →
            </Button>
          </Link>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.zones.map((z) => {
            const meta = getDisciplineMeta(z.type ?? z.id)
            const Icon = meta.icon
            return (
              <Card key={z.id} className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.bgLightClass} ${meta.colorClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="font-bold text-sm text-ink">{z.name}</div>
                  </div>
                  <Badge tone={meta.tone}>{meta.shortName}</Badge>
                </div>
                <p className="text-xs text-ink-3">{z.description || meta.description}</p>
                <div className="text-[11px] text-ink-3">
                  Cupo base: <strong>{z.defaultCapacity}</strong> personas
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Today's sessions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Sesiones de hoy (Ecuador UTC-5)</h2>
          <Link to="/admin/sesiones">
            <Button variant="ghost" className="text-xs text-acc">
              Gestionar todas las sesiones →
            </Button>
          </Link>
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
                    className="text-xs py-1 px-2.5 h-7 gap-1 text-acc border-acc/30 hover:bg-acc/10"
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
