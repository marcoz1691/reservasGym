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
  registerCardOnPagomedios,
  startFunction,
  testCard,
} from './support/pagomedios'

/**
 * Pago recurrente (Adenda N.º 1) contra el sandbox real de Pagomedios:
 * Edge Function en local (Deno) con la base de QA. Registra la tarjeta en el
 * formulario real (POST /cards/register), el notify cobra el primer mes con el
 * token (POST /cards/charge) y activa la membresía. Solo corre en local con
 * app/.env.pagomedios.local. Deja QA como estaba y borra las tarjetas de prueba.
 */
test.describe.configure({ mode: 'serial' })
test.skip(!hasSandbox, 'Falta app/.env.pagomedios.local (token de pruebas de Pagomedios)')

const PLAN_MONTHLY = { id: 'c1000000-0000-4000-8000-000000000030', cents: 1500, days: 30 } // Zero Start Mensual
const DAY_PASS = 'c5000000-0000-4000-8000-000000000001'
const BILLING = {
  document: '1723358400',
  documentType: '05',
  phone: '0987569852',
  address: 'Av. Amazonas, Quito',
}
const DAY = 24 * 60 * 60 * 1000

type Membership = { id: string; plan_id: string; status: string; starts_at: string; ends_at: string; grace_ends_at: string; visits_left: number | null }
type FlagRow = { online_payments_enabled: boolean; day_passes_enabled: boolean; recurring_payments_enabled: boolean }
type Card = { token: string; number: string; created_at: string }

let fn: ChildProcess | undefined
let socioId = ''
let socioJwt = ''
let snapshot: Membership[] = []
let flagsSnapshot: FlagRow | undefined
/** null hasta tomar la foto inicial: sin ella la limpieza no borra ninguna tarjeta. */
let cardsBefore: Set<string> | null = null
const created: string[] = []

const paymentRow = async (id: string) =>
  (await sql<{ status: string; notes: string | null; mp_payment_id: string | null; membership_id: string | null; amount_cents: number }>(
    `select status, notes, mp_payment_id, membership_id, amount_cents from payments where id = '${id}'`,
  ))[0]
const setFlags = (flags: FlagRow) =>
  sql(`update gym_settings set online_payments_enabled = ${flags.online_payments_enabled},
    day_passes_enabled = ${flags.day_passes_enabled},
    recurring_payments_enabled = ${flags.recurring_payments_enabled} where id = 1`)
const ALL_ON: FlagRow = { online_payments_enabled: true, day_passes_enabled: true, recurring_payments_enabled: true }
const latestEnd = async () =>
  (await sql<{ ends_at: string | null }>(
    `select max(ends_at) ends_at from memberships where user_id = '${socioId}'`,
  ))[0]?.ends_at ?? null
const cardsOf = async (document: string): Promise<Card[]> =>
  ((await pagomedios(`/cards?integration=true&document=${document}`)).body?.data?.[0]?.cards ?? []) as Card[]
const newCards = async () => {
  const before = cardsBefore
  if (!before) return []
  return (await cardsOf(BILLING.document)).filter((c) => !before.has(c.token))
}

async function createRecurring(planId: string) {
  const r = await callFunction({ action: 'create', planId, ...BILLING, recurring: true }, socioJwt)
  if (r.body?.paymentId) created.push(r.body.paymentId)
  return r
}

/** El retorno a la app llega como redirect 303 desde notify: se escucha la navegación. */
async function captureReturn(page: Page) {
  const returned: string[] = []
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.url().startsWith(APP_URL)) returned.push(request.url())
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
  // Requiere recurring-payments.sql aplicado en QA.
  flagsSnapshot = (await sql<FlagRow>(
    `select online_payments_enabled, day_passes_enabled, recurring_payments_enabled from gym_settings where id = 1`,
  ))[0]
  await setFlags(ALL_ON)
  cardsBefore = new Set((await cardsOf(BILLING.document)).map((c) => c.token))
  socioJwt = await accessToken(ACCOUNTS.socio, PASSWORD)
  fn = await startFunction()
})

