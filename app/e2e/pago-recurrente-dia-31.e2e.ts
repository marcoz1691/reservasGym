import { test, expect, type Browser, type Page } from '@playwright/test'
import { PASSWORD, login, sql } from './support/qa'
import {
  APP_URL,
  accessToken,
  callFunction,
  env,
  hasSandbox,
  pagomedios,
  registerCardOnPagomedios,
  startFunction,
  testCard,
} from './support/pagomedios'
import { splitTax } from '../supabase/functions/pagomedios-payment/tax'

/**
 * Pago recurrente, meses siguientes (ZCAPP-76). La app cobra el primer mes; el segundo
 * lo cobra Pagomedios y la app no se entera. Se simula el paso del tiempo moviendo las
 * fechas de la membresía en QA:
 *
 *  - Día 31 (en gracia): el plan venció ayer. Pagomedios cobra el mes 2 (sandbox,
 *    POST /cards/charge con la tarjeta registrada) y recepción lo registra en Cobros
 *    con «Pago recurrente Pagomedios». El plan sigue el ciclo de Pagomedios (fin anterior + 30).
 *  - Día 34 o más (gracia vencida): reservas bloqueadas. Al registrar el mes 3 el plan
 *    vuelve a quedar activo y también cuenta desde el fin anterior (recurringRenewal.ts).
 *
 * Usa un socio propio (socio.recurrente@zonacero.test) que se crea si no existe.
 * La app de esta rama debe correr contra QA (E2E_BASE_URL, p. ej. vite --mode staging --port 5191).
 * Con E2E_KEEP=1 deja los pagos y la membresía del socio para verlos en QA.
 */
test.describe.configure({ mode: 'serial' })
test.skip(!hasSandbox, 'Falta app/.env.pagomedios.local (token de pruebas de Pagomedios)')
test.skip(!process.env.E2E_ADMIN_PASSWORD, 'Falta E2E_ADMIN_PASSWORD (Cobros lo registra el admin)')

const SOCIO = { email: 'socio.recurrente@zonacero.test', name: 'Socio Recurrente QA' }
const ADMIN = 'admin.staging@zonacero.test'
const PLAN = { id: 'c1000000-0000-4000-8000-000000000030', name: 'Zero Start Mensual', cents: 1500, days: 30 }
const BILLING = { document: '1723456784', documentType: '05', phone: '0987569852', address: 'Av. Amazonas, Quito' }
const DAY = 24 * 60 * 60 * 1000
const TAX_RATE = Number(env.PAGOMEDIOS_TAX_RATE ?? '0.15')

type Membership = { id: string; status: string; starts_at: string; ends_at: string; grace_ends_at: string }
type FlagRow = { online_payments_enabled: boolean; recurring_payments_enabled: boolean }

let socioId = ''
let sessionId = ''
let flagsSnapshot: FlagRow | undefined
let cardsBefore: Set<string> | null = null
let fn: Awaited<ReturnType<typeof startFunction>>

const membership = async () =>
  (await sql<Membership>(
    `select id, status, starts_at, ends_at, grace_ends_at from memberships where user_id = '${socioId}' order by ends_at desc limit 1`,
  ))[0]!
const ms = (iso: string) => new Date(iso).getTime()

/** Mueve el reloj de la membresía: equivale a que hayan pasado `days` días. */
const travel = (days: number) =>
  sql(`update memberships set starts_at = starts_at - interval '${days} days',
    ends_at = ends_at - interval '${days} days', grace_ends_at = grace_ends_at - interval '${days} days'
    where user_id = '${socioId}';
    update payments set created_at = created_at - interval '${days} days',
    approved_at = approved_at - interval '${days} days' where user_id = '${socioId}'`)

/** Motivo por el que la app no deja reservar la clase (null = puede reservar). */
const blockReason = async () =>
  (await sql<{ reason: string | null }>(
    `select public.member_booking_block_reason('${socioId}', zone_id, starts_at) reason from sessions where id = '${sessionId}'`,
  ))[0]!.reason

const cards = async () =>
  ((await pagomedios(`/cards?integration=true&document=${BILLING.document}`)).body?.data?.[0]?.cards ?? []) as {
    token: string
  }[]

/** Lo que hace Pagomedios cada mes por su cuenta: cobra a la tarjeta registrada. */
async function pagomediosChargesMonth(month: number) {
  const [card] = await cards()
  expect(card, 'la tarjeta registrada sigue en Pagomedios').toBeTruthy()
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
  expect(Number(data?.status), `cobro del mes ${month} en el sandbox: ${JSON.stringify(r.body)}`).toBe(1)
  return String(data.authorizationCode)
}

