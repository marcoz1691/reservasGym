import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas E2E contra el ambiente QA real (https://zona-cero-qa.vercel.app).
 * Cómo correrlas y qué variables necesitan: e2e/README.md.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  // Comparten cuentas y datos de QA: una prueba a la vez.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  outputDir: 'results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://zona-cero-qa.vercel.app',
    ...devices['iPhone 13'],
    // El perfil de iPhone trae WebKit por defecto; Chromium con viewport y user agent de iPhone.
    browserName: 'chromium',
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
