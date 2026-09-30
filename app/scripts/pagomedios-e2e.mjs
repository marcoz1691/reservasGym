// E2E local de la Edge Function pagomedios-payment, sin credenciales ni Supabase real.
// Levanta: Supabase falso en memoria (auth + subconjunto PostgREST), simulador Pagomedios
// y la función real con Deno. Uso: npm run pagomedios:e2e
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SUPA_PORT = 54329
const PM_PORT = 4011
const FN_URL = 'http://localhost:8000'
const APP_URL = 'http://localhost:5190'
const DAY = 24 * 60 * 60 * 1000

// ---------- Supabase falso ----------
const db = {
  profiles: [
    { id: 'u1', full_name: 'Socio Uno', email: 'socio1@gym.local' },
    { id: 'u2', full_name: 'Socio Dos', email: 'socio2@gym.local' },
  ],
  membership_plans: [
    { id: 'mensual', name: 'Plan Mensual', price_cents: 3500, duration_days: 30, visit_quota: null, active: true },
    { id: 'pase10', name: 'Pase 10 visitas', price_cents: 2500, duration_days: 60, visit_quota: 10, active: true },
    { id: 'viejo', name: 'Plan inactivo', price_cents: 2000, duration_days: 30, visit_quota: null, active: false },
  ],
  memberships: [],
  payments: [],
}
const tokens = { 'jwt-u1': 'u1', 'jwt-u2': 'u2' }
const writes = { memberships: 0 }

function matches(row, filters) {
  return filters.every(([col, op, val]) => {
    const cell = row[col] === null || row[col] === undefined ? 'null' : String(row[col])
    if (op === 'eq') return cell === val
    if (op === 'neq') return cell !== val
    throw new Error(`operador no soportado: ${op}`)
  })
}

function project(row, select) {
  if (!select || select === '*') return { ...row }
  return Object.fromEntries(select.split(',').map((c) => c.trim()).map((c) => [c, row[c] ?? null]))
}

const readJson = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => resolve(raw ? JSON.parse(raw) : null))
  })

const supabase = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${SUPA_PORT}`)
  const reply = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(body === undefined ? '' : JSON.stringify(body))
  }

  if (url.pathname === '/auth/v1/user') {
    const jwt = (req.headers.authorization ?? '').replace(/^Bearer /, '')
    const uid = tokens[jwt]
    if (!uid) return reply(401, { code: 401, msg: 'invalid JWT' })
    const p = db.profiles.find((x) => x.id === uid)
    return reply(200, { id: uid, email: p.email, aud: 'authenticated', role: 'authenticated' })
  }

  const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/)
  if (!m || !db[m[1]]) return reply(404, { message: 'tabla desconocida' })
  const table = db[m[1]]
  if (m[1] === 'memberships' && req.method !== 'GET') writes.memberships++
  const filters = []
  let select = '*', order = null, limit = null
  for (const [k, v] of url.searchParams) {
    if (k === 'select') select = v
    else if (k === 'order') order = v
    else if (k === 'limit') limit = Number(v)
    else if (k === 'on_conflict' || k === 'columns') continue
    else {
      const dot = v.indexOf('.')
      filters.push([k, v.slice(0, dot), v.slice(dot + 1)])
    }
  }
  const prefer = req.headers.prefer ?? ''
  const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object')
  const representation = prefer.includes('return=representation')

  const respondRows = (rows, createdStatus = 200) => {
    const out = rows.map((r) => project(r, select))
    if (wantsObject) {
      if (out.length !== 1) {
        return reply(406, { code: 'PGRST116', message: `JSON object requested, ${out.length} rows returned` })
      }
      return reply(createdStatus, out[0])
    }
    return reply(createdStatus, out)
  }

  if (req.method === 'GET') {
    let rows = table.filter((r) => matches(r, filters))
    if (order) {
      const [col, dir] = order.split('.')
      rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : 1) * (dir === 'desc' ? -1 : 1))
    }
    if (limit !== null) rows = rows.slice(0, limit)
    return respondRows(rows)
  }

  if (req.method === 'POST') {
    const body = await readJson(req)
    const items = Array.isArray(body) ? body : [body]
    const upsert = prefer.includes('resolution=merge-duplicates')
    const saved = items.map((item) => {
      const existing = upsert && item.id ? table.find((r) => r.id === item.id) : null
      if (existing) return Object.assign(existing, item)
      const row = { id: randomUUID(), created_at: new Date().toISOString(), ...item }
      table.push(row)
      return row
    })
    return representation ? respondRows(saved, 201) : reply(201)
  }

  if (req.method === 'PATCH') {
    const patch = await readJson(req)
    const rows = table.filter((r) => matches(r, filters))
    rows.forEach((r) => Object.assign(r, patch))
    return representation ? respondRows(rows) : reply(204)
  }

  reply(405, { message: 'método no soportado' })
})

// ---------- procesos ----------
const children = []
function start(cmd, args, env, readyText) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: appDir, env: { ...process.env, ...env } })
    children.push(child)
    let log = ''
    const onData = (d) => {
      log += d
      if (log.includes(readyText)) resolve(child)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => reject(new Error(`${cmd} terminó (${code}):\n${log}`)))
    setTimeout(() => reject(new Error(`${cmd} no arrancó:\n${log}`)), 60000)
  })
}

const fnEnv = (overrides = {}) => ({
  DENO_NO_PACKAGE_JSON: '1',
  SUPABASE_URL: `http://localhost:${SUPA_PORT}`,
  SUPABASE_ANON_KEY: 'anon-falsa',
  SUPABASE_SERVICE_ROLE_KEY: 'service-falsa',
  PAGOMEDIOS_TOKEN: 'token-simulador',
  PAGOMEDIOS_API_URL: `http://localhost:${PM_PORT}`,
  FUNCTION_PUBLIC_URL: FN_URL,
  APP_URL,
  PAGOMEDIOS_TAX_RATE: '0.15',
  ...overrides,
})

