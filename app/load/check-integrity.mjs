/**
 * Verificador de integridad post-carga (agente B2, datos).
 *
 * Uso (desde app/): node --env-file=.env.load.local load/check-integrity.mjs --run <nombre> [--no-summary]
 *
 * Solo LEE (service role). Antes de los chequeos valida el fixture (F0) contra .tmp/load-meta.json:
 * sesiones encontradas = session_ids + popular, nº de usuarios sintéticos = user_count y las tres
 * cohortes de membresía (active / grace / expired) presentes. Si F0 falla, no se evalúa I1-I8.
 *
 *   I1 ocupantes (confirmed + pending + attended) <= capacidad
 *   I2 booked_count == ocupantes (mismos estados que cuenta el trigger sync_session_booked_count)
 *   I3 sin reservas activas duplicadas (session_id, user_id) en confirmed/pending/attended/waitlisted
 *   I4 sin booked_count ni capacity negativos
 *   I5 ningún socio SIN membresía vigente (regla de current_membership_id / member_booking_block_reason,
 *      con la gracia de 3 días) tiene reserva activa en load-*. El socio en gracia SÍ puede reservar.
 *      Falla también si no hay evidencia (sin cohorte expired, sin tokens expired, sin reservas activas).
 *   I6 posiciones de lista de espera únicas y contiguas (1..n) por sesión, y cada espera con su reserva
 *   I7 OBLIGATORIO (salvo --no-summary): reports/<run>/summary-a.json existe y 1 <= booking_ok <= capacidad
 *      total de las sesiones de carga
 *   I8 ninguna reserva con un status fuera del esquema (BookingStatus)
 *
 * Escribe reports/<run>/integrity.json y sale con código 1 si falla cualquier chequeo (2 = error inesperado).
 */
import { join } from 'node:path'
import {
  REPORTS_DIR, TOKENS_PATH, META_PATH, LOAD_SESSION_ID_RE, LOAD_EMAIL_RE, STAFF_EMAIL, POPULAR_SESSION_ID,
  loadEnv, createClient, parseArgs, fail, readJson, writeJson, chunk, inList,
} from './lib/env.mjs'

/** Estados que ocupan cupo: los mismos que cuenta el trigger sync_session_booked_count. */
const OCCUPYING = ['confirmed', 'pending', 'attended']
/** Estados "activos" para duplicados y elegibilidad (lo que bloquea book_session + espera + asistidas). */
const ACTIVE = ['confirmed', 'pending', 'attended', 'waitlisted']
/** Estados permitidos por el esquema (src/domain/models.ts BookingStatus). */
const KNOWN_STATUSES = ['confirmed', 'pending', 'cancelled', 'attended', 'no_show', 'waitlisted']
const DAY = 86400000

/** Todos los ids posibles de sesión de carga (lista exacta, sin patrones difusos). */
function candidateSessionIds() {
  const ids = [POPULAR_SESSION_ID]
  for (let i = 0; i < 100; i++) ids.push(`load-s${String(i).padStart(2, '0')}`)
  for (let i = 0; i < 1000; i++) ids.push(`load-s${String(i).padStart(3, '0')}`)
  return ids.filter((id) => LOAD_SESSION_ID_RE.test(id))
}

