import { test, expect, type Browser, type Page } from '@playwright/test'
import fs from 'node:fs'
import { PASSWORD, login, sql } from './support/qa'
import { env, hasSandbox, pagomedios, registerCardOnPagomedios, startFunction, testCard } from './support/pagomedios'
import { splitTax } from '../supabase/functions/pagomedios-payment/tax'

/**
 * Capturas del pago recurrente para el informe al cliente (ZCAPP-76): lo que hace el socio
 * y lo que hace recepción, del día 1 al día 34. Mismo escenario que pago-recurrente-dia-31,
 * pero el socio paga desde la app. Solo corre con E2E_SHOTS=<carpeta>.
 *
 * Necesita la app de esta rama contra QA llamando a la función local:
 *   VITE_FUNCTIONS_URL=http://localhost:8200 npx vite --mode staging --port 5191
 *   E2E_SHOTS=… E2E_FN_PORT=8200 E2E_APP_URL=http://localhost:5191 E2E_BASE_URL=http://localhost:5191
 * Deja al socio con sus pagos para revisarlos en QA.
 */
const OUT = process.env.E2E_SHOTS ?? ''
test.skip(!OUT, 'Solo para generar capturas (E2E_SHOTS)')
test.skip(!hasSandbox, 'Falta app/.env.pagomedios.local')
test.skip(!process.env.E2E_ADMIN_PASSWORD, 'Falta E2E_ADMIN_PASSWORD')

const SOCIO = { email: 'socio.recurrente@zonacero.test', name: 'Socio Recurrente QA' }
const ADMIN = 'admin.staging@zonacero.test'
const PLAN = { id: 'c1000000-0000-4000-8000-000000000030', name: 'Zero Start Mensual', cents: 1500 }
const BILLING = { document: '1723456784', phone: '0987569852', address: 'Av. Amazonas, Quito' }
const TAX_RATE = Number(env.PAGOMEDIOS_TAX_RATE ?? '0.15')

let socioId = ''
let flags: { online_payments_enabled: boolean; recurring_payments_enabled: boolean } | undefined
let fn: Awaited<ReturnType<typeof startFunction>>

const cards = async () =>
  ((await pagomedios(`/cards?integration=true&document=${BILLING.document}`)).body?.data?.[0]?.cards ?? []) as { token: string }[]

async function shot(page: Page, name: string, fullPage = true) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
}

const travel = (days: number) =>
  sql(`update memberships set starts_at = starts_at - interval '${days} days',
    ends_at = ends_at - interval '${days} days', grace_ends_at = grace_ends_at - interval '${days} days'
    where user_id = '${socioId}';
    update payments set created_at = created_at - interval '${days} days',
    approved_at = approved_at - interval '${days} days' where user_id = '${socioId}'`)

async function pagomediosCharges(month: number) {
  const [card] = await cards()
  const r = await pagomedios('/cards/charge', {
    method: 'POST',
    body: JSON.stringify({
      integration: true,
      document: BILLING.document,
      token: card!.token,
      reference: `ZCQA${Date.now()}`,
      description: `Zona Cero - ${PLAN.name} (mes ${month})`,
      ...splitTax(PLAN.cents, TAX_RATE),
      generate_invoice: 0,
    }),
  })
  const data = Array.isArray(r.body?.data) ? r.body.data[0] : r.body?.data
  expect(Number(data?.status)).toBe(1)
  return String(data.authorizationCode)
}

async function open(browser: Browser, email: string, password: string, phone: boolean) {
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL,
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
    viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 860 },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
  })
  const page = await context.newPage()
  await login(page, email, password)
  return page
}

async function home(socio: Page) {
  await socio.goto('/')
  await socio.getByRole('link', { name: /^Tu membresía/ }).waitFor()
}

async function registerInCobros(admin: Page, reference: string, shots: boolean) {
  await admin.goto('/admin/cobros')
  await admin.getByPlaceholder('Buscar por nombre o correo electrónico...').fill(SOCIO.email)
  await admin.getByText(SOCIO.name).first().click()
  await expect(admin.getByText(/Cambiar socio/i)).toBeVisible()
  if (shots) await shot(admin, 'A02-socio-en-gracia', false)
  await admin.getByText(PLAN.name).first().click()
  await admin.getByText('Pago recurrente Pagomedios').click()
  await admin.getByLabel(/Referencia \/ # Voucher/).fill(reference)
  if (shots) {
    await admin.getByRole('note').scrollIntoViewIfNeeded()
    await shot(admin, 'A03-registrar-pago-recurrente', false)
  }
  await admin.getByRole('button', { name: /Confirmar Cobro y Activar Membresía/ }).click()
  await expect(admin.getByText(/Cobro Registrado y Membresía Activada/i)).toBeVisible()
  if (shots) await shot(admin, 'A04-cobro-registrado', false)
}

test.beforeAll(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  socioId = (await sql<{ id: string }>(`select id from profiles where email = '${SOCIO.email}'`))[0]!.id
  await sql(`delete from payments where user_id = '${socioId}'; delete from memberships where user_id = '${socioId}'`)
  for (const card of await cards()) await pagomedios(`/cards/${card.token}`, { method: 'DELETE' })
  flags = (await sql<NonNullable<typeof flags>>(`select online_payments_enabled, recurring_payments_enabled from gym_settings where id = 1`))[0]
  await sql(`update gym_settings set online_payments_enabled = true, recurring_payments_enabled = true where id = 1`)
  fn = await startFunction()
})

