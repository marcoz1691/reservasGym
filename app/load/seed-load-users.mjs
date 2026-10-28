#!/usr/bin/env node
/**
 * Seed del harness de carga (solo QA). Idempotente y resumible.
 *
 *   node --env-file=.env.load.local load/seed-load-users.mjs [--users N] [--sessions N]
 *
 * Qué hace:
 *  1. Crea (si faltan) los socios load.NNNN@zonacero.test y load.staff@zonacero.test por Admin API.
 *  2. Asegura sus filas en `profiles` (rol member/staff).
 *  3. Asegura UNA membresía por socio con el estado determinista 70/15/15 (active/grace/expired).
 *  4. Asegura las sesiones load-sNN + load-popular sobre una plantilla/zona existentes de QA.
 *  5. Escribe .tmp/load-meta.json.
 *
 * No crea plantillas, zonas ni planes. Nunca imprime claves.
 */
import {
  loadEnv,
  createClient,
  assertNoRealUsers,
  parseArgs,
  intArg,
  fail,
  mapPool,
  chunk,
  readJson,
  writeJson,
  stateForN,
  emailForN,
  inList,
  META_PATH,
  STAFF_EMAIL,
  POPULAR_SESSION_ID,
  LOAD_EMAIL_RE,
  LOAD_SESSION_TITLE_PREFIX,
  MAX_LOAD_USERS,
} from './lib/env.mjs'

const DAY_MS = 86_400_000
const CONCURRENCY = 5
const GUAYAQUIL_UTC_OFFSET_H = 5 // America/Guayaquil = UTC-5 todo el año (sin horario de verano)
const SLOT_MINUTES = 30
const SLOTS_PER_DAY = 10 // 17:00, 17:30 … 21:30 (hora de Guayaquil)
const FIRST_SLOT_HOUR = 17

const args = parseArgs()
const env = loadEnv({ service: true, password: true })
const userCount = intArg(args.users, env.userCount, { min: 1, max: MAX_LOAD_USERS, name: '--users' })
const sessionCount = intArg(args.sessions, env.sessionCount, { min: 1, max: 999, name: '--sessions' })
const marginMin = intArg(args['margin-min'], 30, { min: 0, max: 600, name: '--margin-min' })
const { rest, auth } = createClient(env)
await assertNoRealUsers(auth, env)

const t0 = Date.now()
const log = (msg) => console.log(msg)

/** Progreso por consola: una línea cada ~10 % o cada 100 elementos. */
function progress(label, total) {
  let done = 0
  const step = Math.max(1, Math.min(100, Math.floor(total / 10)))
  return () => {
    done++
    if (done === total || done % step === 0) {
      const s = ((Date.now() - t0) / 1000).toFixed(0)
      log(`  ${label}: ${done}/${total} (${s}s)`)
    }
  }
}

/** Normaliza ids de zona como lo hace el RPC (member_booking_block_reason). */
const normZone = (z) => String(z).toLowerCase().replace(/[_-]/g, '')

// --------------------------------------------------------------------------
// 1. Elegir plantilla, zona y plan de carga (todo EXISTENTE en QA)
// --------------------------------------------------------------------------

async function pickTemplate() {
  const templates = await rest.select('class_templates', 'select=id,zone_id,title,kind,duration_minutes,capacity,trainer_id&order=id')
  if (!templates.length) fail('QA no tiene class_templates: el seed no las crea.')
  const tpl =
    templates.find((t) => t.id === 'tpl-gym-open') ??
    templates.find((t) => t.kind === 'open') ??
    templates[0]
  return tpl
}

async function pickPlan(zoneId) {
  const plans = await rest.select(
    'membership_plans',
    'select=id,name,price_cents,duration_days,visit_quota,allowed_zone_ids,active,kind&active=eq.true&kind=eq.membership&order=created_at',
  )
  const coversZone = (p) => {
    const z = p.allowed_zone_ids ?? []
    return z.length === 0 || z.some((x) => normZone(x) === normZone(zoneId))
  }
  const monthly = plans.filter((p) => p.duration_days >= 28 && p.duration_days <= 31 && coversZone(p))
  if (!monthly.length) {
    fail(`No hay plan activo kind=membership, mensual (28-31 días) y que cubra la zona "${zoneId}". Revisa membership_plans en QA.`)
  }
  // Preferencia: sin cupo de visitas, zonas abiertas (lista vacía), 30 días.
  const score = (p) =>
    (p.visit_quota == null ? 0 : 4) + ((p.allowed_zone_ids ?? []).length === 0 ? 0 : 2) + (p.duration_days === 30 ? 0 : 1)
  monthly.sort((a, b) => score(a) - score(b))
  return monthly[0]
}

