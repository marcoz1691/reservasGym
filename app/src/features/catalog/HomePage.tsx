import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { useAppData, useCurrentUser } from '@/data/RepositoryProvider'
import { ZONE_LABELS } from '@/domain/models'
import { Badge, Button, Card, PageHeader } from '@/ui/primitives'

export function HomePage() {
  const user = useCurrentUser()!
  const data = useAppData()
  const mine = data.bookings.filter(
    (b) =>
      b.userId === user.id &&
      (b.status === 'confirmed' || b.status === 'waitlisted'),
  )
  const next = mine
    .map((b) => ({
      booking: b,
      session: data.sessions.find((s) => s.id === b.sessionId),
    }))
    .filter((x) => x.session && new Date(x.session.startsAt) >= new Date())
    .sort((a, b) => a.session!.startsAt.localeCompare(b.session!.startsAt))[0]

  const upcoming = data.sessions
    .filter((s) => new Date(s.startsAt) >= new Date())
    .slice(0, 4)

  const lastWeight = data.measurements
    .filter((m) => m.userId === user.id)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0]

  return (
    <div>
      <PageHeader
        title={`Hola, ${user.fullName.split(' ')[0]}`}
        subtitle="Reserva clases, agenda y control de peso"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-xs font-bold uppercase text-ink-3">Activas</div>
          <div className="mt-1 text-3xl font-extrabold">{mine.length}</div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase text-ink-3">Áreas</div>
          <div className="mt-1 text-3xl font-extrabold">{data.zones.length}</div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase text-ink-3">Peso</div>
          <div className="mt-1 text-3xl font-extrabold">
            {lastWeight ? `${lastWeight.weightKg} kg` : '—'}
          </div>
        </Card>
      </div>

      {next?.session ? (
        <Card className="mb-4 border-acc/30 bg-gradient-to-br from-acc/15 to-transparent">
          <div className="text-xs font-extrabold uppercase tracking-wider text-acc">
            Tu próxima clase
          </div>
          <div className="mt-2 text-xl font-extrabold">{next.session.title}</div>
          <div className="mt-1 text-sm text-ink-3">
            {format(parseISO(next.session.startsAt), "EEEE d MMM · HH:mm", {
              locale: es,
            })}
          </div>
          <Link to="/reservas" className="mt-3 inline-block">
            <Button variant="secondary">Ver reservas</Button>
          </Link>
        </Card>
      ) : (
        <Card className="mb-4">
          <p className="text-ink-3">
            Sin reservas próximas.{' '}
            <Link to="/explorar" className="text-acc underline">
              Explorar áreas
            </Link>
          </p>
        </Card>
      )}

      <h2 className="mb-3 text-lg font-bold">Próximas sesiones</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {upcoming.map((s) => {
          const zone = data.zones.find((z) => z.id === s.zoneId)
          return (
            <Link key={s.id} to="/agenda">
              <Card className="transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-ink-3">
                      {zone ? ZONE_LABELS[zone.type] : 'Área'}
                    </p>
                    <p className="mt-1 font-bold">{s.title}</p>
                    <p className="text-sm text-ink-3">
                      {format(parseISO(s.startsAt), "EEE d MMM · HH:mm", {
                        locale: es,
                      })}
                    </p>
                  </div>
                  <Badge
                    tone={s.bookedCount >= s.capacity ? 'danger' : 'ok'}
                  >
                    {s.bookedCount}/{s.capacity}
                  </Badge>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