test.afterAll(async () => {
  fn?.kill()
  if (flags) {
    await sql(`update gym_settings set online_payments_enabled = ${flags.online_payments_enabled},
      recurring_payments_enabled = ${flags.recurring_payments_enabled} where id = 1`)
  }
})

test('capturas: socio y recepción con el pago recurrente', async ({ browser }) => {
  test.setTimeout(600_000)
  const admin = await open(browser, ADMIN, process.env.E2E_ADMIN_PASSWORD!, false)
  await admin.goto('/admin/marca')
  const toggle = admin.getByRole('switch', { name: 'Pago recurrente mensual' })
  await toggle.scrollIntoViewIfNeeded()
  await shot(admin, 'A01-interruptor-pago-recurrente', false)

  // ── Día 1: el socio compra su plan con pago recurrente ──
  const socio = await open(browser, SOCIO.email, PASSWORD, true)
  await socio.goto('/membresia')
  await socio.getByRole('tab', { name: 'Zero Start' }).click().catch(() => undefined)
  await shot(socio, 'S01-mi-plan', false)
  await socio.locator('button:enabled').filter({ hasText: /^(Elegir este plan|Elegir plan)$/ }).first().click()
  await socio.getByRole('radio', { name: /Pago recurrente con tarjeta/ }).click()
  await socio.getByLabel('Número de identificación').fill(BILLING.document)
  await socio.getByLabel('Celular').fill(BILLING.phone)
  await socio.getByLabel('Dirección').fill(BILLING.address)
  await socio.getByRole('checkbox', { name: /Acepto los términos/ }).check()
  await shot(socio, 'S02-checkout-pago-recurrente')
  await socio.getByRole('button', { name: /Registrar tarjeta y pagar/ }).click()
  await socio.waitForURL(/payurl\.link/, { timeout: 30_000 })
  await registerCardOnPagomedios(socio, socio.url(), 'Visa', testCard('Visa')!, () => shot(socio, 'S03-pagomedios-registrar-tarjeta'))
  await socio.waitForURL(/5191\/membresia\/pago\?provider=pagomedios/, { timeout: 120_000 })
  await expect(socio.getByText(/Tu tarjeta quedó registrada/)).toBeVisible({ timeout: 60_000 })
  await shot(socio, 'S04-comprobante')
  await home(socio)
  await shot(socio, 'S05-inicio-plan-activo', false)

  // ── Día 31: venció ayer, Pagomedios cobra el mes 2 ──
  await travel(31)
  await home(socio)
  await shot(socio, 'S06-dia-31-periodo-de-gracia', false)
  const code2 = await pagomediosCharges(2)
  await registerInCobros(admin, code2, true)
  await admin.goto('/admin/cobros')
  await admin.getByText(/Historial General de Cobros/i).click()
  await admin.getByRole('button', { name: 'Pago recurrente', exact: true }).click()
  await expect(admin.getByText(code2)).toBeVisible()
  await shot(admin, 'A05-historial-pago-recurrente', false)
  await home(socio)
  await shot(socio, 'S07-renovado', false)
  await socio.goto('/membresia')
  await socio.getByText(PLAN.name).first().waitFor()
  await shot(socio, 'S08-mi-plan-renovado', false)

  // ── Día 34 del mes 2: recepción no registró a tiempo ──
  await travel(33)
  await home(socio)
  await shot(socio, 'S09-dia-34-vencido', false)
  const code3 = await pagomediosCharges(3)
  await registerInCobros(admin, code3, false)
  await home(socio)
  await shot(socio, 'S10-reactivado', false)

  const rows = await sql(`select p.provider, p.manual_method, coalesce(p.reference, p.mp_payment_id) ref,
    to_char(p.approved_at at time zone 'America/Guayaquil', 'DD/MM/YYYY') aprobado,
    to_char(m.ends_at at time zone 'America/Guayaquil', 'DD/MM/YYYY') vence
    from payments p join memberships m on m.id = p.membership_id where p.user_id = '${socioId}' order by p.approved_at`)
  const [end] = await sql(`select to_char(starts_at at time zone 'America/Guayaquil', 'DD/MM/YYYY') desde,
    to_char(ends_at at time zone 'America/Guayaquil', 'DD/MM/YYYY') hasta from memberships where user_id = '${socioId}' order by ends_at desc limit 1`)
  fs.writeFileSync(`${OUT}/datos.json`, JSON.stringify({ pagos: rows, membresia: end, codigos: { mes2: code2, mes3: code3 } }, null, 2))
  await socio.context().close()
  await admin.context().close()
})
