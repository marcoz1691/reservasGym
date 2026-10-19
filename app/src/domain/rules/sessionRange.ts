/** Máximo de días que abarca una programación en bloque (3 meses). */
export const MAX_RANGE_DAYS = 92

export const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const

/** Días de la semana (0 = domingo) preseleccionados al repetir una clase. */
export const DEFAULT_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5]

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Fechas (YYYY-MM-DD) entre `startYmd` y `endYmd`, ambas incluidas, que caen en
 * alguno de `weekdays` (0 = domingo). Sin fecha final devuelve solo el inicio.
 * Trabaja con fechas de calendario, sin zona horaria.
 */
export function expandSessionDates(
  startYmd: string,
  endYmd: string | null | undefined,
  weekdays: readonly number[],
): string[] {
  const start = parseYmd(startYmd)
  if (!start) return []
  if (!endYmd) return [startYmd]
  const end = parseYmd(endYmd)
  if (!end || end < start) return []

  const dates: string[] = []
  const cursor = new Date(start)
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  for (let i = 0; i < Math.min(days, MAX_RANGE_DAYS + 1); i += 1) {
    if (weekdays.includes(cursor.getUTCDay())) dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

/** Días que abarca el rango, ambos extremos incluidos; 0 si es inválido. */
export function rangeDays(startYmd: string, endYmd: string): number {
  const start = parseYmd(startYmd)
  const end = parseYmd(endYmd)
  if (!start || !end || end < start) return 0
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}
