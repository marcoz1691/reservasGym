import { Capacitor } from '@capacitor/core'
import { focusManager, QueryClient } from '@tanstack/react-query'

/** Datos frescos por 30 s: volver a una pantalla dentro de ese lapso no pide nada a la red. */
export const STALE_TIME_MS = 30_000
/** Caché sin pantallas que la usen: se descarta a los 5 min. */
export const GC_TIME_MS = 5 * 60_000

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: GC_TIME_MS,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      // Reservar o cancelar dos veces por un reintento automático sería peor que el error.
      mutations: { retry: false },
    },
  })
}

let nativeFocusInstalled = false

/**
 * En Capacitor el WebView no recibe `visibilitychange` de forma fiable al
 * volver de segundo plano: se avisa al focusManager con `appStateChange`
 * para que las consultas vencidas se refresquen al reabrir la app.
 */
export async function installNativeFocusRefetch(): Promise<void> {
  if (nativeFocusInstalled || !Capacitor.isNativePlatform()) return
  nativeFocusInstalled = true
  const { App } = await import('@capacitor/app')
  await App.addListener('appStateChange', ({ isActive }) => {
    focusManager.setFocused(isActive)
  })
}
