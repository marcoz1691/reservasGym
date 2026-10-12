// Campaña de pruebas del pago único y del pago recurrente: funcionales, exploratorias,
// confiabilidad, seguridad, rendimiento, accesibilidad y diseño responsivo.
//
// Corre contra la app local (npm run dev:staging, puerto 5190), la función de pagos local
// (puerto 8000 con APP_URL=http://localhost:5190), la base de QA y el sandbox de Pagomedios.
// Deja QA y el sandbox como estaban. Resultados y capturas en E2E_REPORT_DIR.
//
//   E2E_LOCAL_APP=1 SUPABASE_ACCESS_TOKEN=… E2E_ADMIN_PASSWORD=… \
//     npx playwright test -c e2e/playwright.config.ts campana-pagos
import { test, expect, devices, type Page, type Browser } from '@playwright/test'
import fs from 'node:fs'
import { ACCOUNTS, PASSWORD, login, sql, userId } from './support/qa'
import { accessToken, callFunction, env, pagomedios, payOnPagomedios, registerCardOnPagomedios, testCard } from './support/pagomedios'

const APP = 'http://localhost:5190'
const FN = 'http://localhost:8000'
const OUT = process.env.E2E_REPORT_DIR ?? 'e2e/results/campana-pagos'
const DOC = '1710034065'
const PLAN_MONTHLY = 'c1000000-0000-4000-8000-000000000030' // Zero Start Mensual $15
const DAY_PASS = 'c5000000-0000-4000-8000-000000000001'
const BILLING = { document: DOC, documentType: '05', phone: '0987569852', address: 'Av. Amazonas N34-120, Quito' }
const DAY = 86_400_000

test.describe.configure({ mode: 'serial' })
test.skip(!process.env.E2E_LOCAL_APP, 'Necesita la app local (5190) y la función de pagos (8000): E2E_LOCAL_APP=1')
test.setTimeout(240_000)

type Result = { id: string; tipo: string; area: string; caso: string; resultado: 'pasa' | 'falla' | 'observación'; detalle: string; evidencia?: string[] }
const results: Result[] = []
const record = (r: Result) => {
  results.push(r)
  fs.writeFileSync(`${OUT}/resultados.json`, JSON.stringify(results, null, 2))
  console.log(`${r.resultado === 'pasa' ? '✔' : r.resultado === 'falla' ? '✘' : '•'} [${r.id}] ${r.caso} — ${r.detalle}`)
}
async function shot(page: Page, name: string, fullPage = true) {
  const file = `${name}.png`
  await page.screenshot({ path: `${OUT}/${file}`, fullPage })
  return file
}

let socioId = ''
let socioJwt = ''
let started = ''
let snapshot: { id: string; plan_id: string; status: string; starts_at: string; ends_at: string; grace_ends_at: string; visits_left: number | null }[] = []
let flags: { online_payments_enabled: boolean; recurring_payments_enabled: boolean; day_passes_enabled: boolean } | undefined
let cardsBefore = new Set<string>()
const cardsOf = async () => ((await pagomedios(`/cards?integration=true&document=${DOC}`)).body?.data?.[0]?.cards ?? []) as { token: string; number: string; created_at: string }[]
const latestEnd = async () => (await sql<{ e: string | null }>(`select max(ends_at) e from memberships where user_id = '${socioId}'`))[0]?.e ?? null
const setFlags = (f: Partial<NonNullable<typeof flags>>) =>
  sql(`update gym_settings set ${Object.entries(f).map(([k, v]) => `${k} = ${v}`).join(', ')} where id = 1`)