async function fetchLoadSessions(rest) {
  const out = []
  for (const part of chunk(candidateSessionIds(), 100)) {
    const rows = await rest.select('sessions', `select=id,capacity,booked_count,starts_at&id=${inList(part)}`)
    out.push(...rows)
  }
  return out.filter((s) => LOAD_SESSION_ID_RE.test(s.id)).sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Réplica de current_membership_id + el bloqueo de member_booking_block_reason (booking-rpc.sql):
 * vigente = no cancelada, no day_pass, ya empezó y at <= coalesce(grace_ends_at, ends_at + 3 días).
 * Pase del día vigente (no cancelado, starts<=at<=ends) también da acceso (se asume que cubre la zona).
 * Devuelve { cohort: 'active'|'grace'|'expired', blocked: string|null }.
 */
function evaluateMembership(list, kindOf, at) {
  const t = at.getTime()
  const graceEnd = (m) => (m.grace_ends_at ? new Date(m.grace_ends_at).getTime() : new Date(m.ends_at).getTime() + 3 * DAY)
  const current = list
    .filter((m) => m.status !== 'cancelled' && kindOf(m.plan_id) !== 'day_pass' && new Date(m.starts_at).getTime() <= t && t <= graceEnd(m))
    .sort((a, b) => new Date(b.ends_at) - new Date(a.ends_at))[0]
  const dayPass = list.some(
    (m) => m.status !== 'cancelled' && kindOf(m.plan_id) === 'day_pass' && new Date(m.starts_at).getTime() <= t && t <= new Date(m.ends_at).getTime(),
  )
  if (!current) {
    const cohort = 'expired'
    if (dayPass) return { cohort, blocked: null }
    if (list.length === 0) return { cohort, blocked: 'sin membresía' }
    if (list.every((m) => m.status === 'cancelled')) return { cohort, blocked: 'todas las membresías canceladas' }
    return { cohort, blocked: 'membresía vencida más allá de la gracia' }
  }
  const cohort = t <= new Date(current.ends_at).getTime() ? 'active' : 'grace'
  if (current.visits_left != null && current.visits_left <= 0 && !dayPass) return { cohort, blocked: 'sin visitas disponibles' }
  return { cohort, blocked: null }
}

/** Extrae el contador de una métrica k6 en: metrics.X, data.metrics.X, X (values.count | count | value). */
function extractMetric(summary, name) {
  if (!summary || typeof summary !== 'object') return null
  const roots = [summary.metrics, summary.data?.metrics, summary]
  for (const root of roots) {
    const m = root?.[name]
    if (typeof m === 'number') return m
    if (m && typeof m === 'object') {
      for (const v of [m.values?.count, m.count, m.values?.value, m.value]) {
        if (typeof v === 'number') return v
      }
    }
  }
  return null
}

async function main() {
  const args = parseArgs()
  const run = typeof args.run === 'string' ? args.run.trim() : ''
  if (!run || !/^[A-Za-z0-9._-]+$/.test(run) || run.startsWith('.')) {
    fail('Uso: check-integrity.mjs --run <nombre> [--no-summary]  (nombre: letras, números, ".", "_" y "-")')
  }
  const noSummary = args['no-summary'] === true

  const env = loadEnv({ service: true })
  const { rest, auth } = createClient(env)
  const t0 = Date.now()
  const now = new Date()
  const outPath = join(REPORTS_DIR, run, 'integrity.json')

  // ---------------- F0: fixture ----------------
  const meta = readJson(META_PATH, null)
  const fixtureIssues = []
  const sessions = await fetchLoadSessions(rest)
  const sessionIds = sessions.map((s) => s.id)
  console.log(`Sesiones load-* encontradas: ${sessions.length}`)

  const fixture = { sessions_found: sessions.length, expected_sessions: null, synthetic_members: null, expected_users: null, cohorts: null }
  if (!meta || typeof meta !== 'object') {
    fixtureIssues.push('No existe o es ilegible load/.tmp/load-meta.json (¿corriste load:seed?).')
  } else {
    const expected = new Set([...(Array.isArray(meta.session_ids) ? meta.session_ids : []), meta.popular_session_id ?? POPULAR_SESSION_ID])
    fixture.expected_sessions = expected.size
    const found = new Set(sessionIds)
    const faltan = [...expected].filter((id) => !found.has(id))
    const sobran = [...found].filter((id) => !expected.has(id))
    if (faltan.length) fixtureIssues.push(`Faltan ${faltan.length} sesión(es) del meta en QA: ${faltan.slice(0, 5).join(', ')}`)
    if (sobran.length) fixtureIssues.push(`Hay ${sobran.length} sesión(es) load-* en QA que no están en el meta: ${sobran.slice(0, 5).join(', ')}`)
    if (!Number.isInteger(meta.user_count) || meta.user_count < 1) fixtureIssues.push('load-meta.json sin user_count válido.')
  }

  // Usuarios sintéticos (Auth): email de carga + load_test=true.
  const synthetic = (await auth.listUsers()).filter((u) => LOAD_EMAIL_RE.test(u.email ?? '') && u.user_metadata?.load_test === true)
  const members = synthetic.filter((u) => u.email !== STAFF_EMAIL)
  fixture.synthetic_members = members.length
  fixture.expected_users = meta?.user_count ?? null
  if (meta?.user_count && members.length !== meta.user_count) {
    fixtureIssues.push(`Socios sintéticos en Auth: ${members.length}; el meta dice user_count=${meta.user_count}.`)
  }
  if (!synthetic.some((u) => u.email === STAFF_EMAIL)) fixtureIssues.push(`Falta el usuario staff ${STAFF_EMAIL}.`)

  // Cohortes por membresía real en BD (regla de membresía vigente, a la hora de la verificación).
  const plans = await rest.selectAll('membership_plans', 'select=id,kind&order=id')
  const kindById = new Map(plans.map((p) => [p.id, p.kind]))
  const kindOf = (id) => kindById.get(id) ?? 'membership'
  const memberIds = members.map((u) => u.id)
  const msByUser = new Map()
  for (const part of chunk(memberIds, 100)) {
    const rows = await rest.selectAll('memberships', `select=user_id,plan_id,status,starts_at,ends_at,grace_ends_at,visits_left&user_id=${inList(part)}&order=id`)
    for (const m of rows) {
      if (!msByUser.has(m.user_id)) msByUser.set(m.user_id, [])
      msByUser.get(m.user_id).push(m)
    }
  }
  const cohorts = { active: 0, grace: 0, expired: 0 }
  for (const id of memberIds) cohorts[evaluateMembership(msByUser.get(id) ?? [], kindOf, now).cohort]++
  fixture.cohorts = cohorts
  for (const c of ['active', 'grace', 'expired']) {
    if (cohorts[c] === 0) fixtureIssues.push(`Cohorte "${c}" vacía (activos=${cohorts.active}, gracia=${cohorts.grace}, vencidos=${cohorts.expired}).`)
  }

  if (fixtureIssues.length) {
    console.log('\n✗ F0 fixture inválido; no se evalúan I1-I8:')
    for (const i of fixtureIssues) console.log('  -', i)
    writeJson(outPath, { run, generated_at: now.toISOString(), passed: false, fixture_ok: false, fixture, fixture_issues: fixtureIssues })
    console.log(`\nReporte: ${outPath}`)
    process.exit(1)
  }
  console.log(`Fixture OK: ${sessions.length} sesiones, ${members.length} socios (activos ${cohorts.active} · gracia ${cohorts.grace} · vencidos ${cohorts.expired}).`)

  // ---------------- Datos ----------------
  const bookings = []
  const waits = []
  for (const part of chunk(sessionIds, 50)) {
    const f = `session_id=${inList(part)}`
    bookings.push(...(await rest.selectAll('bookings', `select=id,session_id,user_id,status&${f}&order=id`)))
    waits.push(...(await rest.selectAll('waitlist_entries', `select=id,session_id,user_id,position&${f}&order=id`)))
  }
  console.log(`Reservas: ${bookings.length} · esperas: ${waits.length}`)

  const bySession = new Map(sessionIds.map((id) => [id, { b: [], w: [] }]))
  for (const b of bookings) bySession.get(b.session_id)?.b.push(b)
  for (const w of waits) bySession.get(w.session_id)?.w.push(w)

  const checks = {
    I1: { desc: 'Ocupantes <= capacidad', violations: [] },
    I2: { desc: 'booked_count = ocupantes (confirmed+pending+attended)', violations: [] },
    I3: { desc: 'Sin reservas activas duplicadas', violations: [] },
    I4: { desc: 'Sin booked_count/capacity negativos', violations: [] },
    I5: { desc: 'Sin socios sin membresía vigente con reserva activa', violations: [] },
    I6: { desc: 'Lista de espera única, contigua y consistente', violations: [] },
    I7: { desc: '1 <= booking_ok <= capacidad total (summary-a.json)', violations: [], skipped: false },
    I8: { desc: 'Sin status de reserva desconocido', violations: [] },
  }
  const perSession = []

  for (const s of sessions) {
    const { b, w } = bySession.get(s.id)
    const occupants = b.filter((x) => OCCUPYING.includes(x.status)).length
    const waitlistedB = b.filter((x) => x.status === 'waitlisted').length

    if (occupants > s.capacity) checks.I1.violations.push({ session: s.id, ocupantes: occupants, capacity: s.capacity })
    if (s.booked_count !== occupants) checks.I2.violations.push({ session: s.id, booked_count: s.booked_count, ocupantes: occupants })
    if (s.booked_count < 0 || s.capacity < 0) checks.I4.violations.push({ session: s.id, booked_count: s.booked_count, capacity: s.capacity })

    const seen = new Map()
    for (const x of b) {
      if (!ACTIVE.includes(x.status)) continue
      seen.set(x.user_id, (seen.get(x.user_id) ?? 0) + 1)
    }
    for (const [user_id, n] of seen) {
      if (n > 1) checks.I3.violations.push({ session: s.id, user_id, reservas_activas: n })
    }

    const positions = w.map((x) => x.position).sort((p, q) => p - q)
    if (!positions.every((p, i) => p === i + 1)) {
      checks.I6.violations.push({ session: s.id, motivo: 'posiciones no contiguas/únicas', posiciones: positions.slice(0, 50) })
    }
    const waitUsers = new Set(w.map((x) => x.user_id))
    const waitBookingUsers = new Set(b.filter((x) => x.status === 'waitlisted').map((x) => x.user_id))
    if (waitUsers.size !== w.length) checks.I6.violations.push({ session: s.id, motivo: 'usuario repetido en la lista de espera' })
    const sinReserva = [...waitUsers].filter((u) => !waitBookingUsers.has(u))
    const sinEspera = [...waitBookingUsers].filter((u) => !waitUsers.has(u))
    if (sinReserva.length || sinEspera.length) {
      checks.I6.violations.push({
        session: s.id, motivo: 'espera y reserva waitlisted no coinciden',
        espera_sin_reserva: sinReserva.length, reserva_sin_espera: sinEspera.length,
      })
    }

    perSession.push({ session: s.id, capacity: s.capacity, booked_count: s.booked_count, ocupantes: occupants, waitlisted: waitlistedB, esperas: w.length })
  }

  // I8: status desconocidos
  const unknown = new Map()
  for (const x of bookings) {
    if (!KNOWN_STATUSES.includes(x.status)) unknown.set(x.status, (unknown.get(x.status) ?? 0) + 1)
  }
  for (const [status, n] of unknown) checks.I8.violations.push({ status: String(status), reservas: n })

  // I5: reglas de membresía vigente sobre quienes tienen reserva activa.
  const activeBookings = bookings.filter((x) => ACTIVE.includes(x.status))
  const activeUserIds = [...new Set(activeBookings.map((x) => x.user_id))]
  const msActive = new Map()
  const roleById = new Map()
  for (const part of chunk(activeUserIds, 100)) {
    const rows = await rest.selectAll('memberships', `select=user_id,plan_id,status,starts_at,ends_at,grace_ends_at,visits_left&user_id=${inList(part)}&order=id`)
    for (const m of rows) {
      if (!msActive.has(m.user_id)) msActive.set(m.user_id, [])
      msActive.get(m.user_id).push(m)
    }
    for (const p of await rest.selectAll('profiles', `select=id,role&id=${inList(part)}&order=id`)) roleById.set(p.id, p.role)
  }
  const blockedCache = new Map()
  for (const uid of activeUserIds) blockedCache.set(uid, evaluateMembership(msActive.get(uid) ?? [], kindOf, now).blocked)
  for (const x of activeBookings) {
    const blocked = blockedCache.get(x.user_id)
    // Staff/admin no pasan por member_booking_block_reason.
    if (blocked && (roleById.get(x.user_id) ?? 'member') === 'member') {
      checks.I5.violations.push({ session: x.session_id, user_id: x.user_id, booking_status: x.status, motivo: blocked })
    }
  }
  // Evidencia mínima: sin esto I5 no demuestra nada y cuenta como FALLA.
  const tokens = readJson(TOKENS_PATH, null)
  const expiredTokens = Array.isArray(tokens) ? tokens.filter((t) => t.state === 'expired').length : 0
  const evidencia = []
  if (cohorts.expired === 0) evidencia.push('no hay socios de la cohorte expired')
  if (!Array.isArray(tokens)) evidencia.push('tokens.json ausente o ilegible')
  else if (expiredTokens === 0) evidencia.push('tokens.json no incluye usuarios expired (mint sin --states expired)')
  if (activeBookings.length === 0) evidencia.push('no hay reservas activas en sesiones load-* (¿corrió el escenario A?)')
  if (evidencia.length) {
    checks.I5.violations.push({ motivo: 'evidencia insuficiente', detalle: evidencia })
  }
  checks.I5.evidencia = { cohort_expired: cohorts.expired, tokens_expired: expiredTokens, reservas_activas: activeBookings.length }

  // I7: booking_ok del escenario A (obligatorio salvo --no-summary).
  const summaryPath = join(REPORTS_DIR, run, 'summary-a.json')
  const totalCapacity = sessions.reduce((a, s) => a + s.capacity, 0)
  if (noSummary) {
    checks.I7.skipped = true
    checks.I7.nota = 'Omitido por --no-summary explícito.'
  } else {
    const summary = readJson(summaryPath, null)
    if (!summary) {
      checks.I7.violations.push({ motivo: `falta o es ilegible ${summaryPath}` })
    } else {
      const bookingOk = extractMetric(summary, 'booking_ok')
      if (bookingOk === null) {
        checks.I7.violations.push({ motivo: 'summary-a.json sin métrica booking_ok' })
      } else {
        checks.I7.booking_ok = bookingOk
        checks.I7.capacidad_total = totalCapacity
        checks.I7.nota = 'booking_ok es global (el resumen k6 no distingue load-popular de las demás sesiones): se compara con la capacidad total de las sesiones de carga; la sobreventa por sesión la cubre I1.'
        if (bookingOk < 1) checks.I7.violations.push({ booking_ok: bookingOk, motivo: 'booking_ok < 1: el escenario no reservó nada' })
        if (bookingOk > totalCapacity) checks.I7.violations.push({ booking_ok: bookingOk, capacidad_total: totalCapacity, motivo: 'booking_ok excede la capacidad total' })
      }
    }
  }

  // ---------------- Salida ----------------
  const rows = Object.entries(checks).map(([id, c]) => ({
    chequeo: id,
    descripcion: c.desc,
    resultado: c.skipped ? 'OMITIDO' : c.violations.length === 0 ? 'OK' : 'FALLA',
    violaciones: c.skipped ? '-' : c.violations.length,
  }))
  console.log('')
  console.table(rows)
  const failed = rows.filter((r) => r.resultado === 'FALLA')
  for (const [id, c] of Object.entries(checks)) {
    if (c.violations.length) {
      console.log(`\n${id} (${c.violations.length}) — primeras ${Math.min(5, c.violations.length)}:`)
      for (const v of c.violations.slice(0, 5)) console.log('  ', JSON.stringify(v))
    }
    if (c.nota) console.log(`\n${id}: ${c.nota}`)
  }
  const sp = perSession.find((p) => p.session === POPULAR_SESSION_ID)
  if (sp) console.log(`\nload-popular: capacity=${sp.capacity} booked_count=${sp.booked_count} ocupantes=${sp.ocupantes} esperas=${sp.esperas}`)

  const report = {
    run,
    generated_at: now.toISOString(),
    duration_ms: Date.now() - t0,
    passed: failed.length === 0,
    fixture_ok: true,
    fixture,
    totals: { sessions: sessions.length, bookings: bookings.length, waitlist_entries: waits.length, users_with_active_booking: activeUserIds.length },
    checks: Object.fromEntries(Object.entries(checks).map(([id, c]) => [id, { ...c, violation_count: c.violations.length, violations: c.violations.slice(0, 200) }])),
    sessions: perSession,
  }
  writeJson(outPath, report)
  console.log(`\nReporte: ${outPath}`)
  console.log(failed.length === 0 ? '\n✓ Integridad OK' : `\n✗ Integridad FALLA en: ${failed.map((r) => r.chequeo).join(', ')}`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(`\n✗ Error inesperado: ${String(err?.message ?? err).slice(0, 600)}`)
  process.exit(2)
})
