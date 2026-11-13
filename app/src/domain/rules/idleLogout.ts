import type { UserRole } from '../models'

const MINUTE_MS = 60 * 1000

/**
 * Minutos sin uso antes de cerrar la sesión. Admin y recepción manejan cobros y datos
 * de socios; el socio se protege por si pierde o le roban el celular (el QR abre el gym).
 */
export const IDLE_LIMIT_MINUTES: Record<UserRole, number> = {
  admin: 30,
  staff: 30,
  member: 5,
}

/** Compatibilidad: límite del personal. */
export const STAFF_IDLE_LIMIT_MS = IDLE_LIMIT_MINUTES.staff * MINUTE_MS

export function idleLimitMs(role: UserRole | null | undefined): number | null {
  if (!role) return null
  return IDLE_LIMIT_MINUTES[role] * MINUTE_MS
}

export function hasIdleLimit(role: UserRole | null | undefined): boolean {
  return idleLimitMs(role) !== null
}

export function isIdleExpired(
  lastActivityMs: number,
  nowMs: number,
  limitMs: number = STAFF_IDLE_LIMIT_MS,
): boolean {
  return nowMs - lastActivityMs >= limitMs
}