test.afterAll(async () => {
  fn?.kill()
  // Las tarjetas que registró la prueba no quedan en el sandbox.
  for (const card of await newCards().catch((): Card[] => [])) {
    await pagomedios(`/cards/${card.token}`, { method: 'DELETE' })
  }
  if (flagsSnapshot) await setFlags(flagsSnapshot)
  if (created.length) {
    await sql(`delete from payments where id in (${created.map((id) => `'${id}'`).join(',')})`)
  }
  if (!socioId) return
  await sql(`delete from memberships where user_id = '${socioId}'
    and id not in (${snapshot.map((m) => `'${m.id}'`).join(',') || `''`})`)
  for (const m of snapshot) {
    await sql(`update memberships set plan_id = '${m.plan_id}', status = '${m.status}',
      starts_at = '${m.starts_at}', ends_at = '${m.ends_at}', grace_ends_at = '${m.grace_ends_at}',
      visits_left = ${m.visits_left ?? 'null'} where id = '${m.id}'`)
  }
})

test.describe('Pago recurrente con Pagomedios (sandbox + QA)', () => {
  test.setTimeout(240_000)

  test('interruptor del admin: con el pago recurrente apagado no crea nada (503)', async () => {
    const before = (await sql<{ c: number }>(`select count(*)::int c from payments where provider = 'pagomedios'`))[0]!.c
    try {
      await setFlags({ ...ALL_ON, recurring_payments_enabled: false })
      const off = await createRecurring(PLAN_MONTHLY.id)
      expect(off.status).toBe(503)
      expect(off.body.error).toBe('Pago recurrente desactivado')
    } finally {
      await setFlags(ALL_ON)
    }
    const after = (await sql<{ c: number }>(`select count(*)::int c from payments where provider = 'pagomedios'`))[0]!.c
    expect(after).toBe(before)
  })

  test('con un primer mes en revisión no se abre otro pago recurrente (409)', async () => {
    const stuck = await createRecurring(PLAN_MONTHLY.id)
    expect(stuck.status).toBe(200)
    // Simula un cobro sin respuesta clara: quedó "en revisión" sin saber si se cobró.
    await sql(`update payments set notes = 'Pago recurrente (ID ${BILLING.document}): Requiere revisión: no se pudo confirmar el cobro del primer mes en Pagomedios.'
      where id = '${stuck.body.paymentId}'`)
    const again = await createRecurring(PLAN_MONTHLY.id)
    expect(again.status).toBe(409)
    expect(again.body.code).toBe('RECURRING_IN_REVIEW')
    await sql(`delete from payments where id = '${stuck.body.paymentId}'`)
  })

  test('solo planes mensuales: el pase del día no admite débito', async () => {
    const r = await createRecurring(DAY_PASS)
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/solo para planes mensuales/)
  })

  test('registro aprobado: cobra el primer mes con el token, activa la membresía y no cobra dos veces', async ({ page }) => {
    const card = testCard('Visa')
    test.skip(!card, 'Faltan los datos de la tarjeta Visa de prueba')
    const endBefore = await latestEnd()

    const r = await createRecurring(PLAN_MONTHLY.id)
    expect(r.status).toBe(200)
    expect(r.body.url).toMatch(/^https:\/\/payurl\.link\//)
    const paymentId = r.body.paymentId as string

    await test.step('queda pendiente, con la nota del registro y el monto del plan', async () => {
      expect(await paymentRow(paymentId)).toMatchObject({
        status: 'pending',
        amount_cents: PLAN_MONTHLY.cents,
        notes: `Pago recurrente (ID ${BILLING.document}): registro de tarjeta en curso.`,
      })
    })

    await test.step('verificar antes de registrar la tarjeta → pendiente y sin cobro', async () => {
      const v = await callFunction({ action: 'verify', paymentId }, socioJwt)
      expect(v.body.status).toBe('pending')
      expect(await latestEnd()).toBe(endBefore)
    })

    const returned = await captureReturn(page)
    await test.step('el socio registra la tarjeta en el formulario real y vuelve a la app', async () => {
      await registerCardOnPagomedios(page, r.body.url, 'Visa', card!)
      await expect.poll(() => returned.length, { timeout: 120_000 }).toBeGreaterThan(0)
      expect(returned[0]).toBe(`${APP_URL}/membresia/pago?provider=pagomedios&paymentId=${paymentId}`)
    })

    await test.step('el primer mes se cobró: pago aprobado con código y nota final', async () => {
      const row = await paymentRow(paymentId)
      expect(row?.status).toBe('approved')
      expect(row?.mp_payment_id).toMatch(/^\w{4,}$/)
      expect(row?.membership_id).toBeTruthy()
      expect(row?.notes).toMatch(/primer mes cobrado/)
    })

    await test.step('la tarjeta quedó registrada en Pagomedios para los cobros siguientes', async () => {
      const fresh = await newCards()
      expect(fresh).toHaveLength(1)
      expect(fresh[0]!.number).toMatch(/\d{4}$/)
    })

    await test.step('la membresía suma exactamente la duración del plan', async () => {
      const endAfter = await latestEnd()
      const base = endBefore && new Date(endBefore).getTime() > Date.now() ? new Date(endBefore).getTime() : Date.now()
      const addedDays = (new Date(endAfter!).getTime() - base) / DAY
      expect(addedDays).toBeGreaterThan(PLAN_MONTHLY.days - 0.01)
      expect(addedDays).toBeLessThan(PLAN_MONTHLY.days + 0.01)
    })

    await test.step('verify devuelve el comprobante del débito y no vuelve a cobrar ni extender', async () => {
      const endAfter = await latestEnd()
      const code = (await paymentRow(paymentId))!.mp_payment_id
      const v = await callFunction({ action: 'verify', paymentId }, socioJwt)
      expect(v.body.status).toBe('approved')
      expect(v.body.receipt).toMatchObject({
        planName: 'Zero Start Mensual',
        amountCents: PLAN_MONTHLY.cents,
        authorizationCode: code,
        recurring: true,
      })
      expect(await latestEnd()).toBe(endAfter)
      expect((await paymentRow(paymentId))!.mp_payment_id).toBe(code)
    })

    await test.step('un notify repetido con otro token no cobra de nuevo', async () => {
      const endAfter = await latestEnd()
      const replay = await fetch(`${FN_URL}/?action=notify&paymentId=${paymentId}`, {
        method: 'POST',
        body: new URLSearchParams({ status: '3', customValue: paymentId, cardToken: 'token-inventado' }),
        redirect: 'manual',
      })
      expect(replay.status).toBe(303)
      expect(await latestEnd()).toBe(endAfter)
    })
  })

  test('el banco rechaza el primer mes: no activa la membresía y la tarjeta no queda registrada', async ({ page }) => {
    const card = testCard('Visa')
    test.skip(!card, 'Faltan los datos de la tarjeta Visa de prueba')
    const endBefore = await latestEnd()
    const cardsAtStart = (await newCards()).map((c) => c.token)

    const r = await createRecurring(PLAN_MONTHLY.id)
    expect(r.status).toBe(200)
    const paymentId = r.body.paymentId as string
    // $2 es un monto que el sandbox rechaza: el cobro con token falla.
    await sql(`update payments set amount_cents = 200 where id = '${paymentId}'`)

    const returned = await captureReturn(page)
    await registerCardOnPagomedios(page, r.body.url, 'Visa', card!)
    await expect.poll(() => returned.length, { timeout: 120_000 }).toBeGreaterThan(0)

    const row = await paymentRow(paymentId)
    expect(row?.status).toBe('rejected')
    expect(row?.membership_id).toBeNull()
    expect(row?.notes).toMatch(/el primer mes no se cobró/)
    expect(await latestEnd()).toBe(endBefore)

    const v = await callFunction({ action: 'verify', paymentId }, socioJwt)
    expect(v.body.status).toBe('rejected')

    const left = (await newCards()).map((c) => c.token).filter((t) => !cardsAtStart.includes(t))
    expect(left).toHaveLength(0)
  })
})
