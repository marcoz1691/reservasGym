import { Capacitor } from '@capacitor/core'
import { isSupabaseConfigured } from '@/data/supabaseRepository'

export type OnlinePayProvider = 'pagomedios' | 'datafast'

/**
 * Pago en línea — activar con VITE_ONLINE_PAYMENTS=1.
 * Pagomedios (default) requiere el secret PAGOMEDIOS_TOKEN en Supabase;
 * Datafast (VITE_PAYMENT_PROVIDER=datafast) requiere los secrets DATAFAST_*.
 */
export function isOnlinePayEnabled(): boolean {
  return import.meta.env.VITE_ONLINE_PAYMENTS === '1' && isSupabaseConfigured()
}

export function getOnlinePayProvider(): OnlinePayProvider {
  return import.meta.env.VITE_PAYMENT_PROVIDER === 'datafast' ? 'datafast' : 'pagomedios'
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Abre el formulario de pago del proveedor.
 * Web: la pestaña navega al formulario y el proveedor la devuelve a la app.
 * Nativa: navegador dentro de la app (Safari View Controller / Custom Tabs); al
 * cerrarlo se llama onClosed para verificar el pago, sin deep links.
 */
export async function openPaymentPage(url: string, onClosed: () => void): Promise<void> {
  if (!isNativeApp()) {
    window.location.assign(url)
    return
  }
  const { Browser } = await import('@capacitor/browser')
  const listener = await Browser.addListener('browserFinished', () => {
    void listener.remove()
    onClosed()
  })
  await Browser.open({ url, presentationStyle: 'popover' })
}
