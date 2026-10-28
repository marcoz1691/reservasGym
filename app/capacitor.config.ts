import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.reservasgym.zonacero',
  appName: 'Zona Cero',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      // Se oculta a mano cuando React pinta la primera pantalla; el tope evita
      // que quede fijo si algo falla al arrancar.
      launchAutoHide: false,
      launchShowDuration: 4000,
      backgroundColor: '#F6F5F2',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false,
    },
    Keyboard: {
      // iOS: el WebView se achica con el teclado para que no tape los campos.
      resize: 'body',
    },
  },
  android: {
    // Android 15 dibuja la app detrás de la barra de estado y la de gestos; el
    // WebView no informa esos márgenes, así que Capacitor los aplica.
    adjustMarginsForEdgeToEdge: 'auto',
  },
}

export default config

