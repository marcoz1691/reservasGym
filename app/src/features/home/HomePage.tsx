import { Link } from 'react-router-dom'
import { useAppStore, selectMyBookings } from '@/app/store'
import { formatSessionWhen } from '@/lib/format'
import { Badge, Button, PageHeader } from '@/ui/primitives'

export function HomePage() {
  const user = useAppStore((s) => s.user)!
  const state = useAppStore((s) => s.state)
  const bookings = selectMyBookings(state, user.id)
  const next = bookings
    .filter((b) => b.status === 'confirmed')
    .map((b) => ({
      booking: b,
      session: state?.sessions.find((s) => s.id === b.sessionId),
    }))
    .filter((x) => x.session && new Date(x.session.startsAt) >= new Date())
    .sort((a, b) => a.session!.startsAt.localeCompare(b.session!.startsAt))[0]

  const upcoming = (state?.sessions ?? [])
    .filter((s) => new Date(s.startsAt) >= new Date())
    .slice(0, 5)

  return (
    <div>
      <PageHeader
        title={`Hola, ${user.fullName.split(' ')[0]}`}
        subtitle="Reservas, agenda y check-in · Intermedia"
      />
      {next?.session ? (
        <div className="surface mb-4 border-[var(--color-acc)]/30 p-4">
          <p className="text-xs font-bold uppercase text-[var(--color-acc)]">
            Próxima reserva
          </p>
          <p className="mt-1 text-xl font-bold">{next.session.title}</p>
          <p className="text-sm text-[var(--color-ink-3)]">
            {formatSessionWhen(next.session.startsAt)}
          </p>
          <Link to="/reservas" className="mt-3 inline-block">
            <Button variant="secondary">Ver QR</Button>
          </Link>
        </div>
      ) : (
        <div className="surface mb-4 p-4">
          <p className="font-semibold">Sin reservas próximas</p>
          <div className="mt-3 flex gap-2">
            <Link to="/catalogo">
              <Button>Catálogo</Button>
            </Link>
            <Link to="/agenda">
              <Button variant="secondary">Agenda</Button>
            </Link>
          </div>
        </div>
      )}
      <h2 className="mb-3 text-sm font-bold uppercase text-[var(--color-ink-3)]">
        Próximas sesiones
      </h2>
      <ul className="space-y-2">
        {upcoming.map((s) => (
          <li key={s.id} className="surface flex justify-between gap-3 p-3">
            <div>
              <p className="font-semibold">{s.title}</p>
              <p className="text-xs text-[var(--color-ink-3)]">
                {formatSessionWhen(s.startsAt)}
              </p>
            </div>
            <Badge tone={s.bookedCount >= s.capacity ? 'warn' : 'ok'}>
              {s.bookedCount}/{s.capacity}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}
