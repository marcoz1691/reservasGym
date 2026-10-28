import { useSyncExternalStore } from 'react'

/**
 * Estado de conexión del dispositivo con `navigator.onLine` y los eventos
 * `online`/`offline` (también funcionan en el WebView de Capacitor).
 * `onLine === false` es fiable; `true` solo indica que hay red, no que el
 * servidor responda.
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

export function subscribeOnlineStatus(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** `true` mientras hay conexión. Las páginas pueden usarlo para deshabilitar acciones. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnlineStatus, isOnline, () => true)
}