// --------------------------------------------------------------------------
// 2. Usuarios Auth + perfiles
// --------------------------------------------------------------------------

async function ensureUsers() {
  log('→ Usuarios Auth: listando existentes…')
  const existing = await auth.listUsers()
  const byEmail = new Map()
  const unmarked = []
  for (const u of existing) {
    const e = (u.email ?? '').toLowerCase()
    if (!LOAD_EMAIL_RE.test(e)) continue
    byEmail.set(e, u.id)
    // Propiedad: solo se toca lo que el harness marcó con user_metadata.load_test === true.
    if (u.user_metadata?.load_test !== true) unmarked.push(e)
  }
  log(`  ${existing.length} usuarios en Auth, ${byEmail.size} son de carga.`)
  if (unmarked.length) {
    fail(
      `${unmarked.length} usuarios con correo de carga existen SIN user_metadata.load_test=true (no son del harness). ` +
        `No se toca nada. Primeros: ${unmarked.slice(0, 5).join(', ')}`,
    )
  }

  const wanted = []
  for (let n = 1; n <= userCount; n++) {
    wanted.push({ n, email: emailForN(n), full_name: `Load ${String(n).padStart(4, '0')}` })
  }
  wanted.push({ n: 0, email: STAFF_EMAIL, full_name: 'Load Staff' })

  const errors = []
  const missing = wanted.filter((w) => !byEmail.has(w.email))
  const present = wanted.filter((w) => byEmail.has(w.email))
  log(`  Faltan ${missing.length} de ${wanted.length}; ${present.length} existentes (se restablecen contraseña y metadatos).`)

  if (present.length) {
    const tick = progress('restablecidos', present.length)
    await mapPool(present, CONCURRENCY, async (w) => {
      try {
        await auth.updateUser(byEmail.get(w.email), {
          password: env.password,
          userMetadata: { load_test: true, full_name: w.full_name },
        })
      } catch (err) {
        errors.push(`${w.email}: no se pudo restablecer contraseña/metadatos: ${err.message}`)
      }
      tick()
    })
    if (errors.length) {
      fail(`No se pudo verificar/restablecer ${errors.length} usuarios existentes; abortado. Primeros: ${errors.slice(0, 3).join(' | ')}`)
    }
  }

  if (missing.length) {
    const tick = progress('creados', missing.length)
    await mapPool(missing, CONCURRENCY, async (w) => {
      try {
        const u = await auth.createUser({
          email: w.email,
          password: env.password,
          userMetadata: { load_test: true, full_name: w.full_name },
        })
        byEmail.set(w.email, u.id)
      } catch (err) {
        errors.push(`${w.email}: ${err.message}`)
      }
      tick()
    })
  }
  if (errors.length) {
    log(`  ⚠ ${errors.length} usuarios no se pudieron crear (re-corre el seed para completarlos). Primeros errores:`)
    for (const e of errors.slice(0, 3)) log(`    ${e}`)
  }
  return { wanted, byEmail, errors }
}

async function ensureProfiles(wanted, byEmail) {
  log('→ Perfiles: verificando…')
  const profiles = await rest.selectAll('profiles', 'select=id,email,role&email=like.load.*')
  const byId = new Map(profiles.map((p) => [p.id, p]))

  const toInsert = []
  const roleFix = { member: [], staff: [] }
  for (const w of wanted) {
    const id = byEmail.get(w.email)
    if (!id) continue
    const role = w.email === STAFF_EMAIL ? 'staff' : 'member'
    const p = byId.get(id)
    if (!p) toInsert.push({ id, email: w.email, full_name: w.full_name, role })
    else if (p.role !== role) roleFix[role].push(id)
  }
  // Si el trigger handle_new_user no creó el perfil, lo completamos (service role: auth.uid() nulo, el guard de rol lo permite).
  for (const batch of chunk(toInsert, 200)) {
    await rest.insert('profiles', batch, { onConflict: 'id', merge: true })
  }
  for (const role of ['member', 'staff']) {
    for (const ids of chunk(roleFix[role], 100)) {
      await rest.update('profiles', `id=${inList(ids)}`, { role })
    }
  }
  log(`  perfiles creados: ${toInsert.length}, roles corregidos: ${roleFix.member.length + roleFix.staff.length}.`)
}

// --------------------------------------------------------------------------
// 3. Membresías 70/15/15 (una por socio)
// --------------------------------------------------------------------------

