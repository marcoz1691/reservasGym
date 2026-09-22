import { ecuadorTodayYmd } from '@/lib/format'

function parseYmd(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.split('-').map(Number)
  if (y == null || m == null || d == null || [y, m, d].some(Number.isNaN)) {
    throw new Error(`Fecha inválida: ${ymd}`)
  }
  return [y, m, d]
}

export function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = parseYmd(ymd)
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function mondayOfYmd(ymd: string): string {
  const [y, m, d] = parseYmd(ymd)
  const weekday = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  const delta = weekday === 0 ? -6 : 1 - weekday
  return shiftYmd(ymd, delta)
}

export function weekYmds(anchorYmd: string): string[] {
  const monday = mondayOfYmd(anchorYmd)
  return Array.from({ length: 7 }, (_, index) => shiftYmd(monday, index))
}

export function sessionStillOpen(endsAt: string, now = new Date()): boolean {
  return new Date(endsAt).getTime() > now.getTime()
}

export function sessionHasNotStarted(startsAt: string, now = new Date()): boolean {
  return new Date(startsAt).getTime() > now.getTime()
}

type TimedSession = { startsAt: string; endsAt: string }

export function nextOpenDayYmd(
  sessions: TimedSession[],
  afterYmd: string,
  now = new Date(),
): string | null {
  const days = sessions
    .filter((session) => sessionStillOpen(session.endsAt, now))
    .map((session) => ecuadorTodayYmd(session.startsAt))
    .filter((day) => day > afterYmd)
    .sort()
  return days[0] ?? null
}

type Choice = { id: string; zoneId: string; startsAt: string }

/** Otras clases de la misma área que todavía no empiezan. */
export function rescheduleChoices<T extends Choice>(
  sessions: T[],
  currentSessionId: string,
  zoneId: string,
  now = new Date(),
): T[] {
  const nowMs = now.getTime()
  return sessions
    .filter((session) => session.id !== currentSessionId && session.zoneId === zoneId)
    .filter((session) => new Date(session.startsAt).getTime() > nowMs)
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .slice(0, 30)
}