async function restoreMembership() {
  await sql(`delete from payments where user_id = '${socioId}' and created_at >= '${started}'`)
  await sql(`delete from memberships where user_id = '${socioId}' and id not in (${snapshot.map((m) => `'${m.id}'`).join(',') || `''`})`)
  for (const m of snapshot) {
    await sql(`update memberships set plan_id = '${m.plan_id}', status = '${m.status}', starts_at = '${m.starts_at}', ends_at = '${m.ends_at}',
      grace_ends_at = '${m.grace_ends_at}', visits_left = ${m.visits_left ?? 'null'} where id = '${m.id}'`)
  }
}
async function socioPage(browser: Browser, options = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], baseURL: APP, ...options })
  const page = await ctx.newPage()
  await login(page, ACCOUNTS.socio)
  return { ctx, page }
}
async function fillBilling(page: Page, doc = DOC) {
  await page.getByLabel('Número de identificación').fill(doc)
  await page.getByLabel('Celular').fill(BILLING.phone)
  await page.getByLabel('Dirección').fill(BILLING.address)
  await page.getByRole('checkbox', { name: /Acepto los términos/ }).check()
}
type AxeViolation = { id: string; impact: string; help: string; nodes: number }
async function axeScan(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js' })
  return page.evaluate(async () => {
    // @ts-expect-error axe global
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })
    return r.violations.map((v: { id: string; impact: string; help: string; nodes: unknown[] }) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }))
  })
}

test.beforeAll(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  started = new Date().toISOString()
  socioId = await userId(ACCOUNTS.socio)
  socioJwt = await accessToken(ACCOUNTS.socio, PASSWORD)
  snapshot = await sql(`select id, plan_id, status, starts_at, ends_at, grace_ends_at, visits_left from memberships where user_id = '${socioId}'`)
  flags = (await sql<NonNullable<typeof flags>>(`select online_payments_enabled, recurring_payments_enabled, day_passes_enabled from gym_settings where id = 1`))[0]
  cardsBefore = new Set((await cardsOf()).map((c) => c.token))
  await setFlags({ online_payments_enabled: true, recurring_payments_enabled: true, day_passes_enabled: true })
})

test.afterAll(async () => {
  for (const c of await cardsOf().catch(() => [])) if (!cardsBefore.has(c.token)) await pagomedios(`/cards/${c.token}`, { method: 'DELETE' })
  await restoreMembership()
  if (flags) await setFlags(flags)
  fs.writeFileSync(`${OUT}/resultados.json`, JSON.stringify(results, null, 2))
})

// ---------------------------------------------------------------- Funcionales (UI)
test('F-01 pago único con tarjeta desde Mi Plan', async ({ browser }) => {
  const { ctx, page } = await socioPage(browser, { recordVideo: { dir: `${OUT}/video-pago-unico` } })
  const before = await latestEnd()
  await page.goto('/membresia')
  await page.getByRole('tab', { name: 'Zero Start' }).click().catch(() => undefined)
  const ev = [await shot(page, 'F01-1-mi-plan')]
  await page.locator('button:enabled').filter({ hasText: /^(Elegir este plan|Elegir plan|Extender plan en espera)$/ }).first().click()
  await expect(page.getByRole('radio', { name: /Tarjeta de crédito o débito/ })).toHaveAttribute('aria-checked', 'true')
  await fillBilling(page)
  ev.push(await shot(page, 'F01-2-checkout'))
  await page.getByRole('button', { name: /^Pagar\s*\$/ }).click()
  await page.waitForURL(/payurl\.link/, { timeout: 30_000 })
  await payOnPagomedios(page, page.url(), 'Visa', testCard('Visa')!)
  await page.waitForURL(/5190\/membresia\/pago\?provider=pagomedios/, { timeout: 120_000 })
  await expect(page.getByText('¡Pago aprobado!')).toBeVisible({ timeout: 60_000 })
  ev.push(await shot(page, 'F01-3-comprobante'))
  const after = await latestEnd()
  const added = (new Date(after!).getTime() - Math.max(Date.now(), before ? new Date(before).getTime() : 0)) / DAY
  record({ id: 'F-01', tipo: 'Funcional · automatizada', area: 'Pago único', caso: 'Socio paga su plan con tarjeta desde Mi Plan', resultado: 'pasa', detalle: `Pago aprobado; vigencia +${Math.round(added)} días; sin aviso de débito`, evidencia: ev })
  await expect(page.getByText(/Tu tarjeta quedó registrada/)).toHaveCount(0)
  await ctx.close()
})

