import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { format, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertCircle, Camera, CheckCircle2, Clock, QrCode, Search, X } from 'lucide-react'
import { useAppData, useRefresh, useRepo } from '@/data/RepositoryProvider'
import { selectMyMembership } from '@/app/store'
import {
  findActiveBookingByCheckInCode,
  getCheckInTiming,
  normalizeCheckInCode,
  type CheckInTiming,
} from '@/domain/rules/checkInCode'
import type { Booking, GymState, Session, User } from '@/domain/models'
import { Badge, Button, PageHeader } from '@/ui/primitives'
import { getMemberMembershipChip } from './membershipChip'

const QrCameraScanner = lazy(() =>
  import('./QrCameraScanner').then((m) => ({ default: m.QrCameraScanner })),
)

const CODE_INPUT_ID = 'checkin-code'
const MINUTES_AFTER_START = 10
const LIST_HOURS_AHEAD = 24
const FEEDBACK_VISIBLE_MS = 4000
const CAMERA_PREF_KEY = 'zc-checkin-camera'

function readCameraPreference(): boolean {
  try {
    return window.localStorage.getItem(CAMERA_PREF_KEY) !== 'off'
  } catch {
    return true
  }
}

type Tone = 'neutral' | 'ok' | 'warn' | 'danger'

type Row = {
  booking: Booking
  session: Session
  member: User | undefined
  chip: { label: string; tone: Tone }
  timing: CheckInTiming
  attended: boolean
}

type Feedback =
  | { kind: 'success'; name: string; detail: string; chip: { label: string; tone: Tone } }
  | { kind: 'error'; message: string }

/**
 * En computadora (mouse/lector USB) deja el cursor en el campo para leer un
 * QR tras otro. En celular/tablet no, para no abrir el teclado en pantalla.
 */
function focusCodeInput() {
  if (typeof window === 'undefined') return
  if (!window.matchMedia?.('(pointer: fine)').matches) return
  document.getElementById(CODE_INPUT_ID)?.focus()
}

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function looksLikeCode(text: string): boolean {
  return /^QR/i.test(text.trim())
}

function initials(name: string | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function sessionWhen(startsAt: string, now: Date): string {
  const d = parseISO(startsAt)
  return isSameDay(d, now)
    ? `Hoy ${format(d, 'HH:mm')}`
    : format(d, "EEE d MMM · HH:mm", { locale: es })
}

function timingLabel(timing: CheckInTiming): { text: string; tone: Tone } {
  if (timing.kind === 'early') {
    return {
      text: `Aún no · check-in desde las ${format(timing.opensAt, 'HH:mm')}`,
      tone: 'warn',
    }
  }
  if (timing.kind === 'closed') {
    return { text: 'Check-in cerrado para esta clase', tone: 'danger' }
  }
  const m = timing.minutesToStart
  if (m > 0) return { text: `Puede entrar · empieza en ${m} min`, tone: 'ok' }
  if (m === 0) return { text: 'Puede entrar · empieza ahora', tone: 'ok' }
  return { text: `Puede entrar · empezó hace ${-m} min`, tone: 'ok' }
}

function buildRow(
  data: GymState,
  booking: Booking,
  now: Date,
  windowMin: number,
): Row | null {
  const session = data.sessions.find((s) => s.id === booking.sessionId)
  if (!session) return null
  const member = data.users.find((u) => u.id === booking.userId)
  const membership = member ? selectMyMembership(data, member.id) : null
  return {
    booking,
    session,
    member,
    chip: getMemberMembershipChip(membership, now),
    timing: getCheckInTiming(session.startsAt, now, windowMin, MINUTES_AFTER_START),
    attended: booking.status === 'attended',
  }
}

const TONE_RING: Record<Tone, string> = {
  ok: 'border-success/50',
  warn: 'border-warn/50',
  danger: 'border-danger/50',
  neutral: 'border-line',
}

const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-success',
  warn: 'text-warn',
  danger: 'text-danger',
  neutral: 'text-ink-3',
}

