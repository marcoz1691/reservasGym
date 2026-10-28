import { Capacitor } from '@capacitor/core'

/**
 * Respuesta táctil al terminar una acción. Solo actúa en la app nativa; en la
 * web y en las pruebas no hace nada, y un fallo de vibración nunca debe romper
 * la acción que la dispara.
 */
export async function hapticSuccess(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    await Haptics.notification({ type: NotificationType.Success })
  } catch {
    // Sin motor háptico o sin permiso: se ignora.
  }
}

export async function hapticLight(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // Ídem.
  }
}
