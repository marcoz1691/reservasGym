import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { useAppStore, selectMyBookings } from '@/app/store'
import { formatSessionWhen } from '@/lib/format'
import { Badge, Button, EmptyState, Field, Input, PageHeader } from '@/ui/primitives'

export function BookingsPage() {
  const user = useAppStore((s) => s.user)
  const state = useAppStore((s) => s.state)
  const cancel = useAppStore((s) => s.cancel)
  const reschedule = useAppStore((s) => s.reschedule)
  const checkIn = useAppStore((s) => s.checkIn)
  const bookings = selectMyBookings(state, user?.id)
  const [qrMap, setQrMap] = useState<Record<string, string>>({})
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [newSessionId, setNewSessionId] = useState('')
  const [staffCode, setStaffCode] = useState('')
  const [staffBookingId, setStaffBookingId] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const active = bookings.filter(
    (b) =>
      b.status === 'confirmed' ||
      b.status === 'waitlisted' ||
      b.status === 'pending',
  )

  useEffect(() => {
    let cancelled = false
    async function build() {
      const next: Record<string, string> = {}
      for (const b of active) {
        if (b.status !== 'confirmed') continue
        next[b.id] = await QRCode.toDataURL(b.checkInCode, { margin: 1, width: 160 })
      }
      if (!cancelled) setQrMap(next)
    }
    void build()
    return () => {
      cancelled = true
    }
  }, [active])

  const futureSessions = useMemo(
    () =>
      (state?.sessions ?? []).filter(
        (s) => new Date(s.startsAt).getTime() > Date.now(),
      ),
    [state?.sessions],
  )

  const isStaff = user?.role === 'staff' || user?.role === 'admin'

  return (
    <div>
      <PageHeader
        title="Mis reservas"
        subtitle="Cancela, reagenda o muestra tu QR de check-in."
      />
      {msg ? (
        <p className="mb-4 rounded-xl bg-[var(--color-acc-soft)] px-3 py-2 text-sm">{msg}</p>
      ) : null}

      {isStaff ? (
        <div className="surface mb-6 space-y-3 p-4">
          <h2 className="font-semibold">Check-in recepción</h2>
          <Field label="ID reserva">
            <Input value={staffBookingId} onChange={(e) => setStaffBookingId(e.target.value)} />
          </Field>
          <Field label="Código QR">
            <Input value={staffCode} onChange={(e) => setStaffCode(e.target.value)} />
          </Field>
          <Button
            onClick={() => {
              void checkIn(staffBookingId, staffCode)
                .then(() => setMsg('Check-in OK'))
                .catch((e: unknown) =>
                  setMsg(e instanceof Error ? e.message : 'Error'),
                )
            }}
          >
            Validar
          </Button>
        </div>
      ) : null}

      {active.length === 0 ? (
        <EmptyState title="Sin reservas activas" description="Reserva desde la agenda." />
      ) : (
        <ul className="space-y-3">
          {active.map((b) => {
            const session = state?.sessions.find((s) => s.id === b.sessionId)
            return (
              <li key={b.id} className="surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{session?.title ?? 'Sesión'}</p>
                    <p className="text-sm text-[var(--color-ink-3)]">
                      {session ? formatSessionWhen(session.startsAt) : '—'}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[var(--color-ink-3)]">
                      {b.id} · {b.checkInCode}
                    </p>
                  </div>
                  <Badge
                    tone={
                      b.status === 'waitlisted'
                        ? 'warn'
                        : b.status === 'confirmed'
                          ? 'ok'
                          : 'neutral'
                    }
                  >
                    {b.status}
                  </Badge>
                </div>
                {qrMap[b.id] ? (
                  <img
                    src={qrMap[b.id]}
                    alt="QR check-in"
                    className="mt-3 rounded-xl bg-white p-2"
                  />
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.status !== 'waitlisted' ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setRescheduleId(b.id)
                        setNewSessionId('')
                      }}
                    >
                      Reagendar
                    </Button>
                  ) : null}
                  <Button
                    variant="danger"
                    onClick={() => {
                      void cancel(b.id)
                        .then(() => setMsg('Cancelada'))
                        .catch((e: unknown) =>
                          setMsg(e instanceof Error ? e.message : 'Error'),
                        )
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
                {rescheduleId === b.id ? (
                  <div className="mt-3 space-y-2 border-t border-[var(--color-line)] pt-3">
                    <Field label="Nueva sesión">
                      <select
                        className="focus-ring w-full rounded-2xl border border-line bg-bg-2 px-3 py-2"
                        value={newSessionId}
                        onChange={(e) => setNewSessionId(e.target.value)}
                      >
                        <option value="">Elegir…</option>
                        {futureSessions
                          .filter((s) => s.id !== b.sessionId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title} · {formatSessionWhen(s.startsAt)}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Button
                      disabled={!newSessionId}
                      onClick={() => {
                        void reschedule(b.id, newSessionId)
                          .then(() => {
                            setMsg('Reagendada')
                            setRescheduleId(null)
                          })
                          .catch((e: unknown) =>
                            setMsg(e instanceof Error ? e.message : 'Error'),
                          )
                      }}
                    >
                      Confirmar reagenda
                    </Button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
