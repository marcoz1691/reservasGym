import { describe, expect, it, vi } from 'vitest'
import type { GymState, User } from '@/domain/models'
import type { GymRepository } from '@/data/types'
import { fetchGymSnapshot, type GymSnapshot } from './gymQueries'

const socio = { id: 'u_socio', role: 'member' } as User
const previous: GymSnapshot = { user: socio, state: { sessions: [] } as unknown as GymState }

function repoWith(getCurrentUser: () => Promise<User | null>, load: () => Promise<GymState>) {
  return { getCurrentUser: vi.fn(getCurrentUser), load: vi.fn(load) } as unknown as GymRepository
}

describe('fetchGymSnapshot', () => {
  it('sin red al volver de segundo plano conserva la sesión y los datos anteriores', async () => {
    const offline = () => Promise.reject(new TypeError('Failed to fetch'))
    const repo = repoWith(offline, offline)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(fetchGymSnapshot(repo, previous)).resolves.toEqual(previous)
  })

  it('si la carga falla pero la sesión sigue, conserva el estado anterior', async () => {
    const repo = repoWith(
      () => Promise.resolve(socio),
      () => Promise.reject(new Error('timeout')),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(fetchGymSnapshot(repo, previous)).resolves.toEqual(previous)
  })

  it('si Supabase confirma que no hay sesión, vacía el usuario', async () => {
    let calls = 0
    const repo = repoWith(
      () => (calls++ === 0 ? Promise.reject(new Error('x')) : Promise.resolve(null)),
      () => Promise.reject(new Error('x')),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(fetchGymSnapshot(repo, previous)).resolves.toEqual({ user: null, state: null })
  })

  it('sin red y sin datos previos (arranque en frío) no inventa sesión', async () => {
    const offline = () => Promise.reject(new TypeError('Failed to fetch'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(fetchGymSnapshot(repoWith(offline, offline), undefined)).resolves.toEqual({
      user: null,
      state: null,
    })
  })
})
