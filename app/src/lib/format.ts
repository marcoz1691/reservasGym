import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export const ECUADOR_TIMEZONE = 'America/Guayaquil'
/** Ecuador no usa DST; offset fijo para armar instantes desde fecha+hora de pared. */
export const ECUADOR_OFFSET = '-05:00'

function parseDateInput(input: string | Date): Date {
  return typeof input === 'string' ? parseISO(input) : input
}

/** Convierte fecha `YYYY-MM-DD` + hora `HH:mm` de Ecuador a ISO UTC. */
export function ecuadorLocalDateTimeIso(dateYmd: string, timeHm: string): string {
  const time = timeHm.length === 5 ? `${timeHm}:00` : timeHm
  return new Date(`${dateYmd}T${time}${ECUADOR_OFFSET}`).toISOString()
}

/** Día calendario en America/Guayaquil (`YYYY-MM-DD`). */
export function ecuadorTodayYmd(now: string | Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ECUADOR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parseDateInput(now))
}


export function formatEcuadorTime(isoOrDate: string | Date): string {
  const date = parseDateInput(isoOrDate)
  try {
    return new Intl.DateTimeFormat('es-EC', {
      timeZone: ECUADOR_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
  } catch {
    return format(date, 'HH:mm', { locale: es })
  }
}

export function formatEcuadorDate(
  isoOrDate: string | Date,
  style: 'short' | 'medium' | 'long' | 'full' = 'medium',
): string {
  const date = parseDateInput(isoOrDate)
  try {
    if (style === 'short') {
      return new Intl.DateTimeFormat('es-EC', {
        timeZone: ECUADOR_TIMEZONE,
        day: 'numeric',
        month: 'short',
      }).format(date)
    }
    if (style === 'long' || style === 'full') {
      return new Intl.DateTimeFormat('es-EC', {
        timeZone: ECUADOR_TIMEZONE,
        weekday: style === 'full' ? 'long' : undefined,
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date)
    }
    return new Intl.DateTimeFormat('es-EC', {
      timeZone: ECUADOR_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date)
  } catch {
    return format(date, 'd MMM yyyy', { locale: es })
  }
}

export function formatSessionWhen(iso: string | Date): string {
  const date = parseDateInput(iso)
  try {
    const dayPart = new Intl.DateTimeFormat('es-EC', {
      timeZone: ECUADOR_TIMEZONE,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date)
    const timePart = new Intl.DateTimeFormat('es-EC', {
      timeZone: ECUADOR_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
    return `${dayPart} · ${timePart}`
  } catch {
    return format(date, "EEE d MMM · HH:mm", { locale: es })
  }
}

export function formatEcuadorSessionWhen(iso: string | Date): string {
  return formatSessionWhen(iso)
}

export function formatDateShort(iso: string | Date): string {
  const date = parseDateInput(iso)
  try {
    return new Intl.DateTimeFormat('es-EC', {
      timeZone: ECUADOR_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date)
  } catch {
    return format(date, 'd MMM yyyy', { locale: es })
  }
}

export function formatTime(iso: string | Date): string {
  return formatEcuadorTime(iso)
}

export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function formatDateSpanish(iso: string | Date): string {
  const date = parseDateInput(iso)
  try {
    return new Intl.DateTimeFormat('es-EC', {
      timeZone: ECUADOR_TIMEZONE,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
  } catch {
    return format(date, "d 'de' MMMM 'de' yyyy", { locale: es })
  }
}

export function formatPaymentMethod(
  provider: string,
  method?: string | null,
): string {
  if (provider === 'manual') {
    switch (method) {
      case 'cash':
        return 'Efectivo'
      case 'transfer':
        return 'Transferencia'
      case 'card_pos':
        return 'Datáfono POS'
      default:
        return 'Recepción'
    }
  }
  if (provider === 'datafast') return 'Datafast'
  if (provider === 'mercadopago') return 'Mercado Pago'
  return provider
}

export function occupancyTone(
  booked: number,
  capacity: number,
): 'ok' | 'warn' | 'danger' {
  const ratio = booked / Math.max(capacity, 1)
  if (ratio >= 1) return 'danger'
  if (ratio >= 0.8) return 'warn'
  return 'ok'
}

export function applyBrandColors(primary: string, accent: string) {
  const root = document.documentElement
  root.style.setProperty('--color-brand', primary)
  root.style.setProperty('--color-acc', accent)
}