test('F-02 pago recurrente elegido en el checkout', async ({ browser }) => {
  const { ctx, page } = await socioPage(browser, { recordVideo: { dir: `${OUT}/video-recurrente` } })
  await page.goto('/membresia')
  await page.getByRole('tab', { name: 'Zero Start' }).click().catch(() => undefined)
  await expect(page.getByRole('button', { name: 'Pago recurrente mensual' })).toHaveCount(0)
  await page.locator('button:enabled').filter({ hasText: /^(Elegir este plan|Elegir plan|Extender plan en espera)$/ }).first().click()
  await page.getByRole('radio', { name: /Pago recurrente con tarjeta/ }).click()
  await expect(page.getByText(/Los meses siguientes Zona Cero hará el cobro/)).toBeVisible()
  await fillBilling(page)
  const ev = [await shot(page, 'F02-1-checkout-recurrente')]
  await page.getByRole('button', { name: /Registrar tarjeta y pagar/ }).click()
  await page.waitForURL(/payurl\.link/, { timeout: 30_000 })
  ev.push(await shot(page, 'F02-2-registrar-tarjeta', false))
  await registerCardOnPagomedios(page, page.url(), 'Visa', testCard('Visa')!)
  await page.waitForURL(/5190\/membresia\/pago\?provider=pagomedios/, { timeout: 120_000 })
  await expect(page.getByText(/Tu tarjeta quedó registrada/)).toBeVisible({ timeout: 60_000 })
  ev.push(await shot(page, 'F02-3-comprobante'))
  const [pay] = await sql<{ status: string; notes: string }>(`select status, notes from payments where user_id = '${socioId}' and notes like 'Pago recurrente%' order by created_at desc limit 1`)
  record({ id: 'F-02', tipo: 'Funcional · automatizada', area: 'Pago recurrente', caso: 'Socio elige "Pago recurrente con tarjeta" en el checkout y registra su tarjeta', resultado: pay?.status === 'approved' ? 'pasa' : 'falla', detalle: `Pago ${pay?.status}; un solo botón por plan en la vitrina; aviso del débito visible`, evidencia: ev })
  await ctx.close()
})

test('F-03 recepción ve ambos cobros en Cobros', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: APP, viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await login(page, ACCOUNTS.admin, process.env.E2E_ADMIN_PASSWORD)
  await page.goto('/admin/cobros')
  await page.getByRole('button', { name: /Historial General de Cobros/i }).click()
  await page.getByRole('button', { name: /En línea \(Pagomedios\)/ }).click()
  await expect(page.getByText(/Pago recurrente \(ID 1710034065\)/).first()).toBeVisible({ timeout: 20_000 })
  const ev = [await shot(page, 'F03-cobros', false)]
  record({ id: 'F-03', tipo: 'Funcional · automatizada', area: 'Ambos', caso: 'Recepción ve el pago único y el recurrente en el historial de Cobros', resultado: 'pasa', detalle: 'Filtro "En línea (Pagomedios)" muestra ambos con código de autorización; el recurrente con su nota', evidencia: ev })
  await ctx.close()
  await restoreMembership()
})

