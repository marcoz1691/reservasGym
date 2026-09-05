import { LocalRepository } from './localRepository'
import {
  isSupabaseConfigured,
  SupabaseRepository,
} from './supabaseRepository'
import { selectRepositoryBackend } from './selectRepositoryBackend'
import type { GymRepository } from './types'

let singleton: GymRepository | null = null

export function getRepository(): GymRepository {
  if (!singleton) {
    const backend = selectRepositoryBackend({
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      isDev: import.meta.env.DEV,
    })
    singleton =
      backend === 'supabase' ? new SupabaseRepository() : new LocalRepository()
    if (import.meta.env.DEV) {
      console.info(
        `[ReservasGym] ${backend === 'supabase' ? 'STAGING/Supabase' : 'LOCAL (demo)'} →`,
        backend === 'supabase' ? import.meta.env.VITE_SUPABASE_URL : 'localStorage + socio@gym.local',
      )
    }
  }
  return singleton
}

export function getLocalRepository(): LocalRepository {
  const repo = getRepository()
  if (!(repo instanceof LocalRepository)) {
    throw new Error('LocalRepository no está activo (modo Supabase)')
  }
  return repo
}

export function resetRepositoryForTests(repo?: GymRepository) {
  singleton = repo ?? null
}

export { isSupabaseConfigured }
