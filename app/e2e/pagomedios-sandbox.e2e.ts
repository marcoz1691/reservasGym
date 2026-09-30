import { test, expect, type Page } from '@playwright/test'
import type { ChildProcess } from 'node:child_process'
import { ACCOUNTS, PASSWORD, sql, userId } from './support/qa'
import {
  APP_URL,
  FN_URL,
  accessToken,
  callFunction,
  hasSandbox,
  pagomedios,
  payOnPagomedios,
  startFunction,
  testCard,
} from './support/pagomedios'

/**
 * Integración real con el sandbox de Pagomedios (pago único).
 * - Contrato de la API v2 con el token de pruebas.
 * - Edge Function pagomedios-payment corriendo en local (Deno) contra la base de QA:
 *   crear → pagar en el formulario real → notify → membresía, idempotencia,
 *   seguridad, rechazo del sandbox y retorno de la app nativa.
 * Solo corre en local con app/.env.pagomedios.local; sin eso se salta (CI).
 * Deja la base de QA como estaba: borra los pagos y restaura la membresía.
 */
test.describe.configure({ mode: 'serial' })
test.skip(!hasSandbox, 'Falta app/.env.pagomedios.local (token de pruebas de Pagomedios)')

const PLAN_OK = { id: 'c1000000-0000-4000-8000-000000000030', cents: 1500, days: 30 } // Zero Start Mensual
const PLAN_REJECTED = { id: 'c5000000-0000-4000-8000-000000000001', cents: 200 } // $2: el sandbox rechaza
const BILLING = {
  document: '1723358400',
  documentType: '05',
  phone: '0987569852',
  address: 'Av. Amazonas, Quito',
}
const DAY = 24 * 60 * 60 * 1000

type Membership = { id: string; plan_id: string; status: string; starts_at: string; ends_at: string; grace_ends_at: string; visits_left: number | null }

let fn: ChildProcess | undefined
let socioId = ''
let socioJwt = ''
let staffJwt = ''
let snapshot: Membership[] = []
const created: string[] = []

const paymentRow = async (id: string) =>
  (await sql<{ status: string; reference: string | null; mp_payment_id: string | null; membership_id: string | null; amount_cents: number }>(
    `select status, reference, mp_payment_id, membership_id, amount_cents from payments where id = '${id}'`,
  ))[0]
const latestEnd = async () =>
  (await sql<{ ends_at: string | null }>(
    `select max(ends_at) ends_at from memberships where user_id = '${socioId}'`,
  ))[0]?.ends_at ?? null

async function create(planId: string, extra: Record<string, unknown> = {}) {
  const r = await callFunction({ action: 'create', planId, ...BILLING, ...extra }, socioJwt)
  if (r.body?.paymentId) created.push(r.body.paymentId)
  return r
}

/**
 * Registra el retorno a la app. Llega como redirect 303 desde notify, que page.route
 * no intercepta; se escucha la navegación y se responde con una página vacía.
 */