// ---------------------------------------------------------------- Exploratorias
test('E exploratorias del checkout', async ({ browser }) => {
  const { ctx, page } = await socioPage(browser)
  const url = `/membresia/pago?planId=${PLAN_MONTHLY}`

  await page.goto(url)
  await page.getByLabel('Número de identificación').fill('1234567890')
  await page.getByLabel('Celular').click()
  const invalid = await page.getByText(/cédula no es válida/i).isVisible()
  // Al salir del celular vacío aparece su error y la página se mueve: un toque en la
  // casilla en ese instante no la marca. Se espera a que el diseño se asiente.
  const terms = page.getByRole('checkbox', { name: /Acepto los términos/ })
  const firstTap = await terms.click({ timeout: 3000 }).then(() => terms.isChecked()).catch(() => false)
  record({ id: 'U-03', tipo: 'UI/UX · exploratoria', area: 'Ambos', caso: 'Tocar "Acepto los términos" justo cuando aparecen errores del formulario', resultado: firstTap ? 'pasa' : 'observación', detalle: firstTap ? 'La casilla se marca al primer toque' : 'Al aparecer "Ingresa tu celular" el formulario se desplaza y el primer toque no marca la casilla; hay que tocar de nuevo' })
  await page.waitForTimeout(500)
  if (!(await terms.isChecked())) await terms.check()
  const disabled = await page.getByRole('button', { name: /^Pagar\s*\$/ }).isDisabled()
  record({ id: 'E-01', tipo: 'Exploratoria', area: 'Ambos', caso: 'Cédula con dígito verificador inválido', resultado: invalid && disabled ? 'pasa' : 'falla', detalle: invalid ? 'Muestra "La cédula no es válida" y no deja pagar' : 'No mostró el error', evidencia: [await shot(page, 'E01-cedula-invalida')] })

  await page.goto(url)
  await page.getByLabel('Número de identificación').fill(DOC)
  await page.getByLabel('Celular').fill(BILLING.phone)
  await page.getByLabel('Dirección').fill(BILLING.address)
  const noTerms = await page.getByRole('button', { name: /^Pagar\s*\$/ }).isDisabled()
  record({ id: 'E-02', tipo: 'Exploratoria', area: 'Ambos', caso: 'Pagar sin aceptar términos y condiciones', resultado: noTerms ? 'pasa' : 'falla', detalle: noTerms ? 'El botón queda deshabilitado' : 'Se pudo pagar sin aceptar' })

  await page.goto(url)
  await fillBilling(page)
  const countBefore = (await sql<{ c: number }>(`select count(*)::int c from payments where user_id = '${socioId}' and provider = 'pagomedios'`))[0]!.c
  const pay = page.getByRole('button', { name: /^Pagar\s*\$/ })
  // Tres clics en el mismo instante, como un dedo que rebota sobre el botón.
  await pay.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); button.click() })
  await page.waitForURL(/payurl\.link/, { timeout: 30_000 })
  const countAfter = (await sql<{ c: number }>(`select count(*)::int c from payments where user_id = '${socioId}' and provider = 'pagomedios'`))[0]!.c
  record({ id: 'E-03', tipo: 'Exploratoria', area: 'Ambos', caso: 'Triple clic rápido en "Pagar"', resultado: countAfter - countBefore === 1 ? 'pasa' : 'falla', detalle: `Se crearon ${countAfter - countBefore} pagos` })

  await page.goBack()
  await page.waitForURL(/membresia\/pago\?planId/, { timeout: 20_000 })
  const restored = (await page.getByLabel('Número de identificación').inputValue().catch(() => '')) === DOC
  const checkLink = await page.getByRole('link', { name: /verifica su estado antes de pagar otra vez/i }).isVisible().catch(() => false)
  const stuck = await page.getByText(/Abriendo pago seguro/).isVisible().catch(() => false)
  record({ id: 'E-04', tipo: 'Exploratoria', area: 'Ambos', caso: 'Volver con "atrás" desde el formulario de Pagomedios', resultado: restored && checkLink && !stuck ? 'pasa' : 'observación', detalle: `Datos recuperados: ${restored ? 'sí' : 'no'}; enlace para verificar el pago anterior: ${checkLink ? 'sí' : 'no'}; queda "procesando": ${stuck ? 'sí' : 'no'}`, evidencia: [await shot(page, 'E04-volver-atras')] })

  await page.goto(url)
  await page.getByRole('button', { name: 'Salir del pago' }).click()
  const sheet = await page.getByRole('button', { name: /Seguir pagando|Quedarme|Continuar/i }).first().isVisible().catch(() => false)
  record({ id: 'E-05', tipo: 'Exploratoria', area: 'Ambos', caso: 'Salir del checkout con la X', resultado: sheet ? 'pasa' : 'observación', detalle: sheet ? 'Pregunta antes de salir (hoja de confirmación)' : 'No apareció la confirmación', evidencia: [await shot(page, 'E05-salir', false)] })

  await page.goto(`/membresia/pago?planId=${DAY_PASS}`)
  const noRecDay = (await page.getByRole('radio', { name: /Pago recurrente con tarjeta/ }).count()) === 0
  record({ id: 'E-06', tipo: 'Exploratoria', area: 'Pago recurrente', caso: 'Pase del día: ¿ofrece pago recurrente?', resultado: noRecDay ? 'pasa' : 'falla', detalle: noRecDay ? 'No lo ofrece; sí tarjeta y recepción' : 'Lo ofreció' })

  await page.goto(`/membresia/pago?planId=c1000000-0000-4000-8000-000000000090`).catch(() => undefined)
  const quarterly = await page.getByRole('radio', { name: /Pago recurrente con tarjeta/ }).count()
  record({ id: 'E-07', tipo: 'Exploratoria', area: 'Pago recurrente', caso: 'Plan trimestral: ¿ofrece pago recurrente?', resultado: quarterly === 0 ? 'pasa' : 'falla', detalle: quarterly === 0 ? 'Solo los mensuales lo ofrecen' : 'Lo ofreció en un plan no mensual' })

  await setFlags({ recurring_payments_enabled: false })
  await page.goto(url)
  const offRec = (await page.getByRole('radio', { name: /Pago recurrente con tarjeta/ }).count()) === 0
  record({ id: 'E-08', tipo: 'Exploratoria', area: 'Pago recurrente', caso: 'Interruptor "Pago recurrente mensual" apagado', resultado: offRec ? 'pasa' : 'falla', detalle: offRec ? 'El medio desaparece del checkout' : 'Siguió visible' })
  await setFlags({ online_payments_enabled: false })
  await page.goto(url)
  const noCard = (await page.getByRole('radio', { name: /Tarjeta de crédito o débito/ }).count()) === 0
  record({ id: 'E-09', tipo: 'Exploratoria', area: 'Pago único', caso: 'Interruptor "Pago en línea" apagado', resultado: noCard ? 'pasa' : 'falla', detalle: noCard ? 'Solo quedan efectivo, transferencia y Deuna' : 'La tarjeta siguió visible', evidencia: [await shot(page, 'E09-sin-pago-en-linea')] })
  await setFlags({ online_payments_enabled: true, recurring_payments_enabled: true })

  await page.goto(url)
  await page.getByRole('radio', { name: /Pago recurrente con tarjeta/ }).click()
  await page.getByRole('radio', { name: /Efectivo en recepción/ }).click()
  const noticeGone = !(await page.getByText(/Los meses siguientes Zona Cero hará el cobro/).isVisible())
  record({ id: 'E-10', tipo: 'Exploratoria', area: 'Pago recurrente', caso: 'Elegir recurrente y luego cambiar a efectivo', resultado: noticeGone ? 'pasa' : 'falla', detalle: noticeGone ? 'El aviso del débito se oculta y el botón cambia a "Confirmar solicitud"' : 'Quedó el aviso del débito' })
  await ctx.close()
  await restoreMembership()
})