async function newPage(browser: Browser, email: string, password: string) {
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL,
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
    viewport: { width: 1280, height: 900 },
  })
  const page = await context.newPage()
  await login(page, email, password)
  return page
}

/** Recepción registra en Cobros el cobro que vio aprobado en el panel de Pagomedios. */
async function receptionRegisters(admin: Page, reference: string) {
  await admin.goto('/admin/cobros')
  await admin.getByPlaceholder('Buscar por nombre o correo electrónico...').fill(SOCIO.email)
  await admin.getByText(SOCIO.name).first().click()
  await expect(admin.getByText(/Cambiar socio/i)).toBeVisible()
  await admin.getByText(PLAN.name).first().click()
  await admin.getByText('Pago recurrente Pagomedios').click()
  await expect(admin.getByRole('note')).toContainText('hasta 24 horas')
  await admin.getByLabel(/Referencia \/ # Voucher/).fill(reference)
  await admin.getByRole('button', { name: /Confirmar Cobro y Activar Membresía/ }).click()
  await expect(admin.getByText(/Cobro Registrado y Membresía Activada/i)).toBeVisible()
}

async function bannerType(socio: Page) {
  await socio.goto('/')
  await socio.getByRole('heading', { level: 1, name: /^Buen/ }).waitFor()
  await socio.getByRole('link', { name: /^Tu membresía/ }).waitFor()
  const banner = socio.getByTestId('expiry-banner')
  return (await banner.count()) ? banner.getAttribute('data-banner-type') : null
}

test.beforeAll(async () => {
  const [existing] = await sql<{ id: string }>(`select id from profiles where email = '${SOCIO.email}'`)
  if (existing) {
    socioId = existing.id
  } else {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: SOCIO.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: SOCIO.name } }),
    })
    const body = (await res.json()) as { id?: string }
    if (!body.id) throw new Error(`No se pudo crear el socio de prueba: ${JSON.stringify(body)}`)
    socioId = body.id
  }
  // Con la ficha técnica completa la app no lo manda a /bienvenida.
  await sql(`update profiles set height_cm = 172, initial_weight_kg = 75, birth_date = '1995-05-10',
    residence = 'Quito' where id = '${socioId}' and height_cm is null`)
  // Cada corrida empieza sin plan: el socio es solo de esta prueba.
  await sql(`delete from payments where user_id = '${socioId}'; delete from memberships where user_id = '${socioId}'`)
  flagsSnapshot = (await sql<FlagRow>(`select online_payments_enabled, recurring_payments_enabled from gym_settings where id = 1`))[0]
  await sql(`update gym_settings set online_payments_enabled = true, recurring_payments_enabled = true where id = 1`)
  cardsBefore = new Set((await cards()).map((c) => c.token))
  fn = await startFunction()
})

test.afterAll(async () => {
  fn?.kill()
  if (flagsSnapshot) {
    await sql(`update gym_settings set online_payments_enabled = ${flagsSnapshot.online_payments_enabled},
      recurring_payments_enabled = ${flagsSnapshot.recurring_payments_enabled} where id = 1`)
  }
  if (process.env.E2E_KEEP || !socioId) return
  const before = cardsBefore
  for (const card of before ? (await cards()).filter((c) => !before.has(c.token)) : []) {
    await pagomedios(`/cards/${card.token}`, { method: 'DELETE' })
  }
  await sql(`delete from payments where user_id = '${socioId}'; delete from memberships where user_id = '${socioId}'`)
})

