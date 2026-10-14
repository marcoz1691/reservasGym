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
/** Puerto de la función; `E2E_FN_PORT` permite usar otro si el 8000 está ocupado. */
export const FN_PORT = process.env.E2E_FN_PORT ?? '8000'
export const FN_URL = `http://localhost:${FN_PORT}`
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
        DENO_SERVE_ADDRESS: `tcp:0.0.0.0:${FN_PORT}`,
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
 * Llena los datos de una tarjeta nueva en el formulario de Pagomedios (pago único o
 * registro) y lo envía. El número y el CVV viven en iframes que cargan aparte: se espera
 * a que el número quede escrito antes de seguir.
 */
async function fillCardForm(page: Page, card: TestCard) {
  const number = page.frameLocator('iframe[name="card.number"]').getByRole('textbox')
  for (let attempt = 0; attempt < 3; attempt++) {
    await number.click()
    await number.fill('')
    await number.pressSequentially(card.number, { delay: 30 })
    if ((await number.inputValue()).replace(/\D/g, '') === card.number) break
  }
  await page.getByRole('textbox', { name: 'Nombre en tarjeta' }).fill(card.holder)
  await page.getByRole('textbox', { name: 'Expira' }).pressSequentially(`${card.month}${card.year}`)
  // Con tarjetas guardadas cada una trae su CVV: el de la tarjeta nueva es el último.
  await page.locator('iframe[name="card.cvv"]').last().contentFrame().getByRole('textbox')
    .pressSequentially(card.cvv, { delay: 20 })
  // El botón muestra "Pagar $X" o "Registrar tarjeta"; su nombre accesible es "Pagar".
  // Con tarjetas guardadas hay otro "Pagar" arriba: el de la tarjeta nueva es el último.
  await page.getByRole('button', { name: 'Pagar', exact: true }).last().click()
  // El pago único pide aceptar políticas y condiciones en un modal antes de cobrar.
  // No siempre es un <button> accesible: se busca el texto en la página y sus iframes.
  for (let i = 0; i < 20; i++) {
    for (const frame of page.frames()) {
      const proceed = frame.getByText('Continuar con el pago', { exact: true })
      if (await proceed.isVisible().catch(() => false)) {
        await proceed.click()
        return
      }
    }
    await page.waitForTimeout(500)
  }
}

/**
 * Paga en el formulario real de Pagomedios con una tarjeta de prueba nueva.
 * Con tarjetas guardadas para esa cédula, primero las muestra: se elige "otra tarjeta".
 * Deja al navegador en el retorno (notify → APP_URL), que la prueba intercepta.
 */
export async function payOnPagomedios(page: Page, url: string, brand: 'Visa' | 'Mastercard', card: TestCard) {
  await page.goto(url)
  await page.getByRole('button', { name: new RegExp(`^${brand}$`, 'i') }).first().click()
  const otherCard = page.getByRole('button', { name: /pagar con otra tarjeta/i })
  if (await otherCard.isVisible({ timeout: 5_000 }).catch(() => false)) await otherCard.click()
  await fillCardForm(page, card)
}

/**
 * Registra una tarjeta de prueba en el formulario "Registrar tarjeta" de Pagomedios
 * (POST /cards/register): cobra $1,15 de validación que Pagomedios reversa solo.
 */
export async function registerCardOnPagomedios(page: Page, url: string, brand: 'Visa' | 'Mastercard', card: TestCard) {
  await page.goto(url)
  await page.getByRole('button', { name: new RegExp(`^${brand}$`, 'i') }).first().click()
  await fillCardForm(page, card)
}
