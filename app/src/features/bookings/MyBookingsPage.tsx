import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import QRCode from 'qrcode'
import {
  useAppData,
  useCurrentUser,
  useRefresh,
  useRepo,
} from '@/data/RepositoryProvider'
import { ZONE_LABELS } from '@/domain/models'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
} from '@/ui/primitives'

export function MyBookingsPage() {
  const user = useCurrentUser()!
  const data = useAppData()
  const repo = useRepo()
  const refresh = useRefresh()
  const [msg, setMsg] = useState('')
  const [qrMap, setQrMap] = useState<Record<string, string>>({})
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [newSessionId, setNewSessionId] = useState('')

  const mine = useMemo(
    () =>
      data.bookings
        .filter((b) => b.userId === user.id && b.status !== 'cancelled')
        .map((b) => ({
          booking: b,
          session: data.sessions.find((s) => s.id === b.sessionId),
          zone: data.zones.find(
            (z) =>
              z.id ===
              data.sessions.find((s) => s.id === b.sessionId)?.zoneId,
          ),
        }))
        .sort((a, b) =>
          (a.session?.startsAt ?? '').localeCompare(b.session?.startsAt ?? ''),
        ),
    [data, user.id],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next: Record<string, string> = {}
      for (const { booking } of mine) {
        if (booking.status !== 'confirmed' && booking.status !== 'pending') {
          continue
        }
        next[booking.id] = await QRCode.toDataURL(booking.checkInCode, {
          margin: 1,
          width: 160,
          color: { dark: '#1C1917', light: '#00000000' },
        })
      }
      if (!cancelled) setQrMap(next)
    })()
    return () => {
      cancelled = true
    }
  }, [mine])

  const altSessions = useMemo(() => {
    const now = new Date().toISOString()
    return data.sessions
      .filter((s) => s.startsAt >= now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 60)
  }, [data.sessions])

  return (
    <div>
      <PageHeader
        title="Mis reservas"
        subtitle="Cancelar, reagendar y mostrar QR de check-in"
      />
      {msg ? <p className="mb-3 text-sm text-acc">{msg}</p> : null}

      {mine.length === 0 ? (
        <EmptyState
          title="Sin reservas"
          description="Explora el catálogo o la agenda para reservar una clase."
        />
      ) : (
        <div className="space-y-3">
          {mine.map(({ booking, session, zone }) => (
            <Card key={booking.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{session?.title ?? 'Sesión'}</p>
                  <p className="text-sm text-ink-3">
                    {zone ? ZONE_LABELS[zone.type] : ''}
                    {session
                      ? ` · ${format(parseISO(session.startsAt), "EEE d MMM · HH:mm", { locale: es })}`
                      : ''}
                  </p>
                </div>
                <Badge
                  tone={
                    booking.status === 'confirmed'
                      ? 'ok'
                      : booking.status === 'waitlisted'
                        ? 'warn'
                        : 'neutral'
                  }
                >
                  {booking.status}
                </Badge>
              </div>

              {qrMap[booking.id] ? (
                <div className="flex flex-wrap items-center gap-4">
                  <img
                    src={qrMap[booking.id]}
                    alt={`QR ${booking.checkInCode}`}
                    className="h-28 w-28 rounded-2xl bg-white p-2"
                  />
                  <div>
                    <p className="text-xs font-bold uppercase text-ink-3">
                      Código check-in
                    </p>
                    <p className="font-mono text-lg font-bold tracking-wider">
                      {booking.checkInCode}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {(booking.status === 'confirmed' ||
                  booking.status === 'pending' ||
                  booking.status === 'waitlisted') && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      void (async () => {
                        try {
                          await repo.cancelBooking(booking.id)
                          await refresh()
                          setMsg('Reserva cancelada')
                        } catch (e) {
                          setMsg(e instanceof Error ? e.message : 'Error')
                        }
                      })()
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                {(booking.status === 'confirmed' ||
                  booking.status === 'pending') && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRescheduleId(booking.id)
                      setNewSessionId('')
                    }}
                  >
                    Reagendar
                  </Button>
                )}
              </div>

              {rescheduleId === booking.id ? (
                <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                  <Select
                    label="Nueva sesión"
                    className="min-w-[220px] flex-1"
                    value={newSessionId}
                    onChange={(e) => setNewSessionId(e.target.value)}
                  >
                    <option value="">Elegir…</option>
                    {altSessions
                      .filter((s) => s.id !== booking.sessionId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ·{' '}
                          {format(parseISO(s.startsAt), 'EEE d HH:mm', {
                            locale: es,
                          })}
                        </option>
                      ))}
                  </Select>
                  <Button
                    disabled={!newSessionId}
                    onClick={() => {
                      void (async () => {
                        try {
                          await repo.rescheduleBooking(
                            booking.id,
                            newSessionId,
                          )
                          setRescheduleId(null)
                          await refresh()
                          setMsg('Reserva reagendada')
                        } catch (e) {
                          setMsg(e instanceof Error ? e.message : 'Error')
                        }
                      })()
                    }}
                  >
                    Confirmar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setRescheduleId(null)}
                  >
                    Cerrar
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
