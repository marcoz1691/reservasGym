import { useSearchParams } from 'react-router-dom'
import { DatafastCheckoutPage } from './DatafastCheckoutPage'
import { PagomediosCheckoutPage } from './PagomediosCheckoutPage'
import { getOnlinePayProvider } from './onlinePay'

export function OnlineCheckoutPage() {
  const [searchParams] = useSearchParams()
  const provider =
    searchParams.get('provider') === 'pagomedios' ? 'pagomedios' : getOnlinePayProvider()
  return provider === 'pagomedios' ? <PagomediosCheckoutPage /> : <DatafastCheckoutPage />
}