const startFn = (env) =>
  start(
    'deno',
    ['run', '--allow-net', '--allow-env', '--allow-read', 'supabase/functions/pagomedios-payment/index.ts'],
    env,
    'Listening on',
  )

// ---------- helpers de prueba ----------
let passed = 0
let failed = 0
function check(name, cond, detail) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}${detail !== undefined ? `\n      → ${JSON.stringify(detail)}` : ''}`)
  }
}

async function call(body, jwt = 'jwt-u1') {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

const validBilling = { document: '1723358400', documentType: '05', phone: '0987569852', address: 'Av. Amazonas, Quito' }
const create = (planId = 'mensual', jwt = 'jwt-u1', extra = {}) =>
  call({ action: 'create', planId, ...validBilling, ...extra }, jwt)

/** Simula al socio pagando en payurl.link: el simulador devuelve un form auto-submit hacia notify_url. */
async function payAndFollowNotify(url, action = 'approve') {
  const token = url.split('/pay/')[1]
  const html = await (await fetch(`http://localhost:${PM_PORT}/pay/${token}/${action}`, { method: 'POST' })).text()
  if (action === 'approve-silent') return { token }
  const actionUrl = html.match(/action="([^"]+)"/)[1].replace(/&amp;/g, '&')
  const form = new URLSearchParams()
  for (const [, k, v] of html.matchAll(/name="([^"]+)" value="([^"]*)"/g)) form.set(k, v)
  const res = await fetch(actionUrl, { method: 'POST', body: form, redirect: 'manual' })
  return { token, status: res.status, location: res.headers.get('location'), form, text: await res.text() }
}

const paymentRow = (id) => db.payments.find((p) => p.id === id)
const membershipOf = (uid) => db.memberships.find((m) => m.user_id === uid)

