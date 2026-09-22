import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.reservasgym.zonacero',
  appName: 'Zona Cero',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config