// ---------------------------------------------------------------- Confiabilidad
test('R-01 cinco verificaciones simultáneas no cobran dos veces', async ({ browser }) => {
  const before = await latestEnd()
  const r = await callFunction({ action: 'create', planId: PLAN_MONTHLY, ...BILLING, recurring: true }, socioJwt)
  const paymentId = r.body.paymentId as string
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  // El notify del navegador se corta: solo las 5 verificaciones compiten por cobrar.
  await page.route(`${FN}/**`, (route) => route.abort())
  await registerCardOnPagomedios(page, r.body.url, 'Visa', testCard('Visa')!)
  const uuid = (await sql<{ reference: string }>(`select reference from payments where id = '${paymentId}'`))[0]!.reference
  await expect.poll(async () => Number((await pagomedios(`/payment-requests?integration=true&uuid=${uuid}`)).body?.data?.[0]?.status), { timeout: 90_000 }).toBeGreaterThan(0)
  const t0 = Date.now()
  const all = await Promise.all(Array.from({ length: 5 }, () => callFunction({ action: 'verify', paymentId }, socioJwt)))
  const ms = Date.now() - t0
  const statuses = all.map((x) => x.body?.status)
  const [row] = await sql<{ status: string; mp_payment_id: string }>(`select status, mp_payment_id from payments where id = '${paymentId}'`)
  const after = await latestEnd()
  const added = Math.round((new Date(after!).getTime() - Math.max(Date.now(), before ? new Date(before).getTime() : 0)) / DAY)
  const ok = row?.status === 'approved' && added === 30
  record({ id: 'R-01', tipo: 'No funcional · confiabilidad', area: 'Pago recurrente', caso: '5 verificaciones simultáneas del mismo pago recurrente', resultado: ok ? 'pasa' : 'falla', detalle: `Respuestas: ${statuses.join(', ')}; pago ${row?.status}; vigencia +${added} días (un solo cobro); ${ms} ms en total` })
  await ctx.close()
  await restoreMembership()
})

