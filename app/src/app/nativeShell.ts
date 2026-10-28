import { Capacitor } from '@capacitor/core'

/** Mismo valor que `--color-bg` y el `theme-color` de index.html. */
const BG_COLOR = '#F6F5F2'

/**
 * Ajustes de la app nativa (barra de estado, teclado y splash). En la web no
 * hace nada. Cada plugin se configura por separado para que el fallo de uno
 * no impida ocultar el splash, que es lo que deja la app usable.
 */
export async function installNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const platform = Capacitor.getPlatform()

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // Fondo claro: iconos oscuros (Style.Light en Capacitor = texto oscuro).
    await StatusBar.setStyle({ style: Style.Light })
    if (platform === 'android') await StatusBar.setBackgroundColor({ color: BG_COLOR })
  } catch {
    // Barra de estado por defecto.
  }

  try {
    const { Keyboard } = await import('@capacitor/keyboard')
    // Evita que el teclado tape el campo enfocado: la barra de accesorios de iOS
    // sobra en formularios cortos y la vista se desplaza sola al campo.
    await Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => undefined)
    await Keyboard.setScroll({ isDisabled: false }).catch(() => undefined)
  } catch {
    // Teclado por defecto.
  }
}

/** Oculta el splash nativo; llamar cuando React ya pintó la primera pantalla. */
export async function hideSplash(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide({ fadeOutDuration: 200 })
  } catch {
    // Si falla, el splash se oculta solo por `launchShowDuration`.
  }
}
