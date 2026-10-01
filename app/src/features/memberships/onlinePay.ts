import { Capacitor } from '@capacitor/core'
import { isSupabaseConfigured } from '@/data/supabaseRepository'

export type OnlinePayProvider = 'pagomedios' | 'datafast'

/**
 * IVA para mostrar el desglose antes de pagar. Debe coincidir con el secret
 * PAGOMEDIOS_TAX_RATE de la Edge Function, que es la que arma el cobro real.
 */
export const ONLINE_PAYMENT_TAX_RATE = 0.15

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

const PENDING_PAYMENT_KEY = 'zonacero.pendingOnlinePayment'
const PENDING_PAYMENT_TTL_MS = 60 * 60 * 1000

/**
 * Recuerda el pago en curso por si la app se recarga mientras el socio paga
 * (Android puede recrear la vista): al volver se retoma la verificación.
 */
export function rememberPendingPayment(paymentId: string): void {
  try {
    localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({ paymentId, at: Date.now() }))
  } catch {
    // sin almacenamiento: el socio verifica desde Mi Plan
  }
}

/** Devuelve (y olvida) el pago en curso si es de la última hora. */
export function takePendingPayment(): string | null {
  try {
    const raw = localStorage.getItem(PENDING_PAYMENT_KEY)
    localStorage.removeItem(PENDING_PAYMENT_KEY)
    if (!raw) return null
    const { paymentId, at } = JSON.parse(raw) as { paymentId?: string; at?: number }
    return paymentId && at && Date.now() - at < PENDING_PAYMENT_TTL_MS ? paymentId : null
  } catch {
    return null
  }
}

/**
 * Avisa cuando se cierra la pantalla de pago nativa. Sirve para verificar aunque
 * la app se haya recargado mientras estaba abierta. Devuelve cómo dejar de escuchar.
 */
export async function onPaymentScreenClosed(callback: () => void): Promise<() => void> {
  if (!isNativeApp()) return () => undefined
  const { InAppBrowser } = await import('@capgo/inappbrowser')
  const handle = await InAppBrowser.addListener('closeEvent', () => callback())
  return () => void handle.remove()
}

/** El proveedor devuelve al socio a la Edge Function (notify): el pago terminó. */
export function isPaymentReturnUrl(url: string): boolean {
  return /[?&]action=notify(&|$)/.test(url)
}

/**
 * Abre el formulario de pago del proveedor.
 * Web: la pestaña navega al formulario y el proveedor la devuelve a la app.
 * Nativa: pantalla dentro de la app (WebView con barra propia). Cuando el
 * proveedor devuelve al socio, la pantalla se cierra sola; si el socio la cierra
 * antes, también. En ambos casos se llama onClosed una vez para verificar el pago.
 */
export async function openPaymentPage(url: string, onClosed: () => void): Promise<void> {
  if (!isNativeApp()) {
    window.location.assign(url)
    return
  }
  const { InAppBrowser, ToolBarType } = await import('@capgo/inappbrowser')
  const handles: { remove: () => Promise<void> }[] = []
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    for (const handle of handles) void handle.remove()
    onClosed()
  }
  handles.push(
    await InAppBrowser.addListener('urlChangeEvent', ({ url: current }) => {
      if (!isPaymentReturnUrl(current)) return
      void InAppBrowser.close().catch(() => undefined)
      finish()
    }),
    await InAppBrowser.addListener('closeEvent', finish),
  )
  await InAppBrowser.openWebView({
    url,
    title: 'Pago seguro · Pagomedios',
    toolbarType: ToolBarType.COMPACT,
    toolbarColor: '#1c1917',
    toolbarTextColor: '#ffffff',
    showReloadButton: false,
  })
}
