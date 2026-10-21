import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.reservasgym.zonacero',
  appName: 'Zona Cero',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Android 16 dibuja la app detrás de la barra de estado y la de gestos. En
    // WebViews viejos Capacitor rellena esos márgenes; en los nuevos los informa
    // por env(safe-area-inset-*), que ya usa index.css.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
}

export default config