function membershipFor(state, now, plan) {
  const iso = (ms) => new Date(ms).toISOString()
  const visits = plan.visit_quota ?? null
  if (state === 'active') {
    return { status: 'active', starts_at: iso(now - 5 * DAY_MS), ends_at: iso(now + 25 * DAY_MS), grace_ends_at: iso(now + 28 * DAY_MS), visits_left: visits }
  }
  if (state === 'grace') {
    const ends = now - 1 * DAY_MS
    return { status: 'grace', starts_at: iso(ends - 30 * DAY_MS), ends_at: iso(ends), grace_ends_at: iso(ends + 3 * DAY_MS), visits_left: visits }
  }
  const ends = now - 10 * DAY_MS
  return { status: 'expired', starts_at: iso(ends - 30 * DAY_MS), ends_at: iso(ends), grace_ends_at: iso(ends + 3 * DAY_MS), visits_left: visits }
}

/** Estado efectivo de una fila según las fechas (misma regla del RPC: gracia hasta grace_ends_at). */
function effectiveState(m, now) {
  if (now <= new Date(m.ends_at).getTime()) return 'active'
  const g = m.grace_ends_at ? new Date(m.grace_ends_at).getTime() : new Date(m.ends_at).getTime() + 3 * DAY_MS
  return now <= g ? 'grace' : 'expired'
}

async function ensureMemberships(byEmail, plan) {
  log('→ Membresías: verificando…')
  const ids = []
  const emailOf = new Map()
  for (let n = 1; n <= userCount; n++) {
    const id = byEmail.get(emailForN(n))
    if (id) {
      ids.push({ n, id })
      emailOf.set(id, emailForN(n))
    }
  }
  const now = Date.now()

  // Membresías existentes de los socios de carga (en lotes de 100 ids para no pasarse del largo de URL).
  const batches = chunk(ids, 100)
  const found = await mapPool(batches, 3, (b) =>
    rest.selectAll('memberships', `select=id,user_id,plan_id,status,starts_at,ends_at,grace_ends_at&user_id=${inList(b.map((x) => x.id))}`),
  )
  const byUser = new Map()
  for (const m of found.flat()) {
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, [])
    byUser.get(m.user_id).push(m)
  }

  // Exactamente UNA membresía por socio del harness: si hay extras se aborta sin escribir nada.
  const extras = []
  for (const { id } of ids) {
    const rows = byUser.get(id) ?? []
    if (rows.length > 1) extras.push(`${emailOf.get(id)} → ${rows.map((r) => r.id).join(', ')}`)
  }
  if (extras.length) {
    fail(`${extras.length} socios de carga tienen más de una membresía (el harness exige una). Abortado sin cambios:\n  ${extras.slice(0, 10).join('\n  ')}`)
  }

  const wantVisits = plan.visit_quota ?? null
  const near = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= 1000
  const isCorrect = (m, want) =>
    m.plan_id === plan.id &&
    m.status === want &&
    effectiveState(m, now) === want &&
    (m.visits_left ?? null) === wantVisits &&
    !!m.grace_ends_at &&
    new Date(m.starts_at).getTime() < new Date(m.ends_at).getTime() &&
    near(m.grace_ends_at, new Date(new Date(m.ends_at).getTime() + 3 * DAY_MS))

  const toInsert = []
  const toFix = { active: [], grace: [], expired: [] }
  let ok = 0
  for (const { n, id } of ids) {
    const want = stateForN(n, userCount)
    const rows = byUser.get(id) ?? []
    if (!rows.length) {
      toInsert.push({ user_id: id, plan_id: plan.id, ...membershipFor(want, now, plan) })
    } else if (isCorrect(rows[0], want)) ok++
    else toFix[want].push(rows[0].id)
  }

  for (const batch of chunk(toInsert, 200)) {
    await rest.insert('memberships', batch)
  }
  let fixed = 0
  for (const state of Object.keys(toFix)) {
    for (const mids of chunk(toFix[state], 100)) {
      const { status, starts_at, ends_at, grace_ends_at, visits_left } = membershipFor(state, now, plan)
      await rest.update('memberships', `id=${inList(mids)}`, { plan_id: plan.id, status, starts_at, ends_at, grace_ends_at, visits_left })
      fixed += mids.length
    }
  }
  log(`  insertadas: ${toInsert.length}, corregidas (plan/estado/fechas/visitas): ${fixed}, ya correctas: ${ok}.`)
}

// --------------------------------------------------------------------------
// 4. Sesiones load-sNN + load-popular
// --------------------------------------------------------------------------

