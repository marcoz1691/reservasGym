import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // Puertos Zona Cero (no chocan con MIA u otros en 5173)
    port: mode === 'staging' ? 5190 : 5180,
    strictPort: true,
    // Permite servir a través de un túnel (localtunnel / cloudflare) al probar
    // en dispositivos móviles. Opt-in vía env para no relajarlo por defecto.
    allowedHosts: process.env.VITE_TUNNEL ? true : undefined,
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 15000,
  },
}))
