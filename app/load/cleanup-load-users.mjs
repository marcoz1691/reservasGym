/**
 * Limpieza de los datos sintéticos de carga (agente B2, datos). DESTRUCTIVO.
 *
 * Uso (desde app/):
 *   node --env-file=.env.load.local load/cleanup-load-users.mjs            # dry-run (por defecto)
 *   node --env-file=.env.load.local load/cleanup-load-users.mjs --yes      # borra de verdad
 *   opciones: --concurrency N (borrado de usuarios, 1-5, default 3) · --run <nombre> (dónde guardar el reporte)
 *
 * Selección ESTRICTA (sin patrones difusos ni ilike):
 *   - Usuarios Auth: email cumple LOAD_EMAIL_RE Y user_metadata.load_test === true.
 *   - Sesiones: id de la lista exacta load-popular / load-sNN / load-sNNN (LOAD_SESSION_ID_RE)
 *     Y título que empieza con LOAD_SESSION_TITLE_PREFIX. Las que cumplen el id pero no el título
 *     NO se borran (se listan con aviso).
 * Se niega a continuar si:
 *   - hay más de LOAD_USER_COUNT + 1 usuarios seleccionados, o más de MAX_LOAD_USERS socios;
 *   - los socios seleccionados no son EXACTAMENTE load.0001…load.NNNN (sin huecos ni extras), más
 *     opcionalmente el staff;
 *   - existe un usuario con user_metadata.load_test === true cuyo email NO cumple LOAD_EMAIL_RE;
 *   - la población de usuarios Auth cambia entre el listado inicial y justo antes de borrar.
 * Tras una limpieza verificada con todo en 0 borra load/.tmp/tokens.json y load/.tmp/load-meta.json.
 * Un email que cumple el patrón pero SIN la marca load_test se omite (nunca se borra) y se avisa.
 *
 * Orden: (1) payments de esos usuarios (la FK es ON DELETE SET NULL, no cascada),
 *        (2) sesiones load-* (bookings, waitlist_entries y check_ins caen en cascada; se hace antes
 *            que los usuarios porque no hay índice en bookings(user_id)),
 *        (3) usuarios Auth uno a uno (profiles, memberships, legal_consents en cascada),
 *        (4) verificación posterior por REST.
 */
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import {
  REPORTS_DIR, TOKENS_PATH, META_PATH, LOAD_EMAIL_RE, LOAD_SESSION_ID_RE, LOAD_SESSION_TITLE_PREFIX,
  MAX_LOAD_USERS, STAFF_EMAIL, emailForN, POPULAR_SESSION_ID,
  loadEnv, createClient, parseArgs, intArg, fail, writeJson, chunk, inList, mapPool,
} from './lib/env.mjs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Todos los ids posibles de sesión de carga (lista exacta, sin patrones difusos). */
function candidateSessionIds() {
  const ids = [POPULAR_SESSION_ID]
  for (let i = 0; i < 100; i++) ids.push(`load-s${String(i).padStart(2, '0')}`)
  for (let i = 0; i < 1000; i++) ids.push(`load-s${String(i).padStart(3, '0')}`)
  return ids.filter((id) => LOAD_SESSION_ID_RE.test(id))
}

/** Sesiones cuyo id cumple el patrón de carga (id + título, para poder separar las no marcadas). */
async function findLoadSessions(rest) {
  const found = []
  for (const part of chunk(candidateSessionIds(), 100)) {
    found.push(...(await rest.select('sessions', `select=id,title&id=${inList(part)}`)))
  }
  return found.filter((s) => LOAD_SESSION_ID_RE.test(s.id)).sort((a, b) => a.id.localeCompare(b.id))
}

const hasLoadTitle = (s) => typeof s.title === 'string' && s.title.startsWith(LOAD_SESSION_TITLE_PREFIX)

/** Huella de la población Auth: ids ordenados (para detectar altas/bajas entre listados). */
const popKey = (users) => users.map((u) => u.id).sort()
function diffPop(before, after) {
  const a = new Set(before)
  const b = new Set(after)
  return { added: after.filter((x) => !a.has(x)), removed: before.filter((x) => !b.has(x)) }
}

async function countIn(rest, table, column, values, size = 50) {
  let total = 0
  for (const part of chunk(values, size)) total += await rest.count(table, `${column}=${inList(part)}`)
  return total
}

const fmtMs = (ms) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)

