import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import QRCode from 'qrcode'
import { useAppData, useCurrentUser } from '@/data/RepositoryProvider'
import { Card, PageHeader } from '@/ui/primitives'
import { StaffCheckIn } from './StaffCheckIn'

export function CheckInPage() {
  const user = useCurrentUser()
  const data = useAppData()
  const isStaff = user ? user.role === 'staff' || user.role === 'admin' : false
  const [qrMap, setQrMap] = useState<Record<string, string>>({})

  const memberBookings = useMemo(
    () => {
      if (!user) return []
      return data.bookings
        .filter(
          (b) =>
            b.userId === user.id &&
            (b.status === 'confirmed' || b.status === 'pending'),
        )
        .map((b) => ({
          booking: b,
          session: data.sessions.find((s) => s.id === b.sessionId),
        }))
        .filter((x) => x.session && new Date(x.session.startsAt) >= new Date())
        .sort((a, b) =>
          a.session!.startsAt.localeCompare(b.session!.startsAt),
        )
    },
    [data, user?.id],
  )

  useEffect(() => {
    if (isStaff) return
    let cancelled = false
    void (async () => {
      const next: Record<string, string> = {}
      for (const { booking } of memberBookings) {
        next[booking.id] = await QRCode.toDataURL(booking.checkInCode, {
          margin: 1,
          width: 200,
          color: { dark: '#1C1917', light: '#00000000' },
        })
      }
      if (!cancelled) setQrMap(next)
    })()
    return () => {
      cancelled = true
    }
  }, [isStaff, memberBookings])

  if (isStaff) return <StaffCheckIn />

  return (
    <div>
      <PageHeader title="Check-in" subtitle="Muestra tu QR al llegar a la clase" />
      <div className="space-y-3">
        {memberBookings.length === 0 ? (
          <Card>
            <p className="text-ink-3">No tienes reservas confirmadas próximas.</p>
          </Card>
        ) : (
          memberBookings.map(({ booking, session }) => (
            <Card key={booking.id} className="flex flex-wrap items-center gap-4">
              {qrMap[booking.id] ? (
                <img
                  src={qrMap[booking.id]}
                  alt={`QR ${booking.checkInCode}`}
                  className="h-36 w-36 rounded-2xl bg-white p-2"
                />
              ) : null}
              <div>
                <p className="font-bold">{session!.title}</p>
                <p className="text-sm text-ink-3">
                  {format(parseISO(session!.startsAt), 'EEE d MMM · HH:mm', {
                    locale: es,
                  })}
                </p>
                <p className="mt-2 font-mono text-sm font-bold tracking-wider text-acc-dark">
                  {booking.checkInCode}
                </p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
