import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

/**
 * Integración real con el sandbox de Pagomedios. Lee la configuración local
 * (git la ignora) y levanta la Edge Function con Deno en localhost:8000.
 * Nunca imprime el token ni los datos de las tarjetas.
 */
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const PAGOMEDIOS_API = 'https://api.abitmedia.cloud/pagomedios/v2'
export const FN_URL = 'http://localhost:8000'
/** El retorno de Pagomedios redirige aquí; la prueba lo intercepta, no hace falta la app. */
export const APP_URL = 'http://localhost:5173'

function readEnvFile(file: string): Record<string, string> {
  const path = join(APP_DIR, file)
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1]!, m[2]!.trim().replace(/^["']|["']$/g, '')]),
  )
}

export const env = { ...readEnvFile('.env.pagomedios.local'), ...process.env } as Record<
  string,
  string | undefined
>

export const hasSandbox = Boolean(
  env.PAGOMEDIOS_TOKEN && env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY,
)

export type TestCard = { number: string; holder: string; month: string; year: string; cvv: string }

/** Tarjetas de prueba de Pagomedios: variables PAGOMEDIOS_<MARCA>_* o las notas de .env.local. */
export function testCard(brand: 'Visa' | 'Mastercard'): TestCard | null {
  const key = brand.toUpperCase()
  if (env[`PAGOMEDIOS_${key}_NUMBER`]) {
    return {
      number: env[`PAGOMEDIOS_${key}_NUMBER`]!,
      holder: env[`PAGOMEDIOS_${key}_HOLDER`] ?? 'Prueba',
      month: env[`PAGOMEDIOS_${key}_MONTH`] ?? '',
      year: env[`PAGOMEDIOS_${key}_YEAR`] ?? '',
      cvv: env[`PAGOMEDIOS_${key}_CVV`] ?? '',
    }
  }
  const path = join(APP_DIR, '.env.local')
  if (!existsSync(path)) return null
  const text = readFileSync(path, 'utf8').replace(/^#\s*/gm, '')
  const block = text.split(new RegExp(`^${brand}:`, 'm'))[1]
  if (!block) return null
  const number = block.match(/Numero de tarjeta:\s*([\d ]+)/)?.[1]?.replace(/\s/g, '')
  const holder = block.match(/Nombre tarjeta:\s*(.+)/)?.[1]?.trim()
  const exp = block.match(/(?:Expira|Fecha de expiracion):\s*(\d\d)\/(\d\d)/)
  const cvv = block.match(/CVV:\s*(\d+)/)?.[1]
  if (!number || !holder || !exp || !cvv) return null
  return { number, holder, month: exp[1]!, year: exp[2]!, cvv }
}

/** Llamada directa a la API de Pagomedios con el token de pruebas. */
export async function pagomedios(path: string, init: RequestInit = {}, token = env.PAGOMEDIOS_TOKEN) {
  const res = await fetch(`${PAGOMEDIOS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  return { status: res.status, body: (await res.json().catch(() => null)) as any }
}

/** Sesión real de Supabase (QA) para llamar a la función como ese usuario. */
export async function accessToken(email: string, password: string): Promise<string> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = (await res.json()) as { access_token?: string }
  if (!body.access_token) throw new Error(`No se pudo iniciar sesión como ${email}`)
  return body.access_token
}

export async function callFunction(body: Record<string, unknown>, jwt?: string) {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json().catch(() => null)) as any }
}

/** Levanta pagomedios-payment con Deno y espera a que responda. */
export async function startFunction(): Promise<ChildProcess> {
  const busy = await fetch(FN_URL, { method: 'OPTIONS' }).then(() => true).catch(() => false)
  if (busy) {
    throw new Error(
      'El puerto 8000 está ocupado (¿npm run pagomedios:fn corriendo?). Deténlo antes de estas pruebas.',
    )
  }
  const child = spawn(
    'deno',
    ['run', '--allow-net', '--allow-env', '--allow-read', 'supabase/functions/pagomedios-payment/index.ts'],
    {
      cwd: APP_DIR,
      env: {
        ...process.env,
        DENO_NO_PACKAGE_JSON: '1',
        PAGOMEDIOS_TOKEN: env.PAGOMEDIOS_TOKEN,
        SUPABASE_URL: env.SUPABASE_URL,
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
        PAGOMEDIOS_TAX_RATE: env.PAGOMEDIOS_TAX_RATE ?? '0.15',
        APP_URL,
        FUNCTION_PUBLIC_URL: FN_URL,
      },
      stdio: 'ignore',
    },
  )
  for (let i = 0; i < 60; i++) {
    const up = await fetch(FN_URL, { method: 'OPTIONS' }).then(() => true).catch(() => false)
    if (up) return child
    await new Promise((r) => setTimeout(r, 500))
  }
  child.kill()
  throw new Error('La función pagomedios-payment no arrancó en 30 s')
}

/**
 * Paga en el formulario real de Pagomedios con una tarjeta de prueba.
 * Deja al navegador en el retorno (notify → APP_URL), que la prueba intercepta.
 */
export async function payOnPagomedios(page: Page, url: string, brand: 'Visa' | 'Mastercard', card: TestCard) {
  await page.goto(url)
  await page.locator(`img[src*="${brand.toLowerCase()}.png"]`).first().click()
  // Con tarjetas guardadas para esta cédula, primero muestra esas; el botón aparece después.
  const form = page.locator('form.wpwl-form-card')
  const otherMethods = page.getByRole('button', { name: /mostrar otros medios/i })
  await Promise.race([
    otherMethods.waitFor({ state: 'visible', timeout: 15_000 }),
    form.waitFor({ state: 'visible', timeout: 15_000 }),
  ]).catch(() => undefined)
  if (await otherMethods.isVisible()) await otherMethods.click()
  await form.waitFor({ state: 'visible' })
  const bank = form.locator('select').filter({ hasText: /seleccione banco/i })
  // El banco solo aparece con algunas marcas.
  if (await bank.isVisible().catch(() => false)) await bank.selectOption({ index: 1 })
  await form.frameLocator('iframe[name="card.number"]').locator('input[name="card.number"]')
    .pressSequentially(card.number, { delay: 20 })
  await form.locator('input[name="card.holder"]').fill(card.holder)
  await form.locator('input[placeholder="MM / YY"]').pressSequentially(`${card.month}${card.year}`)
  await form.frameLocator('iframe[name="card.cvv"]').locator('input[name="card.cvv"]')
    .pressSequentially(card.cvv, { delay: 20 })
  await form.getByRole('button', { name: /pagar/i }).click()
}
