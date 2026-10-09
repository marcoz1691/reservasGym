import { useSearchParams } from 'react-router-dom'
import { DatafastCheckoutPage } from './DatafastCheckoutPage'
import { PagomediosCheckoutPage } from './PagomediosCheckoutPage'
import { getOnlinePayProvider } from './onlinePay'

export function OnlineCheckoutPage() {
  const [searchParams] = useSearchParams()
  const provider =
    searchParams.get('provider') === 'pagomedios' ? 'pagomedios' : getOnlinePayProvider()
  // Pantalla completa, sin menú: la única salida es "volver"/"cerrar", que piden confirmación.
  return (
    <main
      className="h-dvh overflow-y-auto overscroll-y-contain bg-bg text-ink"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0.5rem)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {provider === 'pagomedios' ? <PagomediosCheckoutPage /> : <DatafastCheckoutPage />}
    </main>
  )
}
