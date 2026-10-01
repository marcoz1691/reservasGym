import { Capacitor } from '@capacitor/core'

/**
 * Botón "atrás" de Android. Sin esto Capacitor cierra la app desde cualquier
 * pantalla. Con historial navega hacia atrás como un navegador (las pantallas
 * que lo necesitan, como el pago, lo interceptan con `popstate`); sin
 * historial, sale de la app como cualquier app de Android.
 */
export async function installAndroidBackButton(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  const { App } = await import('@capacitor/app')
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.exitApp()
  })
}