/** ¿El inicio cae en la rejilla del fixture (17:00 + k*30 min hasta 21:30, hora de Guayaquil)? */
function onGrid(startMs) {
  const local = new Date(startMs - GUAYAQUIL_UTC_OFFSET_H * 3_600_000)
  if (local.getUTCSeconds() !== 0 || local.getUTCMilliseconds() !== 0) return false
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes() - FIRST_SLOT_HOUR * 60
  return mins >= 0 && mins % SLOT_MINUTES === 0 && mins / SLOT_MINUTES < SLOTS_PER_DAY
}

/**
 * Genera las próximas `count` franjas de 30 min (17:00–21:30 hora de Guayaquil, 10 por día) que
 * empiecen al menos `marginMin` minutos después de ahora y que NO se crucen con ninguna sesión
 * existente de la misma zona (`busy` = [[inicioMs, finMs], …]). Son consecutivas y sin solape, para
 * que un mismo socio pueda reservar varias sesiones (el RPC rechaza reservas que se cruzan).
 */
function nextSlots(count, nowMs, busy) {
  const local = new Date(nowMs - GUAYAQUIL_UTC_OFFSET_H * 3_600_000)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const d = local.getUTCDate()
  const slots = []
  let skipped = 0
  for (let day = 0; slots.length < count && day < 400; day++) {
    for (let s = 0; s < SLOTS_PER_DAY && slots.length < count; s++) {
      const startMs = Date.UTC(y, m, d + day, FIRST_SLOT_HOUR + GUAYAQUIL_UTC_OFFSET_H, s * SLOT_MINUTES)
      if (startMs < nowMs + marginMin * 60_000) continue
      const endMs = startMs + SLOT_MINUTES * 60_000
      if (busy.some(([bs, be]) => bs < endMs && be > startMs)) {
        skipped++
        continue
      }
      slots.push(startMs)
    }
  }
  if (slots.length < count) fail('No hay suficientes franjas libres en los próximos 400 días para las sesiones de carga.')
  return { slots, skipped }
}