// ---------- escenarios ----------
async function run() {
  await new Promise((r) => supabase.listen(SUPA_PORT, r))
  await start('node', ['scripts/pagomedios-mock.mjs'], { PORT: String(PM_PORT), STATUS_DELAY_MS: '150' }, 'Simulador Pagomedios')
  let fn = await startFn(fnEnv())

  console.log('\n1. Validaciones al crear')
  let r = await call({ action: 'create', planId: 'mensual', ...validBilling }, null)
  check('sin sesión → 401', r.status === 401, r)
  r = await create('mensual', 'jwt-falso')
  check('JWT inválido → 401', r.status === 401, r)
  r = await create('mensual', 'jwt-u1', { document: '12345' })
  check('cédula de 5 dígitos → 400', r.status === 400 && /10 dígitos/.test(r.body?.error), r)
  r = await create('mensual', 'jwt-u1', { documentType: '04', document: '1723358400' })
  check('RUC de 10 dígitos → 400', r.status === 400 && /13 dígitos/.test(r.body?.error), r)
  r = await create('mensual', 'jwt-u1', { phone: '0991' })
  check('teléfono corto → 400', r.status === 400, r)
  r = await create('viejo')
  check('plan inactivo → 404', r.status === 404, r)
  r = await call({ action: 'otra' })
  check('acción desconocida → 400', r.status === 400, r)
  check('ninguna validación fallida creó pagos', db.payments.length === 0, db.payments)

  console.log('\n2. Crear solicitud (plan $35.00 con IVA 15%)')
  r = await create('mensual')
  const p1 = r.body?.paymentId
  check('responde 200 con url del simulador y paymentId', r.status === 200 && /\/pay\/cha_/.test(r.body?.url) && p1, r)
  const row1 = paymentRow(p1)
  check('payments: pending, provider pagomedios, $35.00', row1?.status === 'pending' && row1?.provider === 'pagomedios' && row1?.amount_cents === 3500, row1)
  check('payments.reference guarda el token cha_ de Pagomedios', /^cha_/.test(row1?.reference ?? ''), row1)

  console.log('\n3. Pago aprobado → notify → membresía activa')
  const before = Date.now()
  const n1 = await payAndFollowNotify(r.body.url, 'approve')
  check('notify responde 303 hacia la app', n1.status === 303, n1.status)
  check('redirige a /membresia/pago?provider=pagomedios&paymentId=…', n1.location === `${APP_URL}/membresia/pago?provider=pagomedios&paymentId=${p1}`, n1.location)
  check('Pagomedios devolvió customValue = paymentId', n1.form.get('customValue') === p1)
  check('payments: approved con approved_at y código de autorización', paymentRow(p1)?.status === 'approved' && paymentRow(p1)?.approved_at && /^\d{6}$/.test(paymentRow(p1)?.mp_payment_id ?? ''), paymentRow(p1))
  let mem = membershipOf('u1')
  const days1 = mem ? (new Date(mem.ends_at).getTime() - before) / DAY : 0
  check('membresía activa por ~30 días', mem?.status === 'active' && days1 > 29.9 && days1 < 30.1, mem)
  check('gracia = fin + 3 días', mem && new Date(mem.grace_ends_at) - new Date(mem.ends_at) === 3 * DAY, mem)
  check('payments.membership_id enlazado', paymentRow(p1)?.membership_id === mem?.id, paymentRow(p1))
  const endsAfterFirst = mem?.ends_at

  console.log('\n4. Idempotencia (no extender dos veces)')
  r = await call({ action: 'verify', paymentId: p1 })
  check('verify del mismo pago → approved', r.body?.status === 'approved', r)
  const replay = await fetch(`${FN_URL}?action=notify&paymentId=${p1}`, { method: 'POST', body: n1.form, redirect: 'manual' })
  check('notify repetido → 303', replay.status === 303)
  check('la fecha de fin NO cambió', membershipOf('u1')?.ends_at === endsAfterFirst, membershipOf('u1'))
  check('sigue habiendo una sola membresía', db.memberships.filter((m) => m.user_id === 'u1').length === 1)

  console.log('\n5. Pago rechazado')
  r = await create('mensual')
  const p2 = r.body?.paymentId
  const n2 = await payAndFollowNotify(r.body.url, 'reject')
  check('notify redirige a la app', n2.status === 303 && n2.location?.includes(p2), n2)
  check('payments: rejected', paymentRow(p2)?.status === 'rejected', paymentRow(p2))
  r = await call({ action: 'verify', paymentId: p2 })
  check('verify → rejected con mensaje', r.body?.status === 'rejected' && /rechazado/.test(r.body?.description), r)
  check('membresía intacta', membershipOf('u1')?.ends_at === endsAfterFirst)

  console.log('\n6. Pendiente y aprobado sin notify (el socio pulsa «Volver a verificar»)')
  r = await create('mensual')
  const p3 = r.body?.paymentId
  const url3 = r.body.url
  r = await call({ action: 'verify', paymentId: p3 })
  check('antes de pagar → pending', r.body?.status === 'pending', r)
  check('payments sigue pending', paymentRow(p3)?.status === 'pending')
  await payAndFollowNotify(url3, 'approve-silent')
  check('sin notify el pago sigue pending en BD', paymentRow(p3)?.status === 'pending')
  r = await call({ action: 'verify', paymentId: p3 })
  check('verify → approved', r.body?.status === 'approved', r)
  mem = membershipOf('u1')
  const added = (new Date(mem.ends_at) - new Date(endsAfterFirst)) / DAY
  check('renovación suma 30 días al fin vigente (no desde hoy)', Math.abs(added - 30) < 0.001, { antes: endsAfterFirst, despues: mem.ends_at })

  console.log('\n7. Concurrencia: notify + 2 verify a la vez')
  r = await create('mensual')
  const p4 = r.body?.paymentId
  const n4 = await payAndFollowNotify(r.body.url, 'approve-silent')
  const endsBefore4 = membershipOf('u1').ends_at
  const form4 = new URLSearchParams({ customValue: p4, status: '1' })
  const writesBefore4 = writes.memberships
  const results4 = await Promise.all([
    call({ action: 'verify', paymentId: p4 }),
    call({ action: 'verify', paymentId: p4 }),
    fetch(`${FN_URL}?action=notify&paymentId=${p4}`, { method: 'POST', body: form4, redirect: 'manual' }),
  ])
  const added4 = (new Date(membershipOf('u1').ends_at) - new Date(endsBefore4)) / DAY
  check('las 3 llamadas cruzadas responden bien', results4[0].body?.status === 'approved' && results4[1].body?.status === 'approved' && results4[2].status === 303, results4.slice(0, 2))
  check('la membresía se escribió UNA sola vez', writes.memberships - writesBefore4 === 1, { escrituras: writes.memberships - writesBefore4, token: n4.token })
  check('se extendió exactamente 30 días', Math.abs(added4 - 30) < 0.001, { dias: added4 })

  console.log('\n8. Seguridad')
  r = await call({ action: 'verify', paymentId: p1 }, 'jwt-u2')
  check('otro socio no puede verificar mi pago → 403', r.status === 403, r)
  const forged = await fetch(`${FN_URL}?action=notify`, {
    method: 'POST',
    body: new URLSearchParams({ customValue: randomUUID(), status: '1', authorizationCode: '999999' }),
    redirect: 'manual',
  })
  check(
    'notify falsificado con paymentId inexistente → solo redirige, sin tocar la BD',
    forged.status === 303 && db.payments.every((p) => p.mp_payment_id !== '999999'),
  )
  r = await create('mensual', 'jwt-u2')
  const p5 = r.body?.paymentId
  await fetch(`${FN_URL}?action=notify&paymentId=${p5}`, {
    method: 'POST',
    body: new URLSearchParams({ customValue: p5, status: '1', authorizationCode: '123456' }),
    redirect: 'manual',
  })
  check('notify que dice "aprobado" sin pago real en Pagomedios NO activa nada', paymentRow(p5)?.status === 'pending' && !membershipOf('u2'), { pago: paymentRow(p5), mem: membershipOf('u2') })

  console.log('\n9. Plan con visitas')
  r = await create('pase10', 'jwt-u2')
  await payAndFollowNotify(r.body.url, 'approve')
  mem = membershipOf('u2')
  check('pase de 10 visitas → visits_left = 10, 60 días', mem?.visits_left === 10 && Math.round((new Date(mem.ends_at) - Date.now()) / DAY) === 60, mem)
  r = await create('pase10', 'jwt-u2')
  await payAndFollowNotify(r.body.url, 'approve')
  check('recompra con pase vigente acumula visitas (20)', membershipOf('u2')?.visits_left === 20, membershipOf('u2'))

  console.log('\n9b. App nativa (navegador dentro de la app)')
  r = await create('mensual', 'jwt-u1', { native: true })
  const pn = r.body?.paymentId
  check('create con native → 200', r.status === 200 && pn, r)
  const nn = await payAndFollowNotify(r.body.url, 'approve')
  check('notify con native=1 → 200 con "cierra esta ventana" (sin redirigir a la web)', nn.status === 200 && !nn.location && /Cierra esta ventana/.test(nn.text), { status: nn.status, location: nn.location })
  check('igual verifica y aprueba el pago', paymentRow(pn)?.status === 'approved', paymentRow(pn))

  console.log('\n10. Sin PAGOMEDIOS_TOKEN')
  fn.kill()
  await new Promise((r2) => fn.on('exit', r2))
  fn = await startFn(fnEnv({ PAGOMEDIOS_TOKEN: '' }))
  r = await create('mensual')
  check('create → 503 PAGOMEDIOS_NOT_CONFIGURED', r.status === 503 && r.body?.code === 'PAGOMEDIOS_NOT_CONFIGURED', r)
  const nc = await fetch(`${FN_URL}?action=notify&paymentId=abc`, { method: 'POST', redirect: 'manual' })
  check('notify igual redirige a la app', nc.status === 303)

  console.log(`\n${passed} ✓  ${failed} ✗`)
}

run()
  .catch((err) => {
    console.error(err)
    failed++
  })
  .finally(() => {
    children.forEach((c) => c.kill())
    supabase.close()
    process.exit(failed ? 1 : 0)
  })
