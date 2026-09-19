import { isSupabaseConfigured } from '@/data/supabaseRepository'

/** Datafast Dataweb — activar con VITE_ONLINE_PAYMENTS=1 + secrets DATAFAST_* */
export function isOnlinePayEnabled(): boolean {
  return import.meta.env.VITE_ONLINE_PAYMENTS === '1' && isSupabaseConfigured()
}