async function captureReturn(page: Page) {
  const returned: string[] = []
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.url().startsWith(APP_URL)) {
      returned.push(request.url())
    }
  })
  await page.route(`${APP_URL}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<p>app</p>' }),
  )
  return returned
}

test.beforeAll(async () => {
  socioId = await userId(ACCOUNTS.socio)
  snapshot = await sql<Membership>(
    `select id, plan_id, status, starts_at, ends_at, grace_ends_at, visits_left from memberships where user_id = '${socioId}'`,
  )
  socioJwt = await accessToken(ACCOUNTS.socio, PASSWORD)
  staffJwt = await accessToken(ACCOUNTS.staff, PASSWORD)
  fn = await startFunction()
})

test.afterAll(async () => {
  fn?.kill()
  if (created.length) {
    await sql(`delete from payments where id in (${created.map((id) => `'${id}'`).join(',')})`)
  }
  if (!socioId) return
  // Restaura la membresía del socio tal como estaba antes de pagar.
  await sql(`delete from memberships where user_id = '${socioId}'
    and id not in (${snapshot.map((m) => `'${m.id}'`).join(',') || `''`})`)
  for (const m of snapshot) {
    await sql(`update memberships set plan_id = '${m.plan_id}', status = '${m.status}',
      starts_at = '${m.starts_at}', ends_at = '${m.ends_at}', grace_ends_at = '${m.grace_ends_at}',
      visits_left = ${m.visits_left ?? 'null'} where id = '${m.id}'`)
  }
})

test.describe('Contrato con la API de Pagomedios v2', () => {
  test('el token de pruebas funciona y el comercio acepta Visa y Mastercard corriente', async () => {
    const r = await pagomedios('/settings')
    expect(r.status).toBe(200)
    expect(r.body.success).toBe(true)
    const names = (r.body.data as { name: string; type: string }[])
      .filter((s) => s.type === 'Corriente')
      .map((s) => s.name.toLowerCase())
    expect(names).toEqual(expect.arrayContaining(['visa', 'mastercard']))
  })

  test('un token inválido es rechazado', async () => {
    const r = await pagomedios('/settings', {}, 'token-invalido')
    expect([401, 403]).toContain(r.status)
  })

  test('una solicitud con montos que no cuadran es rechazada', async () => {
    const r = await pagomedios('/payment-requests', {
      method: 'POST',
      body: JSON.stringify({
        integration: true,
        third: { document: BILLING.document, document_type: '05', name: 'Prueba', email: 'qa@zonacero.test', phones: BILLING.phone, address: BILLING.address, type: 'Individual' },
        generate_invoice: 0,
        description: 'QA contrato',
        amount: 15,
        amount_with_tax: 10,
        amount_without_tax: 0,
        tax_value: 1.5,
        has_cards: 1,
      }),
    })
    expect(r.body?.success).not.toBe(true)
    expect(r.status).toBeGreaterThanOrEqual(400)
  })
})

test.describe('Edge Function pagomedios-payment + sandbox real', () => {
  test.setTimeout(240_000)

  test('validaciones: sin sesión, cédula inválida y plan inexistente no crean pagos', async () => {
    const before = (await sql<{ c: number }>(`select count(*)::int c from payments where provider = 'pagomedios'`))[0]!.c
    expect((await callFunction({ action: 'create', planId: PLAN_OK.id, ...BILLING })).status).toBe(401)
    expect((await callFunction({ action: 'create', planId: PLAN_OK.id, ...BILLING }, 'jwt-falso')).status).toBe(401)
    const badId = await create(PLAN_OK.id, { document: '12345' })
    expect(badId.status).toBe(400)
    expect(badId.body.error).toMatch(/10 dígitos/)
    expect((await create('00000000-0000-4000-8000-000000000000')).status).toBe(404)
    const after = (await sql<{ c: number }>(`select count(*)::int c from payments where provider = 'pagomedios'`))[0]!.c
    expect(after).toBe(before)
  })

  test('pago aprobado con Visa: notify activa la membresía y el comprobante cuadra', async ({ page }) => {
    const card = testCard('Visa')
    test.skip(!card, 'Faltan los datos de la tarjeta Visa de prueba')
    const endBefore = await latestEnd()

    const r = await create(PLAN_OK.id)
    expect(r.status).toBe(200)
    expect(r.body.url).toMatch(/^https:\/\/payurl\.link\//)
    const paymentId = r.body.paymentId as string

    await test.step('la solicitud existe en Pagomedios, pendiente y por el monto del plan', async () => {
      const row = await paymentRow(paymentId)
      expect(row).toMatchObject({ status: 'pending', amount_cents: PLAN_OK.cents })
      const q = await pagomedios(`/payment-requests?integration=true&uuid=${row!.reference}`)
      const request = q.body?.data?.[0]
      expect(Number(request?.status)).toBe(0)
      expect(Number(request?.amount)).toBeCloseTo(PLAN_OK.cents / 100, 2)
    })

    await test.step('verificar antes de pagar → pendiente y la membresía no cambia', async () => {
      const v = await callFunction({ action: 'verify', paymentId }, socioJwt)
      expect(v.body.status).toBe('pending')
      expect(await latestEnd()).toBe(endBefore)
    })

    const returned = await captureReturn(page)
    await test.step('el socio paga en el formulario real y vuelve a la app', async () => {
      await payOnPagomedios(page, r.body.url, 'Visa', card!)
      await expect.poll(() => returned.length, { timeout: 120_000 }).toBeGreaterThan(0)
      expect(returned[0]).toBe(`${APP_URL}/membresia/pago?provider=pagomedios&paymentId=${paymentId}`)
    })

    await test.step('el pago queda aprobado con código de autorización', async () => {
      const row = await paymentRow(paymentId)
      expect(row?.status).toBe('approved')
      expect(row?.mp_payment_id).toMatch(/^\w{4,}$/)
      expect(row?.membership_id).toBeTruthy()
    })

    await test.step('la membresía suma exactamente la duración del plan', async () => {
      const endAfter = await latestEnd()
      const base = endBefore && new Date(endBefore).getTime() > Date.now() ? new Date(endBefore).getTime() : Date.now()
      const addedDays = (new Date(endAfter!).getTime() - base) / DAY
      expect(addedDays).toBeGreaterThan(PLAN_OK.days - 0.01)
      expect(addedDays).toBeLessThan(PLAN_OK.days + 0.01)
    })

    await test.step('verify devuelve el comprobante y no vuelve a extender', async () => {
      const endAfter = await latestEnd()
      const v = await callFunction({ action: 'verify', paymentId }, socioJwt)
      expect(v.body.status).toBe('approved')
      expect(v.body.receipt).toMatchObject({
        planName: 'Zero Start Mensual',
        amountCents: PLAN_OK.cents,
        authorizationCode: (await paymentRow(paymentId))!.mp_payment_id,
      })
      expect(new Date(v.body.receipt.membershipEndsAt).getTime()).toBe(new Date(endAfter!).getTime())
      expect(await latestEnd()).toBe(endAfter)
    })

    await test.step('repetir el notify no extiende dos veces', async () => {
      const endAfter = await latestEnd()
      const replay = await fetch(`${FN_URL}/?action=notify&paymentId=${paymentId}`, {
        method: 'POST',
        body: new URLSearchParams({ status: '1', customValue: paymentId }),
        redirect: 'manual',
      })
      expect(replay.status).toBe(303)
      expect(await latestEnd()).toBe(endAfter)
    })

    await test.step('otro usuario no puede verificar este pago', async () => {
      const v = await callFunction({ action: 'verify', paymentId }, staffJwt)
      expect(v.status).toBe(403)
    })
  })

  test('un notify falsificado que dice "aprobado" no activa un pago no pagado', async () => {
    const endBefore = await latestEnd()
    const r = await create(PLAN_OK.id)
    const paymentId = r.body.paymentId as string
    const forged = await fetch(`${FN_URL}/?action=notify&paymentId=${paymentId}`, {
      method: 'POST',
      body: new URLSearchParams({ status: '1', authorizationCode: '999999', customValue: paymentId }),
      redirect: 'manual',
    })
    expect(forged.status).toBe(303)
    expect((await paymentRow(paymentId))?.status).toBe('pending')
    expect(await latestEnd()).toBe(endBefore)
  })

  test('monto rechazado por el sandbox ($2): no hay retorno y la membresía no cambia', async ({ page }) => {
    const card = testCard('Visa')
    test.skip(!card, 'Faltan los datos de la tarjeta Visa de prueba')
    const endBefore = await latestEnd()
    const r = await create(PLAN_REJECTED.id)
    expect(r.status).toBe(200)
    const paymentId = r.body.paymentId as string

    const returned = await captureReturn(page)
    await payOnPagomedios(page, r.body.url, 'Visa', card!)
    await expect(page.getByText(/tarjeta inv[aá]lida|rechaz/i).first()).toBeVisible({ timeout: 60_000 })
    expect(returned).toHaveLength(0)

    const v = await callFunction({ action: 'verify', paymentId }, socioJwt)
    expect(['pending', 'rejected']).toContain(v.body.status)
    expect((await paymentRow(paymentId))?.status).not.toBe('approved')
    expect(await latestEnd()).toBe(endBefore)
  })

  test('app nativa: el retorno muestra "Pago recibido" y cierra la pantalla solo', async ({ page }) => {
    const card = testCard('Visa')
    test.skip(!card, 'Faltan los datos de la tarjeta Visa de prueba')
    const r = await create(PLAN_OK.id, { native: true })
    const paymentId = r.body.paymentId as string

    // simula la pantalla de @capgo/inappbrowser: expone window.mobileApp.close()
    await page.addInitScript(() => {
      ;(window as unknown as { mobileApp: { close: () => void } }).mobileApp = {
        close: () => {
          ;(window as unknown as { __closed: boolean }).__closed = true
        },
      }
    })
    await payOnPagomedios(page, r.body.url, 'Visa', card!)
    await expect(page.getByRole('heading', { name: 'Pago recibido' })).toBeVisible({ timeout: 120_000 })
    await expect.poll(() => page.evaluate(() => (window as unknown as { __closed?: boolean }).__closed)).toBe(true)
    expect((await paymentRow(paymentId))?.status).toBe('approved')
  })

  test('Mastercard de prueba (observación del sandbox)', async ({ page }) => {
    const card = testCard('Mastercard')
    test.skip(!card, 'Faltan los datos de la tarjeta Mastercard de prueba')
    const r = await create(PLAN_OK.id)
    const returned = await captureReturn(page)
    await payOnPagomedios(page, r.body.url, 'Mastercard', card!)
    const rejected = page.getByText(/tarjeta inv[aá]lida|rechaz/i).first()
    await expect
      .poll(async () => returned.length > 0 || (await rejected.isVisible().catch(() => false)), { timeout: 120_000 })
      .toBe(true)
    const status = (await paymentRow(r.body.paymentId))?.status
    test.info().annotations.push({
      type: 'sandbox',
      description: returned.length ? `Mastercard aprobada (${status})` : 'Mastercard rechazada por el sandbox',
    })
    // Solo documenta el comportamiento: si aprueba, debe quedar aprobado en la base.
    if (returned.length) expect(status).toBe('approved')
  })
})