async function main() {
  const args = parseArgs()
  const doDelete = args.yes === true
  const concurrency = intArg(args.concurrency, 3, { min: 1, max: 5, name: '--concurrency' })
  const runName = typeof args.run === 'string' && /^[A-Za-z0-9._-]+$/.test(args.run) && !args.run.startsWith('.') ? args.run : null

  const env = loadEnv({ service: true })
  const { rest, auth } = createClient(env)
  const t0 = Date.now()
  const timings = {}

  console.log(doDelete ? '=== LIMPIEZA DE CARGA (BORRADO REAL, --yes) ===' : '=== LIMPIEZA DE CARGA (DRY-RUN: no se borra nada; usa --yes para borrar) ===')
  console.log(`Proyecto: QA (${new URL(env.url).hostname})`)

  // --- Selección de usuarios -------------------------------------------------
  let ts = Date.now()
  const allUsers = await auth.listUsers()
  timings.listar_usuarios_ms = Date.now() - ts
  console.log(`Usuarios Auth totales en QA: ${allUsers.length}`)

  const targets = []
  const sinMarca = []
  const marcaSinEmail = []
  for (const u of allUsers) {
    const email = typeof u.email === 'string' ? u.email : ''
    const emailOk = LOAD_EMAIL_RE.test(email)
    const flag = u.user_metadata?.load_test === true
    if (emailOk && flag) {
      if (!UUID_RE.test(String(u.id))) fail(`Id de usuario con formato inesperado para ${email}. Abortado.`)
      targets.push({ id: u.id, email })
    } else if (emailOk && !flag) {
      sinMarca.push(email)
    } else if (flag) {
      marcaSinEmail.push(u.id)
    }
  }

  if (marcaSinEmail.length > 0) {
    fail(`Hay ${marcaSinEmail.length} usuario(s) con load_test=true cuyo email NO cumple el patrón de carga. Revisión manual necesaria; no se borra nada.`)
  }
  const maxUsers = env.userCount + 1
  if (targets.length > maxUsers) {
    fail(`Seleccionados ${targets.length} usuarios > LOAD_USER_COUNT + 1 (${maxUsers}). Aborto por seguridad; revisa LOAD_USER_COUNT o los datos.`)
  }
  // El conjunto debe ser EXACTAMENTE load.0001…load.NNNN (+ staff opcional): sin huecos ni extras.
  const memberEmails = targets.filter((t) => t.email !== STAFF_EMAIL).map((t) => t.email)
  if (memberEmails.length > MAX_LOAD_USERS) {
    fail(`Hay ${memberEmails.length} socios de carga > MAX_LOAD_USERS (${MAX_LOAD_USERS}). Aborto por seguridad.`)
  }
  const esperados = new Set(Array.from({ length: memberEmails.length }, (_, i) => emailForN(i + 1)))
  const fueraDeConjunto = memberEmails.filter((e) => !esperados.has(e))
  if (fueraDeConjunto.length > 0) {
    fail(`Los socios seleccionados no son exactamente load.0001…load.${String(memberEmails.length).padStart(4, '0')}: ${fueraDeConjunto.length} fuera del rango contiguo (p. ej. ${fueraDeConjunto.slice(0, 3).join(', ')}). Revisión manual; no se borra nada.`)
  }
  // Defensa final: todos los emails cumplen el patrón y son únicos.
  const emails = new Set(targets.map((t) => t.email))
  if (emails.size !== targets.length || targets.some((t) => !LOAD_EMAIL_RE.test(t.email))) {
    fail('Selección inconsistente (emails repetidos o fuera de patrón). Abortado.')
  }

  const userIds = targets.map((t) => t.id)

  // --- Conteos exactos antes -------------------------------------------------
  ts = Date.now()
  const allLoadSessions = await findLoadSessions(rest)
  const sessionIds = allLoadSessions.filter(hasLoadTitle).map((s) => s.id)
  const sesionesSinTitulo = allLoadSessions.filter((s) => !hasLoadTitle(s)).map((s) => s.id)
  const counts = {
    usuarios_auth: targets.length,
    sesiones: sessionIds.length,
    payments: userIds.length ? await countIn(rest, 'payments', 'user_id', userIds) : 0,
    memberships: userIds.length ? await countIn(rest, 'memberships', 'user_id', userIds) : 0,
    legal_consents: userIds.length ? await countIn(rest, 'legal_consents', 'user_id', userIds) : 0,
    bookings: sessionIds.length ? await countIn(rest, 'bookings', 'session_id', sessionIds) : 0,
    waitlist_entries: sessionIds.length ? await countIn(rest, 'waitlist_entries', 'session_id', sessionIds) : 0,
  }
  timings.conteos_ms = Date.now() - ts

  console.log('\nConteos exactos a borrar:')
  console.table(counts)
  if (targets.length) console.log(`Usuarios: ${targets[0].email} … ${targets[targets.length - 1].email}`)
  if (sinMarca.length) {
    console.log(`\n⚠ ${sinMarca.length} usuario(s) con email de carga PERO sin user_metadata.load_test=true: se OMITEN (no se borran).`)
    console.log(`  Ejemplos: ${sinMarca.slice(0, 3).join(', ')}`)
  }
  if (sesionesSinTitulo.length) {
    console.log(`\n⚠ ${sesionesSinTitulo.length} sesión(es) con id de carga PERO sin título que empiece con "${LOAD_SESSION_TITLE_PREFIX}": NO se borran.`)
    console.log(`  Ids: ${sesionesSinTitulo.slice(0, 10).join(', ')}${sesionesSinTitulo.length > 10 ? ', …' : ''}`)
  }
  console.log('\nPlan (orden):')
  console.log(`  1. Borrar ${counts.payments} payments de ${targets.length} usuarios de carga (filtro user_id, por bloques de 50)`)
  console.log(`  2. Borrar ${counts.sesiones} sesiones load-* una a una (cascada: ${counts.bookings} bookings, ${counts.waitlist_entries} esperas, check_ins)`)
  console.log(`  3. Borrar ${targets.length} usuarios Auth con concurrencia ${concurrency} (cascada: profiles, ${counts.memberships} memberships, ${counts.legal_consents} legal_consents)`)
  console.log('  4. Verificar por REST que no queda nada')

  if (!doDelete) {
    console.log('\nDRY-RUN: no se ha modificado nada. Para borrar: añade --yes')
    process.exit(0)
  }
  if (targets.length === 0 && sessionIds.length === 0) {
    console.log('\nNada que borrar.')
    process.exit(0)
  }

  // Segundo listado inmediato: la población Auth no debe haber cambiado desde el primero.
  const before = popKey(allUsers)
  const second = popKey(await auth.listUsers())
  const d1 = diffPop(before, second)
  if (d1.added.length || d1.removed.length) {
    fail(`La población de usuarios Auth cambió antes de borrar (+${d1.added.length} / -${d1.removed.length}). Alguien está creando o borrando usuarios en QA; no se borra nada. Reintenta.`)
  }

  // --- (1) payments ----------------------------------------------------------
  ts = Date.now()
  for (const part of chunk(userIds, 50)) {
    await rest.remove('payments', `user_id=${inList(part)}`)
  }
  timings.payments_ms = Date.now() - ts
  console.log(`\n[1/4] payments borrados (${fmtMs(timings.payments_ms)})`)

  // --- (2) sesiones (cascada bookings/espera/check_ins) ------------------------
  ts = Date.now()
  let sesionesBorradas = 0
  for (const id of sessionIds) {
    if (!LOAD_SESSION_ID_RE.test(id)) fail(`Id de sesión fuera de patrón: ${id}. Abortado.`)
    await rest.remove('sessions', `id=eq.${id}`)
    sesionesBorradas++
    if (sesionesBorradas % 10 === 0) console.log(`   sesiones: ${sesionesBorradas}/${sessionIds.length}`)
  }
  timings.sesiones_ms = Date.now() - ts
  console.log(`[2/4] ${sesionesBorradas} sesiones borradas (${fmtMs(timings.sesiones_ms)})`)

  // --- (3) usuarios Auth ------------------------------------------------------
  ts = Date.now()
  let done = 0
  const errores = []
  await mapPool(targets, concurrency, async (t) => {
    // Revalidación por usuario justo antes de borrar.
    if (!LOAD_EMAIL_RE.test(t.email) || !UUID_RE.test(t.id)) {
      errores.push({ email: t.email, error: 'fuera de patrón (no se borra)' })
      return
    }
    try {
      await auth.deleteUser(t.id)
    } catch (err) {
      errores.push({ email: t.email, error: String(err.message).slice(0, 200) })
    }
    done++
    if (done % 100 === 0 || done === targets.length) {
      const el = (Date.now() - ts) / 1000
      console.log(`   usuarios: ${done}/${targets.length} (${(done / Math.max(el, 0.001)).toFixed(1)}/s)`)
    }
  })
  timings.usuarios_ms = Date.now() - ts
  console.log(`[3/4] usuarios Auth procesados: ${done - errores.length} borrados, ${errores.length} con error (${fmtMs(timings.usuarios_ms)})`)
  if (errores.length) for (const e of errores.slice(0, 5)) console.log('   ✗', e.email, e.error)

  // --- (4) verificación -------------------------------------------------------
  ts = Date.now()
  const finalUsers = await auth.listUsers()
  const restantesUsers = finalUsers.filter(
    (u) => LOAD_EMAIL_RE.test(u.email ?? '') && u.user_metadata?.load_test === true,
  )
  // Población esperada = listado inicial menos los usuarios borrados; cualquier otra diferencia es ajena a la limpieza.
  const objetivo = new Set(userIds)
  const esperada = before.filter((id) => !objetivo.has(id))
  const d2 = diffPop(esperada, popKey(finalUsers))
  const poblacionCambio = d2.added.length + d2.removed.length
  if (poblacionCambio) {
    console.log(`\n⚠ La población de usuarios Auth cambió durante la limpieza (+${d2.added.length} / -${d2.removed.length} respecto a lo esperado). Revisa que nadie más operaba en QA.`)
  }
  const quedan = {
    usuarios_auth: restantesUsers.length,
    sesiones: (await findLoadSessions(rest)).filter(hasLoadTitle).length,
    profiles: userIds.length ? await countIn(rest, 'profiles', 'id', userIds) : 0,
    payments: userIds.length ? await countIn(rest, 'payments', 'user_id', userIds) : 0,
    memberships: userIds.length ? await countIn(rest, 'memberships', 'user_id', userIds) : 0,
    legal_consents: userIds.length ? await countIn(rest, 'legal_consents', 'user_id', userIds) : 0,
    bookings: sessionIds.length ? await countIn(rest, 'bookings', 'session_id', sessionIds) : 0,
    waitlist_entries: sessionIds.length ? await countIn(rest, 'waitlist_entries', 'session_id', sessionIds) : 0,
  }
  // Perfiles huérfanos con email de carga (solo lectura; el filtro like se usa únicamente para detectar restos).
  const perfiles = await rest.select('profiles', 'select=id,email&email=like.load.*%40zonacero.test&limit=2000')
  const perfilesCarga = perfiles.filter((p) => LOAD_EMAIL_RE.test(p.email ?? ''))
  quedan.profiles_con_email_de_carga = perfilesCarga.length
  timings.verificacion_ms = Date.now() - ts

  console.log('\n[4/4] Restos tras la limpieza (todo debe ser 0):')
  console.table(quedan)
  const sucio = Object.values(quedan).some((n) => n > 0) || errores.length > 0 || poblacionCambio > 0
  timings.total_ms = Date.now() - t0
  console.log(`Tiempos: payments ${fmtMs(timings.payments_ms)} · sesiones ${fmtMs(timings.sesiones_ms)} · usuarios ${fmtMs(timings.usuarios_ms)} · verificación ${fmtMs(timings.verificacion_ms)} · total ${fmtMs(timings.total_ms)}`)

  const report = {
    finished_at: new Date().toISOString(),
    clean: !sucio,
    borrado_planeado: counts,
    restos: quedan,
    errores,
    omitidos_sin_marca_load_test: sinMarca.length,
    sesiones_omitidas_sin_titulo: sesionesSinTitulo,
    poblacion_auth_cambio: poblacionCambio,
    timings_ms: timings,
  }
  const out = runName
    ? join(REPORTS_DIR, runName, 'cleanup.json')
    : join(REPORTS_DIR, `cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeJson(out, report)
  console.log(`Reporte: ${out}`)
  if (!sucio) {
    // Con todo en 0, los tokens y el meta quedan obsoletos: se borran.
    for (const f of [TOKENS_PATH, META_PATH]) rmSync(f, { force: true })
    console.log('\n✓ Limpieza completa y verificada. Se borraron load/.tmp/tokens.json y load/.tmp/load-meta.json.')
  }
  else console.log('\n✗ Quedan restos o hubo errores. Vuelve a ejecutar con --yes (es idempotente).')
  process.exit(sucio ? 1 : 0)
}

main().catch((err) => {
  console.error(`\n✗ Error inesperado: ${String(err?.message ?? err).slice(0, 600)}`)
  process.exit(2)
})