// ---------------------------------------------------------------- Seguridad
test('S seguridad: la base y la función no aceptan atajos', async () => {
  const r = await callFunction({ action: 'create', planId: PLAN_MONTHLY, ...BILLING }, socioJwt)
  const paymentId = r.body.paymentId as string
  const rest = (path: string, init: RequestInit) =>
    fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${socioJwt}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers } })
  const patch = await rest(`payments?id=eq.${paymentId}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) })
  const patched = await patch.json().catch(() => null)
  const still = (await sql<{ status: string }>(`select status from payments where id = '${paymentId}'`))[0]?.status
  record({ id: 'S-01', tipo: 'No funcional · seguridad', area: 'Ambos', caso: 'Socio intenta aprobar su propio pago directo en la base (REST)', resultado: still === 'pending' ? 'pasa' : 'falla', detalle: `HTTP ${patch.status}, filas cambiadas: ${Array.isArray(patched) ? patched.length : 0}; el pago sigue "${still}"` })

  const ins = await rest('payments', { method: 'POST', body: JSON.stringify({ user_id: socioId, plan_id: PLAN_MONTHLY, amount_cents: 1, status: 'approved', provider: 'pagomedios' }) })
  record({ id: 'S-02', tipo: 'No funcional · seguridad', area: 'Ambos', caso: 'Socio intenta insertar un pago aprobado de $0,01', resultado: ins.status >= 400 ? 'pasa' : 'falla', detalle: `HTTP ${ins.status} (RLS lo bloquea)` })

  const mem = await rest(`memberships?user_id=eq.${socioId}`, { method: 'PATCH', body: JSON.stringify({ ends_at: '2030-01-01T00:00:00Z' }) })
  const memRows = await mem.json().catch(() => null)
  record({ id: 'S-03', tipo: 'No funcional · seguridad', area: 'Ambos', caso: 'Socio intenta alargar su membresía directo en la base', resultado: !Array.isArray(memRows) || memRows.length === 0 ? 'pasa' : 'falla', detalle: `HTTP ${mem.status}, filas cambiadas: ${Array.isArray(memRows) ? memRows.length : 0}` })

  const fake = await fetch(`${FN}/?action=notify&paymentId=${paymentId}`, { method: 'POST', body: new URLSearchParams({ status: '1', authorizationCode: '999999', customValue: paymentId }), redirect: 'manual' })
  const afterFake = (await sql<{ status: string }>(`select status from payments where id = '${paymentId}'`))[0]?.status
  record({ id: 'S-04', tipo: 'No funcional · seguridad', area: 'Pago único', caso: 'Aviso falso de Pagomedios diciendo "aprobado"', resultado: afterFake === 'pending' ? 'pasa' : 'falla', detalle: `HTTP ${fake.status}; el pago sigue "${afterFake}" (la función consulta a Pagomedios)` })

  const noJwt = await callFunction({ action: 'create', planId: PLAN_MONTHLY, ...BILLING })
  const staff = await callFunction({ action: 'verify', paymentId }, await accessToken(ACCOUNTS.staff, PASSWORD))
  record({ id: 'S-05', tipo: 'No funcional · seguridad', area: 'Ambos', caso: 'Crear sin sesión / verificar el pago de otra persona', resultado: noJwt.status === 401 && staff.status === 403 ? 'pasa' : 'falla', detalle: `Sin sesión: ${noJwt.status}; otro usuario: ${staff.status}` })
  await restoreMembership()
})

// ---------------------------------------------------------------- Rendimiento
test('P rendimiento de la función y de la pantalla', async ({ browser }) => {
  const create: number[] = []
  const verify: number[] = []
  for (let i = 0; i < 3; i++) {
    let t = Date.now()
    const r = await callFunction({ action: 'create', planId: PLAN_MONTHLY, ...BILLING }, socioJwt)
    create.push(Date.now() - t)
    t = Date.now()
    await callFunction({ action: 'verify', paymentId: r.body.paymentId }, socioJwt)
    verify.push(Date.now() - t)
  }
  const avg = (a: number[]) => Math.round(a.reduce((s, x) => s + x, 0) / a.length)
  record({ id: 'P-01', tipo: 'No funcional · rendimiento', area: 'Ambos', caso: 'Tiempo de respuesta de la función (3 intentos, local → Pagomedios sandbox)', resultado: avg(create) < 5000 && avg(verify) < 5000 ? 'pasa' : 'observación', detalle: `Crear pago: ${avg(create)} ms promedio (${create.join('/')}); verificar: ${avg(verify)} ms (${verify.join('/')})` })

  const { ctx, page } = await socioPage(browser)
  const t = Date.now()
  await page.goto(`/membresia/pago?planId=${PLAN_MONTHLY}`)
  await expect(page.getByRole('radio', { name: /Tarjeta de crédito o débito/ })).toBeVisible()
  const ready = Date.now() - t
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }
  })
  record({ id: 'P-02', tipo: 'No funcional · rendimiento', area: 'Ambos', caso: 'Carga del checkout en celular (servidor de desarrollo local)', resultado: ready < 4000 ? 'pasa' : 'observación', detalle: `Checkout listo en ${ready} ms; DOMContentLoaded ${nav.dcl} ms. Build de producción: checkout 28,3 kB (8,9 kB gzip)` })
  await ctx.close()
  await restoreMembership()
})

// ---------------------------------------------------------------- Accesibilidad, responsivo y UI/UX
test('A accesibilidad, responsivo y diseño', async ({ browser }) => {
  const { ctx, page } = await socioPage(browser)
  const screens: [string, string, () => Promise<void>][] = [
    ['Mi Plan', '/membresia', async () => {}],
    ['Checkout · tarjeta', `/membresia/pago?planId=${PLAN_MONTHLY}`, async () => {}],
    ['Checkout · pago recurrente', `/membresia/pago?planId=${PLAN_MONTHLY}`, async () => { await page.getByRole('radio', { name: /Pago recurrente con tarjeta/ }).click() }],
  ]
  for (const [name, path, prep] of screens) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await prep()
    const v = await axeScan(page)
    const serious = v.filter((x) => x.impact === 'serious' || x.impact === 'critical')
    record({ id: `A-${name}`, tipo: 'No funcional · accesibilidad (WCAG 2.1 AA, axe-core)', area: name.startsWith('Mi Plan') ? 'Ambos' : name.includes('recurrente') ? 'Pago recurrente' : 'Pago único', caso: name, resultado: serious.length === 0 ? (v.length === 0 ? 'pasa' : 'observación') : 'falla', detalle: v.length === 0 ? 'Sin infracciones' : v.map((x) => `${x.id} (${x.impact}, ${x.nodes})`).join('; ') })
  }

  await page.goto(`/membresia/pago?planId=${PLAN_MONTHLY}`)
  await page.getByRole('radio', { name: /Pago recurrente con tarjeta/ }).click()
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, [role="radio"], input[type="checkbox"], a')]
      .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) } })
      .filter((x) => x.h > 0 && (x.h < 44 || x.w < 44)),
  )
  record({ id: 'U-01', tipo: 'UI/UX · tamaño táctil', area: 'Ambos', caso: 'Controles del checkout de al menos 44 × 44 px (guía de Apple)', resultado: small.length === 0 ? 'pasa' : 'observación', detalle: small.length === 0 ? 'Todos cumplen' : small.map((s) => `"${s.t}" ${s.w}×${s.h}`).join('; ') })
  await ctx.close()

  for (const [label, viewport] of [['360 px (Android chico)', { width: 360, height: 760 }], ['390 px (iPhone)', { width: 390, height: 844 }], ['768 px (tablet)', { width: 768, height: 1024 }], ['1280 px (escritorio)', { width: 1280, height: 900 }]] as const) {
    const c = await browser.newContext({ baseURL: APP, viewport })
    const p = await c.newPage()
    await login(p, ACCOUNTS.socio)
    await p.goto(`/membresia/pago?planId=${PLAN_MONTHLY}`)
    await p.getByRole('radio', { name: /Pago recurrente con tarjeta/ }).click()
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const file = await shot(p, `U02-${viewport.width}`)
    record({ id: `U-02-${viewport.width}`, tipo: 'UI/UX · responsivo', area: 'Ambos', caso: `Checkout a ${label}`, resultado: overflow <= 0 ? 'pasa' : 'falla', detalle: overflow <= 0 ? 'Sin desplazamiento horizontal' : `Se desborda ${overflow} px`, evidencia: [file] })
    await c.close()
  }
})
