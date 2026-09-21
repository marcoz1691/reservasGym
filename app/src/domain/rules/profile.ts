import type { User } from '../models'

/**
 * Ficha técnica inicial pendiente. Se deriva de los dos campos que el paso 1
 * del wizard siempre guarda, así que no hace falta una marca en la base.
 */
export function isFichaPending(user: User | null | undefined): boolean {
  if (!user || user.role !== 'member') return false
  return user.heightCm == null || user.initialWeightKg == null
}

const ROLE_NAME_PREFIX = /^(socio|staff|admin)$/i

function visibleNameParts(fullName: string | null | undefined): string[] {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return []
  if (ROLE_NAME_PREFIX.test(parts[0]) && parts.length > 1) {
    return parts.slice(1)
  }
  return parts
}

/** Primer nombre visible. Evita saludar "Socio" cuando el fullName es el rol de QA. */
export function displayFirstName(
  fullName: string | null | undefined,
): string {
  return visibleNameParts(fullName)[0] ?? ''
}

export function displayInitials(fullName: string | null | undefined): string {
  return visibleNameParts(fullName)
    .slice(0, 2)
    .map((n) => n[0]!)
    .join('')
    .toUpperCase()
}