async function ensureSessions(tpl) {
  log('→ Sesiones: verificando…')
  const pad = sessionCount > 99 ? 3 : 2
  const ids = Array.from({ length: sessionCount }, (_, i) => `load-s${String(i + 1).padStart(pad, '0')}`)
  const all = [POPULAR_SESSION_ID, ...ids]
  const now = Date.now()

  // Propiedad: toda sesión load-* existente debe llevar la marca de título; si no, no se adopta.
  const existing = await rest.selectAll('sessions', 'select=id,title,zone_id,starts_at,ends_at,capacity,booked_count&id=like.load-*')
  const foreign = existing.filter((s) => !String(s.title ?? '').startsWith(LOAD_SESSION_TITLE_PREFIX))
  if (foreign.length) {
    fail(
      `${foreign.length} sesiones con id load-* NO llevan el prefijo "${LOAD_SESSION_TITLE_PREFIX}" en el título (no son del harness). ` +
        `No se adoptan; abortado. Primeras: ${foreign.slice(0, 5).map((s) => s.id).join(', ')}`,
    )
  }
  const byId = new Map(existing.map((s) => [s.id, s]))

  // Deriva del fixture: las sesiones de carga existentes deben estar en la rejilla y no cruzarse entre sí.
  const iv = existing
    .map((s) => ({ id: s.id, st: new Date(s.starts_at).getTime(), en: new Date(s.ends_at).getTime() }))
    .sort((a, b) => a.st - b.st)
  const drift = iv.filter((x) => !onGrid(x.st) || x.en - x.st !== SLOT_MINUTES * 60_000).map((x) => x.id)
  const overlaps = []
  for (let i = 1; i < iv.length; i++) if (iv[i].st < iv[i - 1].en) overlaps.push(`${iv[i - 1].id}↔${iv[i].id}`)
  if (drift.length || overlaps.length) {
    fail(
      `Deriva del fixture de sesiones (corre load:cleanup --yes y siembra de nuevo): ` +
        `${drift.length} fuera de la rejilla de 30 min [${drift.slice(0, 4).join(', ')}], ` +
        `${overlaps.length} solapes [${overlaps.slice(0, 4).join(', ')}].`,
    )
  }

  // Huecos contra TODAS las sesiones de la zona desde ahora (las de carga ya están incluidas).
  const sinceIso = new Date(now - 24 * 3_600_000).toISOString()
  const zoneSessions = await rest.selectAll(
    'sessions',
    `select=id,starts_at,ends_at&zone_id=eq.${encodeURIComponent(tpl.zone_id)}&ends_at=gte.${encodeURIComponent(sinceIso)}`,
  )
  const busy = zoneSessions.map((s) => [new Date(s.starts_at).getTime(), new Date(s.ends_at).getTime()])

  const missing = all.filter((id) => !byId.has(id))
  const { slots, skipped } = nextSlots(missing.length, now, busy)
  const rows = missing.map((id, i) => {
    const startMs = slots[i]
    return {
      id,
      template_id: tpl.id,
      zone_id: tpl.zone_id,
      title: id === POPULAR_SESSION_ID ? `${LOAD_SESSION_TITLE_PREFIX}${tpl.title} (popular)` : `${LOAD_SESSION_TITLE_PREFIX}${tpl.title}`,
      kind: tpl.kind,
      starts_at: new Date(startMs).toISOString(),
      ends_at: new Date(startMs + SLOT_MINUTES * 60_000).toISOString(),
      capacity: id === POPULAR_SESSION_ID ? env.popularCapacity : tpl.capacity,
      trainer_id: tpl.trainer_id ?? null,
      booked_count: 0,
    }
  })
  for (const batch of chunk(rows, 100)) {
    // ignore-duplicates: jamás pisa booked_count de una sesión que ya existe.
    await rest.insert('sessions', batch, { onConflict: 'id', ignoreDuplicates: true })
  }

  // La capacidad de la popular sigue a LOAD_POPULAR_CAPACITY.
  const pop = byId.get(POPULAR_SESSION_ID)
  let capFixed = false
  if (pop && pop.capacity !== env.popularCapacity) {
    await rest.update('sessions', `id=eq.${POPULAR_SESSION_ID}`, { capacity: env.popularCapacity })
    capFixed = true
  }
  const past = existing.filter((s) => all.includes(s.id) && new Date(s.starts_at).getTime() <= now)
  log(`  creadas: ${rows.length}, ya existían: ${all.length - rows.length}${capFixed ? ', capacidad de load-popular actualizada' : ''}${skipped ? `; ${skipped} franjas omitidas por cruzarse con otras sesiones de la zona` : ''}.`)
  if (past.length) {
    log(`  ⚠ ${past.length} sesiones de carga ya empezaron (${past.slice(0, 3).map((s) => s.id).join(', ')}…). Corre load:cleanup --yes y vuelve a sembrar para tener sesiones futuras.`)
  }
  return { ids, startsAt: Object.fromEntries([...existing.filter((s) => all.includes(s.id)).map((s) => [s.id, s.starts_at]), ...rows.map((r) => [r.id, r.starts_at])]) }
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main() {
  log(`Seed de carga en ${env.label} —${userCount} socios + staff, ${sessionCount} sesiones + load-popular (capacidad ${env.popularCapacity}).`)
  const tpl = await pickTemplate()
  const plan = await pickPlan(tpl.zone_id)
  log(`  plantilla: ${tpl.id} (zona ${tpl.zone_id}, kind ${tpl.kind}); plan: "${plan.name}" (${plan.duration_days} días${plan.visit_quota != null ? `, cupo ${plan.visit_quota}` : ''}).`)

  const { wanted, byEmail, errors } = await ensureUsers()
  await ensureProfiles(wanted, byEmail)
  await ensureMemberships(byEmail, plan)
  const { ids, startsAt } = await ensureSessions(tpl)

  const prev = readJson(META_PATH, null)
  const states = { active: 0, grace: 0, expired: 0 }
  for (let n = 1; n <= userCount; n++) states[stateForN(n, userCount)]++
  const meta = {
    created_at: prev?.created_at ?? new Date().toISOString(),
    plan_id: plan.id,
    user_count: userCount,
    popular_session_id: POPULAR_SESSION_ID,
    popular_capacity: env.popularCapacity,
    session_ids: ids,
    zone_id: tpl.zone_id,
    // Extras informativos (los consumidores del contrato los pueden ignorar):
    updated_at: new Date().toISOString(),
    template_id: tpl.id,
    staff_user_id: byEmail.get(STAFF_EMAIL) ?? null,
    user_states: states,
    session_starts_at: startsAt,
  }
  writeJson(META_PATH, meta)

  const secs = ((Date.now() - t0) / 1000).toFixed(0)
  log(`\n✓ Seed ${errors.length ? 'INCOMPLETO' : 'completo'} en ${secs}s. Meta: load/.tmp/load-meta.json`)
  log(`  estados: active ${states.active}, grace ${states.grace}, expired ${states.expired}.`)
  if (errors.length) {
    log(`  Faltaron ${errors.length} usuarios: vuelve a correr el seed.`)
    process.exit(1)
  }
}

main().catch((err) => fail(err.message))