test('pago recurrente: día 1, día 31 en gracia y día 34 con la gracia vencida', async ({ page, browser }) => {
  test.setTimeout(600_000)
  const card = testCard('Visa')
  test.skip(!card, 'Faltan los datos de la tarjeta Visa de prueba')
  const socioJwt = await accessToken(SOCIO.email, PASSWORD)

  await test.step('día 1: el socio registra la tarjeta y la app cobra el primer mes', async () => {
    const r = await callFunction({ action: 'create', planId: PLAN.id, ...BILLING, recurring: true }, socioJwt)
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    const returned: string[] = []
    page.on('request', (req) => {
      if (req.isNavigationRequest() && req.url().startsWith(APP_URL)) returned.push(req.url())
    })
    await page.route(`${APP_URL}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>app</p>' }))
    await registerCardOnPagomedios(page, r.body.url, 'Visa', card!)
    await expect.poll(() => returned.length, { timeout: 120_000 }).toBeGreaterThan(0)

    const [pay] = await sql<{ status: string; mp_payment_id: string | null }>(
      `select status, mp_payment_id from payments where id = '${r.body.paymentId}'`,
    )
    expect(pay).toMatchObject({ status: 'approved' })
    const m = await membership()
    expect(m.status).toBe('active')
    expect((ms(m.ends_at) - Date.now()) / DAY).toBeGreaterThan(PLAN.days - 0.1)
  })

  await test.step('el socio puede reservar una clase', async () => {
    const sessions = await sql<{ id: string; reason: string | null }>(
      `select id, public.member_booking_block_reason('${socioId}', zone_id, starts_at) reason
       from sessions where starts_at > now() + interval '2 hours' and starts_at < now() + interval '2 days'
       order by starts_at limit 20`,
    )
    const open = sessions.find((s) => s.reason === null)
    expect(open, `alguna clase reservable en las próximas 48 h: ${JSON.stringify(sessions)}`).toBeTruthy()
    sessionId = open!.id
  })

  const socio = await newPage(browser, SOCIO.email, PASSWORD)
  const admin = await newPage(browser, ADMIN, process.env.E2E_ADMIN_PASSWORD!)

  // ── Día 31 ──
  let endMonth1 = ''
  await test.step('día 31: el plan venció ayer y el socio está en gracia', async () => {
    await travel(31)
    const m = await membership()
    endMonth1 = m.ends_at
    expect(ms(m.ends_at)).toBeLessThan(Date.now())
    expect(ms(m.grace_ends_at)).toBeGreaterThan(Date.now())
    expect(await bannerType(socio)).toBe('grace')
    await expect(socio.getByText(/Período de gracia/)).toBeVisible()
    expect(await blockReason()).toBeNull()
  })

  let code2 = ''
  await test.step('Pagomedios cobra el mes 2 a la tarjeta registrada y la app no se entera', async () => {
    code2 = await pagomediosChargesMonth(2)
    expect((await membership()).ends_at).toBe(endMonth1)
  })

  await test.step('recepción lo registra en Cobros con «Pago recurrente Pagomedios»', async () => {
    await receptionRegisters(admin, code2)
    const [pay] = await sql<{ provider: string; manual_method: string; reference: string; status: string; amount_cents: number }>(
      `select provider, manual_method, reference, status, amount_cents from payments
       where user_id = '${socioId}' and provider = 'manual' order by created_at desc limit 1`,
    )
    expect(pay).toMatchObject({ provider: 'manual', manual_method: 'pagomedios_recurring', reference: code2, status: 'approved', amount_cents: PLAN.cents })
  })

  await test.step('el plan sigue el ciclo de Pagomedios: fin anterior + 30 días, sin regalar los días de atraso', async () => {
    const m = await membership()
    expect(m.status).toBe('active')
    expect((ms(m.ends_at) - ms(endMonth1)) / DAY).toBeCloseTo(PLAN.days, 3)
    expect(await bannerType(socio)).toBeNull()
    expect(await blockReason()).toBeNull()
  })

  await test.step('el historial lo suma y lo filtra como «Pago recurrente»', async () => {
    await admin.goto('/admin/cobros')
    await admin.getByText(/Historial General de Cobros/i).click()
    await admin.getByRole('button', { name: 'Pago recurrente', exact: true }).click()
    await expect(admin.getByText(code2)).toBeVisible()
  })

  // ── Día 34 o más: recepción no renovó a tiempo ──
  let code3 = ''
  let endMonth2 = ''
  await test.step('día 34 del mes 2: gracia vencida, el socio no puede reservar', async () => {
    // Del día 31 del mes 1 al día 34 del mes 2 pasan 33 días.
    await travel(33)
    const m = await membership()
    endMonth2 = m.ends_at
    expect(ms(m.grace_ends_at)).toBeLessThan(Date.now())
    expect(await blockReason()).not.toBeNull()
    expect(await bannerType(socio)).toBe('expired')
  })

  await test.step('Pagomedios cobró el mes 3 y recepción lo registra tarde', async () => {
    code3 = await pagomediosChargesMonth(3)
    await receptionRegisters(admin, code3)
  })

  await test.step('vuelve a estar activo y también sigue el ciclo: fin anterior + 30 días', async () => {
    const m = await membership()
    expect(m.status).toBe('active')
    expect((ms(m.ends_at) - ms(endMonth2)) / DAY).toBeCloseTo(PLAN.days, 3)
    expect(await blockReason()).toBeNull()
    expect(await bannerType(socio)).toBeNull()
  })

  await socio.context().close()
  await admin.context().close()
})
