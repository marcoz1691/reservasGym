import { queryOptions, type QueryClient } from '@tanstack/react-query'
import type { GymState, User } from '@/domain/models'
import { queryKeys } from '@/data/queryKeys'
import type { GymRepository } from '@/data/types'

export type GymSnapshot = { user: User | null; state: GymState | null }

/**
 * Misma lógica que tenía `refresh()`: si falla la carga y la sesión sigue
 * abierta, se conserva el estado anterior; sin sesión, se vacía. No lanza,
 * así un fallo de red no saca al socio de la app.
 */
export async function fetchGymSnapshot(
  repo: GymRepository,
  previous: GymSnapshot | undefined,
): Promise<GymSnapshot> {
  try {
    const user = await repo.getCurrentUser()
    const state = await repo.load()
    return { user, state }
  } catch (err) {
    console.error('[ReservasGym] refresh failed:', err)
    try {
      const user = await repo.getCurrentUser()
      return { user, state: user ? (previous?.state ?? null) : null }
    } catch {
      return { user: null, state: null }
    }
  }
}

export function gymStateQueryOptions(repo: GymRepository, queryClient: QueryClient) {
  return queryOptions({
    queryKey: queryKeys.gymState(),
    queryFn: () =>
      fetchGymSnapshot(repo, queryClient.getQueryData<GymSnapshot>(queryKeys.gymState())),
  })
}
