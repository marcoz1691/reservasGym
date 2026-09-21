const FICHA_SKIP_KEY = 'zc.ficha.skipped'

/**
 * El socio eligió completar la ficha después. La marca dura solo esta sesión
 * del navegador, así que en el siguiente ingreso se le vuelve a ofrecer.
 */
export function markFichaSkipped(): void {
  try {
    sessionStorage.setItem(FICHA_SKIP_KEY, '1')
  } catch {
    // Storage bloqueado (modo privado): la ficha se volverá a ofrecer.
  }
}

export function wasFichaSkipped(): boolean {
  try {
    return sessionStorage.getItem(FICHA_SKIP_KEY) === '1'
  } catch {
    return false
  }
}
