import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url))

// Precarga los pesos de IBM Plex Sans más usados: sin esto el texto se dibuja con la
// fuente de respaldo y salta al llegar la definitiva (CLS por "web font").
function preloadFonts(): Plugin {
  let base = '/'
  return {
    name: 'zc-preload-fonts',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return []
        return Object.keys(ctx.bundle)
          .filter((file) => /ibm-plex-sans-latin-(400|600|700)-normal-.*\.woff2$/.test(file))
          .map((file) => ({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `${base}${file}`, crossorigin: '' },
            injectTo: 'head' as const,
          }))
      },
    },
  }
}

// Capacitor needs relative asset paths; web hosting needs absolute base (`/` or `/repo/`).
export default defineConfig(({ mode }) => ({
  base: mode === 'capacitor' ? './' : (process.env.VITE_BASE_PATH || '/'),
  plugins: [react(), tailwindcss(), preloadFonts()],
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
