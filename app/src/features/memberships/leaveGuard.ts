import { useEffect } from 'react'

const GUARD_KEY = 'zonaceroCheckoutGuard'
/** Mientras se sale a propósito, el guardia no vuelve a interceptar "atrás". */
let leavingCheckout = false

/**
 * Mientras está activo, "atrás" (teléfono o navegador) no saca al socio del
 * pago: se agrega una entrada igual al historial y, si vuelve sobre ella, se
 * repone y se pregunta. Conserva el estado de React Router (idx/key).
 */
export function useLeaveGuard(active: boolean, onAttempt: () => void) {
  useEffect(() => {
    if (!active) return
    const state = window.history.state as Record<string, unknown> | null
    if (!state?.[GUARD_KEY]) window.history.pushState({ ...state, [GUARD_KEY]: true }, '')
    const onPop = () => {
      if (leavingCheckout) return
      window.history.pushState({ ...(window.history.state ?? {}), [GUARD_KEY]: true }, '')
      onAttempt()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [active, onAttempt])
}

/** Quita la entrada extra del historial (si existe) y luego sale. */
export function leaveGuardedPage(go: () => void) {
  const state = window.history.state as Record<string, unknown> | null
  if (!state?.[GUARD_KEY]) {
    go()
    return
  }
  leavingCheckout = true
  const onPop = () => {
    window.removeEventListener('popstate', onPop)
    leavingCheckout = false
    go()
  }
  window.addEventListener('popstate', onPop)
  window.history.back()
}
