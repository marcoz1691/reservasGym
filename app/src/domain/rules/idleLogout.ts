import type { UserRole } from '../models'

const MINUTE_MS = 60 * 1000

/**
 * Minutos sin uso antes de cerrar la sesión. Admin y recepción manejan cobros y datos
 * de socios. El socio no tiene límite (null): abre la app en el gym varias veces al día
 * y pedirle la clave cada vez le resulta más incómodo que útil; su sesión dura lo que
 * permita la autenticación.
 */
export const IDLE_LIMIT_MINUTES: Record<UserRole, number | null> = {
  admin: 30,
  staff: 30,
  member: null,
}

/** Compatibilidad: límite del personal. */
export const STAFF_IDLE_LIMIT_MS = 30 * MINUTE_MS

export function idleLimitMs(role: UserRole | null | undefined): number | null {
  if (!role) return null
  const minutes = IDLE_LIMIT_MINUTES[role]
  return minutes === null ? null : minutes * MINUTE_MS
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
