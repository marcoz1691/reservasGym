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
import { selectMyMembership } from '@/app/store'
import {
  computeMembershipStatus,
  GRACE_PERIOD_DAYS,
} from '@/domain/rules/membership'
import type { Membership } from '@/domain/models'
import { Badge, Button, Card, Input, PageHeader } from '@/ui/primitives'

export function getMemberMembershipChip(
  membership: Membership | null | undefined,
  now: Date = new Date(),
): { label: string; tone: 'neutral' | 'ok' | 'warn' | 'danger' } {
  if (!membership) {
    return { label: 'Sin Plan', tone: 'neutral' }
  }

  const status = computeMembershipStatus(membership, now)
  if (status === 'active') {
    return { label: 'Vigente', tone: 'ok' }
  }

  if (status === 'grace') {
    const endsAtMs = new Date(membership.endsAt).getTime()
    const graceEndsAtMs = membership.graceEndsAt
      ? new Date(membership.graceEndsAt).getTime()
      : endsAtMs + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    const diffMs = graceEndsAtMs - now.getTime()
    const graceDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
    return { label: `En Gracia (${graceDays} d)`, tone: 'warn' }
  }

  return { label: 'Vencido', tone: 'danger' }
}

export function CheckInPage() {
  const user = useCurrentUser()
  const data = useAppData()
  const repo = useRepo()
  const refresh = useRefresh()
  const isStaff = user ? user.role === 'staff' || user.role === 'admin' : false
  const [msg, setMsg] = useState('')
  const [code, setCode] = useState('')
  const [bookingId, setBookingId] = useState('')
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

  const staffCandidates = useMemo(
    () =>
      data.bookings
        .filter((b) => b.status === 'confirmed' || b.status === 'pending')
        .map((b) => {
          const session = data.sessions.find((s) => s.id === b.sessionId)
          const member = data.users.find((u) => u.id === b.userId)
          const membership = member ? selectMyMembership(data, member.id) : null
          const chip = getMemberMembershipChip(membership)
          return {
            booking: b,
            session,
            member,
            membership,
            chip,
          }
        })
        .filter((x) => x.session)
        .sort((a, b) =>
          a.session!.startsAt.localeCompare(b.session!.startsAt),
        )
        .slice(0, 40),
    [data],
  )

  const selectedCandidate = useMemo(
    () => staffCandidates.find((c) => c.booking.id === bookingId),
    [staffCandidates, bookingId],
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
          color: { dark: '#0E1117', light: '#00000000' },
        })
      }
      if (!cancelled) setQrMap(next)
    })()
    return () => {
      cancelled = true
    }
  }, [isStaff, memberBookings])

  function handleSelectCandidate(candBookingId: string, candCode: string) {
    setBookingId(candBookingId)
    setCode(candCode)
  }

  return (
    <div>
      <PageHeader
        title="Check-in"
        subtitle={
          isStaff
            ? 'Validar código QR del socio en recepción'
            : 'Muestra tu QR al llegar a la clase'
        }
      />
      {msg ? <p className="mb-3 text-sm text-acc">{msg}</p> : null}

      {isStaff ? (
        <div className="space-y-6">
          <Card className="space-y-3">
            <Input
              label="Código del socio"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="QR-…"
            />
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-3">
                Reserva
              </span>
              <select
                className="focus-ring w-full rounded-2xl border border-line bg-bg-2 px-3.5 py-2.5 text-sm"
                value={bookingId}
                onChange={(e) => {
                  const id = e.target.value
                  setBookingId(id)
                  const found = staffCandidates.find((c) => c.booking.id === id)
                  if (found) {
                    setCode(found.booking.checkInCode)
                  }
                }}
              >
                <option value="">Seleccionar…</option>
                {staffCandidates.map(({ booking, session, member, chip }) => (
                  <option key={booking.id} value={booking.id}>
                    [{chip.label}] {member?.fullName ?? 'Socio'} · {session!.title} ·{' '}
                    {format(parseISO(session!.startsAt), 'EEE HH:mm', {
                      locale: es,
                    })}{' '}
                    ({booking.checkInCode})
                  </option>
                ))}
              </select>
            </label>

            {selectedCandidate ? (
              <div className="flex items-center justify-between rounded-2xl border border-line bg-surface/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {selectedCandidate.member?.fullName ?? 'Socio'}
                  </span>
                  <Badge
                    tone={selectedCandidate.chip.tone}
                    data-testid="selected-member-chip"
                  >
                    {selectedCandidate.chip.label}
                  </Badge>
                </div>
                <span className="font-mono text-xs text-acc font-bold">
                  {selectedCandidate.booking.checkInCode}
                </span>
              </div>
            ) : null}

            <Button
              disabled={!bookingId || !code.trim()}
              onClick={() => {
                void (async () => {
                  try {
                    await repo.checkIn(bookingId, code.trim())
                    await refresh()
                    setMsg('Check-in registrado con éxito')
                    setCode('')
                    setBookingId('')
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : 'Error al registrar check-in')
                  }
                })()
              }}
            >
              Validar check-in
            </Button>
          </Card>

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-3">
              Próximos socios para check-in ({staffCandidates.length})
            </h2>

            {staffCandidates.length === 0 ? (
              <Card>
                <p className="text-sm text-ink-3">No hay reservas pendientes de check-in.</p>
              </Card>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {staffCandidates.map(({ booking, session, member, chip }) => {
                  const isSelected = booking.id === bookingId
                  return (
                    <Card
                      key={booking.id}
                      className={`flex flex-col justify-between gap-3 transition cursor-pointer hover:border-acc/40 ${
                        isSelected ? 'border-acc bg-acc/10' : ''
                      }`}
                      onClick={() => handleSelectCandidate(booking.id, booking.checkInCode)}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-sm text-ink">
                            {member?.fullName ?? 'Socio'}
                          </span>
                          <Badge
                            tone={chip.tone}
                            data-testid={`membership-chip-${booking.id}`}
                          >
                            {chip.label}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-ink-2">
                          {session!.title}
                        </p>
                        <p className="text-xs text-ink-3">
                          {format(parseISO(session!.startsAt), 'EEE d MMM · HH:mm', {
                            locale: es,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-line/40 text-xs">
                        <span className="font-mono font-bold text-acc">
                          {booking.checkInCode}
                        </span>
                        <span className="text-[11px] text-ink-3">
                          {isSelected ? 'Seleccionado' : 'Tocar para elegir'}
                        </span>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {memberBookings.length === 0 ? (
            <Card>
              <p className="text-ink-3">
                No tienes reservas confirmadas próximas.
              </p>
            </Card>
          ) : (
            memberBookings.map(({ booking, session }) => (
              <Card
                key={booking.id}
                className="flex flex-wrap items-center gap-4"
              >
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
                  <p className="mt-2 font-mono text-sm font-bold tracking-wider text-acc">
                    {booking.checkInCode}
                  </p>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
