import { Capacitor } from '@capacitor/core'

/** Dominio público de la app: en la app nativa los PDF locales se abren desde aquí. */
const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ?? 'https://app.zonaceroperformance.com'

/** En la app nativa, una ruta local ("/legal/x.pdf") se convierte en la URL pública. */
export function absoluteDocumentUrl(url: string): string {
  return url.startsWith('/') ? `${PUBLIC_APP_URL}${url}` : url
}

/**
 * Abre un PDF para leerlo, imprimirlo o guardarlo.
 * Web: pestaña nueva (el navegador ofrece imprimir y descargar).
 * Nativa: ventana dentro de la app con botón para cerrar y compartir
 * (desde compartir se imprime o se guarda en Archivos). Así el socio nunca
 * queda atrapado en el PDF sin poder volver.
 */
export async function openPdfDocument(url: string, title: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || url.startsWith('data:')) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  const { InAppBrowser, ToolBarType } = await import('@capgo/inappbrowser')
  await InAppBrowser.openWebView({
    url: absoluteDocumentUrl(url),
    title,
    toolbarType: ToolBarType.ACTIVITY,
    shareSubject: title,
    toolbarColor: '#1c1917',
    toolbarTextColor: '#ffffff',
    showReloadButton: false,
  })
}
