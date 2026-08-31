export type RepositoryBackend = 'local' | 'supabase'

export type RepositoryEnv = {
  supabaseUrl?: string
  supabaseAnonKey?: string
  isDev: boolean
}

export function isSupabaseEnvConfigured(env: {
  supabaseUrl?: string
  supabaseAnonKey?: string
}): boolean {
  return Boolean(env.supabaseUrl?.trim() && env.supabaseAnonKey?.trim())
}

/**
 * Production must use Supabase. LocalRepository is allowed only in DEV
 * when Supabase env is not set (demos / unit tests).
 */
export function selectRepositoryBackend(env: RepositoryEnv): RepositoryBackend {
  if (isSupabaseEnvConfigured(env)) return 'supabase'
  if (env.isDev) return 'local'
  throw new Error(
    'ReservasGym: faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. El modo local solo está permitido en desarrollo.',
  )
}