export function StaffCheckIn() {
  const data = useAppData()
  const repo = useRepo()
  const refresh = useRefresh()
  const windowMin = data.settings.checkInWindowMinutes ?? 15

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [busy, setBusy] = useState(false)
  // La cámara se abre sola; quien usa lector USB puede apagarla y queda guardado.
  const [cameraOn, setCameraOn] = useState(readCameraPreference)
  const [manualOpen, setManualOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())

  // La ventana de check-in cambia con el reloj: refresca cada 30 s.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    focusCodeInput()
  }, [])

  // El aviso se va solo y la cámara vuelve a leer. Un error sobre una reserva
  // elegida se queda hasta que recepción la cancele.
  useEffect(() => {
    if (!feedback || (feedback.kind === 'error' && selectedId)) return
    const id = window.setTimeout(() => setFeedback(null), FEEDBACK_VISIBLE_MS)
    return () => window.clearTimeout(id)
  }, [feedback, selectedId])

  /** Clases que aún admiten check-in en las próximas horas, con sus reservas. */
  const groups = useMemo(() => {
    const limit = now.getTime() + LIST_HOURS_AHEAD * 3_600_000
    const bySession = new Map<string, Row[]>()
    for (const b of data.bookings) {
      if (b.status !== 'confirmed' && b.status !== 'pending' && b.status !== 'attended') {
        continue
      }
      const row = buildRow(data, b, now, windowMin)
      if (!row || row.timing.kind === 'closed') continue
      if (new Date(row.session.startsAt).getTime() > limit) continue
      const list = bySession.get(row.session.id) ?? []
      list.push(row)
      bySession.set(row.session.id, list)
    }
    return [...bySession.values()]
      .flatMap((rows) => {
        const first = rows[0]
        return first ? [{ session: first.session, timing: first.timing, rows }] : []
      })
      .map((g) => ({
        ...g,
        rows: g.rows.sort((a, b) =>
          (a.member?.fullName ?? '').localeCompare(b.member?.fullName ?? ''),
        ),
      }))
      .sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt))
  }, [data, now, windowMin])

  const selected = useMemo(() => {
    if (!selectedId) return null
    const b = data.bookings.find((x) => x.id === selectedId)
    return b ? buildRow(data, b, now, windowMin) : null
  }, [data, selectedId, now, windowMin])

  const nameFilter = query.trim() && !looksLikeCode(query) ? plain(query) : ''
  const visibleGroups = nameFilter
    ? groups
        .map((g) => ({
          ...g,
          rows: g.rows.filter((r) => plain(r.member?.fullName ?? '').includes(nameFilter)),
        }))
        .filter((g) => g.rows.length > 0)
    : groups
  const pendingMatches = visibleGroups.flatMap((g) => g.rows.filter((r) => !r.attended))
  const codeNotFound = looksLikeCode(query) && !selected
  const alreadyIn =
    codeNotFound &&
    data.bookings.some(
      (b) =>
        b.status === 'attended' &&
        normalizeCheckInCode(b.checkInCode) === normalizeCheckInCode(query),
    )

  function reset() {
    setQuery('')
    setSelectedId('')
  }

  function select(bookingId: string) {
    setFeedback(null)
    setSelectedId(bookingId)
    focusCodeInput()
  }

  /** Código escrito, pegado, de lector QR o de la cámara: busca la reserva sola. */
  function handleQueryChange(raw: string) {
    setFeedback(null)
    const found = findActiveBookingByCheckInCode(data.bookings, raw)
    if (found) {
      setQuery(found.checkInCode)
      setSelectedId(found.id)
    } else {
      setQuery(raw)
      setSelectedId('')
    }
  }

  function setCameraPreference(on: boolean) {
    setCameraOn(on)
    try {
      window.localStorage.setItem(CAMERA_PREF_KEY, on ? 'on' : 'off')
    } catch {
      // Sin almacenamiento: la preferencia dura solo esta visita.
    }
  }

  function openManual() {
    setManualOpen(true)
    window.setTimeout(() => document.getElementById(CODE_INPUT_ID)?.focus(), 0)
  }

  async function handleValidate() {
    if (selected) await validateRow(selected)
  }

  async function validateRow(row: Row) {
    if (busy || row.timing.kind !== 'open') return
    setBusy(true)
    try {
      await repo.checkIn(row.booking.id, normalizeCheckInCode(row.booking.checkInCode))
      await refresh()
      setFeedback({
        kind: 'success',
        name: row.member?.fullName ?? 'Socio',
        detail: `${row.session.title} · ${sessionWhen(row.session.startsAt, now)}`,
        chip: row.chip,
      })
      reset()
      navigator.vibrate?.(60)
    } catch (e) {
      setFeedback({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Error al registrar check-in',
      })
    } finally {
      setBusy(false)
      focusCodeInput()
    }
  }

  /**
   * QR leído por la cámara o por el lector USB: si la clase está abierta,
   * registra la entrada de una; si no, muestra la ficha con el motivo.
   */
  function handleScanned(text: string) {
    const found = findActiveBookingByCheckInCode(data.bookings, text)
    setQuery('')
    if (!found) {
      const code = normalizeCheckInCode(text)
      const used = data.bookings.some(
        (b) => b.status === 'attended' && normalizeCheckInCode(b.checkInCode) === code,
      )
      setSelectedId('')
      setFeedback({
        kind: 'error',
        message: used
          ? 'Este socio ya hizo check-in con esta reserva.'
          : `No hay una reserva activa con el código ${code}.`,
      })
      return
    }
    setFeedback(null)
    setSelectedId(found.id)
    const row = buildRow(data, found, new Date(), windowMin)
    if (row && row.timing.kind === 'open') void validateRow(row)
  }

  const scannedRef = useRef(handleScanned)
  useEffect(() => {
    scannedRef.current = handleScanned
  })

  // Lector USB/Bluetooth sin el campo a la vista: escribe muy rápido y termina
  // con Enter. Se ignora si alguien está escribiendo en otro campo.
  useEffect(() => {
    let buffer = ''
    let last = 0
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const ms = Date.now()
      if (ms - last > 150) buffer = ''
      last = ms
      if (e.key === 'Enter') {
        if (buffer.length >= 6) {
          e.preventDefault()
          scannedRef.current(buffer)
        }
        buffer = ''
        return
      }
      if (e.key.length === 1) buffer += e.key
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleEnter() {
    if (selected) {
      void handleValidate()
      return
    }
    // Búsqueda por nombre con un solo resultado: lo elige directo.
    const only = pendingMatches.length === 1 ? pendingMatches[0] : undefined
    if (nameFilter && only) select(only.booking.id)
  }

  const selectedTiming = selected ? timingLabel(selected.timing) : null
  const totalPending = groups.reduce((n, g) => n + g.rows.filter((r) => !r.attended).length, 0)

  return (
    <div>
      <PageHeader
        title="Check-in"
        subtitle="Apunta la cámara al QR del socio"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        {/* Columna izquierda: escanear y resultado */}
        <div className="space-y-4">
          <div aria-live="polite" className="space-y-4">
            {feedback?.kind === 'success' ? (
              <div className="flex items-center gap-4 rounded-3xl border border-success/40 bg-success-soft p-5">
                <CheckCircle2 className="h-14 w-14 shrink-0 text-success" aria-hidden />
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-ink">{feedback.name} puede pasar</p>
                  <p className="text-sm text-ink-2">{feedback.detail}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={feedback.chip.tone}>{feedback.chip.label}</Badge>
                    <span className="text-sm font-semibold text-success">
                      Check-in registrado con éxito
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {feedback?.kind === 'error' && !selected ? (
              <div
                className="flex items-center gap-4 rounded-3xl border border-danger/40 bg-danger-soft p-5"
                role="alert"
              >
                <AlertCircle className="h-12 w-12 shrink-0 text-danger" aria-hidden />
                <div className="min-w-0">
                  <p className="text-lg font-bold text-ink">No se registró la entrada</p>
                  <p className="text-sm font-semibold text-danger">{feedback.message}</p>
                </div>
              </div>
            ) : null}

            {selected ? (
              <div
                className={`space-y-4 rounded-3xl border-2 bg-surface p-5 shadow-[var(--shadow-card)] ${
                  TONE_RING[selectedTiming!.tone]
                }`}
                data-testid="selected-booking"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-acc-soft text-lg font-bold text-acc-dark">
                    {initials(selected.member?.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-bold text-ink">
                      {selected.member?.fullName ?? 'Socio'}
                    </p>
                    <p className="text-sm text-ink-2">
                      {selected.session.title} · {sessionWhen(selected.session.startsAt, now)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={selected.chip.tone} data-testid="selected-member-chip">
                        {selected.chip.label}
                      </Badge>
                      <span className="font-mono text-xs font-bold text-ink-3">
                        {selected.booking.checkInCode}
                      </span>
                    </div>
                  </div>
                </div>

                <p
                  className={`flex items-center gap-2 text-sm font-semibold ${
                    TONE_TEXT[selectedTiming!.tone]
                  }`}
                >
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  {selectedTiming!.text}
                </p>
                {selected.chip.tone === 'danger' || selected.chip.tone === 'warn' ? (
                  <p className="text-xs text-ink-3">
                    {selected.chip.tone === 'danger'
                      ? 'Plan vencido: puede entrar con esta reserva, pero recuérdale renovar.'
                      : 'Plan en periodo de gracia: recuérdale renovar.'}
                  </p>
                ) : null}

                {feedback?.kind === 'error' ? (
                  <p className="rounded-2xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger" role="alert">
                    {feedback.message}
                  </p>
                ) : null}

                <div className="flex gap-2">
                  <Button
                    className="h-12 flex-1"
                    disabled={busy || selected.timing.kind !== 'open'}
                    onClick={() => void handleValidate()}
                  >
                    {busy ? 'Validando…' : 'Validar check-in'}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-12"
                    onClick={() => {
                      reset()
                      setFeedback(null)
                      focusCodeInput()
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {!selected && !feedback ? (
            cameraOn ? (
              <div className="rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
                <Suspense
                  fallback={<p className="py-10 text-center text-sm text-ink-3">Abriendo cámara…</p>}
                >
                  <QrCameraScanner
                    onResult={handleScanned}
                    onClose={() => setCameraPreference(false)}
                    onUnavailable={() => setManualOpen(true)}
                  />
                </Suspense>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-line-strong bg-surface p-6 text-center">
                <QrCode className="mx-auto h-10 w-10 text-ink-3" aria-hidden />
                <p className="mt-2 text-lg font-bold text-ink">Pasa el QR por el lector</p>
                <p className="text-sm text-ink-3">La cámara está apagada en este equipo.</p>
                <Button
                  variant="secondary"
                  className="mt-4"
                  onClick={() => setCameraPreference(true)}
                >
                  <Camera className="h-4 w-4" aria-hidden />
                  Encender cámara
                </Button>
              </div>
            )
          ) : null}

          {/* Segunda opción: escribir el código o buscar por nombre */}
          {manualOpen ? (
            <div className="rounded-3xl border border-line bg-surface p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label
                  htmlFor={CODE_INPUT_ID}
                  className="text-xs font-bold uppercase tracking-wider text-ink-3"
                >
                  Código del socio o nombre
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setManualOpen(false)
                    setQuery('')
                  }}
                  className="focus-ring rounded-full px-2 text-xs font-semibold text-ink-3 hover:text-ink"
                >
                  Ocultar
                </button>
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
                  aria-hidden
                />
                <input
                  id={CODE_INPUT_ID}
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleEnter()
                    } else if (e.key === 'Escape') {
                      reset()
                      setFeedback(null)
                    }
                  }}
                  placeholder="QR-… o nombre del socio"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="focus-ring h-12 w-full rounded-2xl border border-line bg-surface-elevated pl-11 pr-11 font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-3 focus-visible:border-acc/60 focus-visible:ring-2 focus-visible:ring-acc/20"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      reset()
                      setFeedback(null)
                      focusCodeInput()
                    }}
                    className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-3 hover:text-ink"
                    aria-label="Borrar"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              {codeNotFound ? (
                <p className="mt-2 text-sm font-semibold text-danger" data-testid="code-not-found">
                  {alreadyIn
                    ? 'Este socio ya hizo check-in con esta reserva.'
                    : 'No hay una reserva activa con ese código.'}
                </p>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={openManual}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              <Search className="h-4 w-4" aria-hidden />
              Escribir código o buscar por nombre
            </button>
          )}
          <p className="text-center text-xs text-ink-3">
            También funciona con lector QR USB o Bluetooth: solo pasa el código.
          </p>
        </div>

        {/* Columna derecha: quién viene */}
        <section aria-labelledby="checkin-list-title">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2
              id="checkin-list-title"
              className="text-sm font-bold uppercase tracking-wider text-ink-3"
            >
              Próximas clases
            </h2>
            <span className="text-xs text-ink-3">
              {totalPending} por entrar
            </span>
          </div>

          {visibleGroups.length === 0 ? (
            <div className="rounded-3xl border border-line bg-surface p-4">
              <p className="text-sm text-ink-3">
                {nameFilter
                  ? 'Nadie con ese nombre en las próximas clases.'
                  : 'No hay reservas pendientes de check-in.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleGroups.map((g) => {
                const attended = g.rows.filter((r) => r.attended).length
                const t = timingLabel(g.timing)
                return (
                  <div
                    key={g.session.id}
                    className="overflow-hidden rounded-3xl border border-line bg-surface"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-line/60 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{g.session.title}</p>
                        <p className="text-xs text-ink-3">
                          {sessionWhen(g.session.startsAt, now)} · {attended}/{g.rows.length} entraron
                        </p>
                      </div>
                      <Badge tone={t.tone}>
                        {g.timing.kind === 'early'
                          ? `Desde ${format(g.timing.opensAt, 'HH:mm')}`
                          : 'Abierto'}
                      </Badge>
                    </div>
                    <ul className="divide-y divide-line/60">
                      {g.rows.map((r) => {
                        const isSelected = r.booking.id === selectedId
                        return (
                          <li key={r.booking.id}>
                            <button
                              type="button"
                              disabled={r.attended}
                              onClick={() => select(r.booking.id)}
                              className={`focus-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                                isSelected
                                  ? 'bg-acc-soft'
                                  : r.attended
                                    ? 'opacity-60'
                                    : 'hover:bg-surface-elevated'
                              }`}
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg text-xs font-bold text-ink-2">
                                {initials(r.member?.fullName)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                                {r.member?.fullName ?? 'Socio'}
                              </span>
                              {r.attended ? (
                                <Badge tone="ok">
                                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                                  Entró
                                </Badge>
                              ) : (
                                <Badge
                                  tone={r.chip.tone}
                                  data-testid={`membership-chip-${r.booking.id}`}
                                >
                                  {r.chip.label}
                                </Badge>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
