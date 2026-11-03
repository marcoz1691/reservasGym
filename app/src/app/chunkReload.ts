/**
 * Tras un deploy, los chunks con hash de la versión anterior dejan de existir.
 * Quien tenga la app abierta (o un index.html en caché) falla al cargar una
 * ruta perezosa. Recargar una vez trae el index.html nuevo y lo resuelve.
 */

const STORAGE_KEY = 'zc:chunk-reload-at'
/** Ventana mínima entre recargas, para no entrar en bucle si el fallo persiste. */
const RELOAD_WINDOW_MS = 30_000

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /is not a valid JavaScript MIME type/i,
  /Unable to preload CSS/i,
]

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(message))
}

/**
 * Recarga la página si no se hizo ya hace poco. Devuelve `true` si recargó
 * (o está por hacerlo), `false` si se omitió para evitar un bucle.
 */
export function reloadOnceForStaleChunk(now: number = Date.now()): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(STORAGE_KEY) ?? 0)
    if (last && now - last < RELOAD_WINDOW_MS) return false
    window.sessionStorage.setItem(STORAGE_KEY, String(now))
  } catch {
    // Sin sessionStorage (modo privado estricto): no se puede proteger del bucle.
    return false
  }
  window.location.reload()
  return true
}

export function installChunkReload(): void {
  window.addEventListener('vite:preloadError', () => {
    reloadOnceForStaleChunk()
  })
}
