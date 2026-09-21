import type { User } from '../models'

/**
 * Ficha técnica inicial pendiente. Se deriva de los dos campos que el paso 1
 * del wizard siempre guarda, así que no hace falta una marca en la base.
 */
export function isFichaPending(user: User | null | undefined): boolean {
  if (!user || user.role !== 'member') return false
  return user.heightCm == null || user.initialWeightKg == null
}
