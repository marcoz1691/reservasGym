import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.reservasgym.zonacero',
  appName: 'Zona Cero',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    // Android 15 dibuja la app detrás de la barra de estado y la de gestos; el
    // WebView no informa esos márgenes, así que Capacitor los aplica.
    adjustMarginsForEdgeToEdge: 'auto',
  },
}

export default config

