#!/usr/bin/env node
/**
 * Genera el pool de tokens de los socios de carga (login con contraseña, anon key).
 *
 *   node --env-file=.env.load.local load/mint-tokens.mjs [--limit N] [--states active,grace,expired]
 *        [--concurrency 2] [--retries 8] [--min-ttl-min 10]
 *
 * - Reanudable: conserva de .tmp/tokens.json los tokens que aún tienen vigencia suficiente.
 * - Auth del plan Free limita los sign-ins por IP: concurrencia baja, backoff ante 429 con pausa
 *   compartida entre workers, y rate observado. Si el 429 persiste tras --retries reintentos en un
 *   usuario, guarda lo logrado y termina con aviso (no falla todo).
 * - Formato (contrato): [{ n, email, user_id, state, access_token, expires_at }]
 *   `expires_at` = segundos epoch (unix) en que vence el JWT, igual que lo devuelve Supabase Auth.
 * - Nunca imprime tokens ni claves.
 */
import {
  loadEnv,
  createClient,
  parseArgs,
  intArg,
  fail,
  sleep,
  readJson,
  writeJson,
  stateForN,
  emailForN,
  META_PATH,
  TOKENS_PATH,
  assertNoRealUsers,
} from './lib/env.mjs'

const args = parseArgs()
const env = loadEnv({ anon: true, password: true })
const { auth, signInWithPassword } = createClient(env)
await assertNoRealUsers(auth, env)

const concurrency = intArg(args.concurrency, 2, { min: 1, max: 10, name: '--concurrency' })
const maxRetries = intArg(args.retries, 8, { min: 1, max: 50, name: '--retries' })
const minTtlMin = intArg(args['min-ttl-min'], 10, { min: 0, max: 55, name: '--min-ttl-min' })
const limit = args.limit === undefined ? null : intArg(args.limit, null, { min: 1, name: '--limit' })

const ALL_STATES = ['active', 'grace', 'expired']
const states = (args.states === undefined || args.states === true ? ALL_STATES.join(',') : String(args.states))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
for (const s of states) if (!ALL_STATES.includes(s)) fail(`--states inválido: "${s}" (usa active,grace,expired)`)

const nowSec = () => Math.floor(Date.now() / 1000)

/**
 * Valida un JWT de usuario sin imprimirlo: proyecto QA (claim `ref` o `iss`), `sub` esperado,
 * `email` esperado y `exp` posterior a `minExp`. Devuelve el `exp` o null si no cuadra.
 */
function validateJwt(token, { userId, email, minExp }) {
  try {
    const parts = String(token).split('.')
    if (parts.length !== 3) return null
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (p.ref !== undefined && p.ref !== env.ref) return null
    if (p.iss !== undefined && p.iss !== `${env.origin}/auth/v1`) return null
    if (p.ref === undefined && p.iss === undefined) return null // sin forma de verificar el proyecto
    if (userId && p.sub !== userId) return null
    if (!userId && !p.sub) return null
    if (String(p.email ?? '').toLowerCase() !== email) return null
    if (!Number.isFinite(p.exp) || p.exp <= minExp) return null
    return p.exp
  } catch {
    return null
  }
}

async function main() {
  const meta = readJson(META_PATH, null)
  if (!meta) console.log('⚠ No existe .tmp/load-meta.json (¿corriste load:seed?). Uso LOAD_USER_COUNT para el reparto de estados.')
  const total = meta?.user_count ?? env.userCount

  // Candidatos: todos los socios cuyo estado esté en --states, en orden de n.
  let candidates = []
  for (let n = 1; n <= total; n++) {
    const state = stateForN(n, total)
    if (states.includes(state)) candidates.push({ n, state })
  }
  // --limit: muestreo uniforme (conserva la proporción de estados y es estable entre corridas).
  if (limit !== null && limit < candidates.length) {
    const pick = []
    for (let i = 0; i < limit; i++) pick.push(candidates[Math.floor((i * candidates.length) / limit)])
    candidates = pick
  }

  // Tokens ya guardados: los vigentes (con margen) se conservan.
  const stored = readJson(TOKENS_PATH, [])
  const keepFrom = nowSec() + minTtlMin * 60
  const byN = new Map()
  for (const t of Array.isArray(stored) ? stored : []) {
    if (!t || !t.access_token || !t.user_id || !(t.n >= 1 && t.n <= total)) continue
    const email = emailForN(t.n)
    if (t.email !== email || t.state !== stateForN(t.n, total)) continue
    const exp = validateJwt(t.access_token, { userId: t.user_id, email, minExp: keepFrom })
    if (exp) byN.set(t.n, { ...t, expires_at: exp })
  }
  const pending = candidates.filter((c) => !byN.has(c.n))
  const reused = candidates.length - pending.length
  console.log(`Tokens: ${candidates.length} pedidos (estados: ${states.join(',')}), ${reused} vigentes reutilizados, ${pending.length} por generar.`)

  const save = () => writeJson(TOKENS_PATH, [...byN.values()].sort((a, b) => a.n - b.n))

  if (!pending.length) {
    save()
    console.log('✓ Nada que generar.')
    return
  }

  // Estado compartido entre workers.
  let pauseUntil = 0
  let aborted = false
  let abortReason = ''
  let idx = 0
  let okCount = 0
  let rl429 = 0
  let failures = 0
  let consecutiveFails = 0
  const failCodes = {}
  const t0 = Date.now()
  let lastLog = t0

  async function mintOne(item) {
    const email = emailForN(item.n)
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (aborted) return
      const wait = pauseUntil - Date.now()
      if (wait > 0) await sleep(wait)

      let res
      try {
        res = await signInWithPassword(email, env.password)
      } catch {
        res = { status: 0, body: null, retryAfter: null } // error de red: se reintenta
      }
      if (res.status === 200 && res.body?.access_token) {
        const b = res.body
        const uid = b.user?.id ?? null
        const exp = validateJwt(b.access_token, { userId: uid, email, minExp: nowSec() })
        if (!uid || !exp) {
          // Token que no cuadra (otro proyecto, otro usuario…): no se guarda.
          failures++
          consecutiveFails++
          failCodes.token_invalido = (failCodes.token_invalido ?? 0) + 1
          if (consecutiveFails >= 20) {
            aborted = true
            abortReason = '20 tokens inválidos seguidos (el JWT no corresponde a QA/usuario esperado).'
          }
          return
        }
        byN.set(item.n, { n: item.n, email, user_id: uid, state: item.state, access_token: b.access_token, expires_at: exp })
        okCount++
        consecutiveFails = 0
        return
      }
      if (res.status === 429) {
        rl429++
        // Pausa global (el límite es por IP): Retry-After o backoff exponencial 3s…60s con jitter.
        const backoff = res.retryAfter ? res.retryAfter * 1000 : Math.min(60_000, 3000 * 2 ** attempt)
        pauseUntil = Math.max(pauseUntil, Date.now() + backoff + Math.random() * 1000)
        continue
      }
      if (res.status >= 500 || res.status === 0) {
        await sleep(Math.min(10_000, 1000 * 2 ** attempt))
        continue
      }
      // 4xx de negocio (credenciales inválidas, usuario inexistente…): no se reintenta.
      failures++
      consecutiveFails++
      const code = res.body?.error_code ?? res.body?.error ?? `http_${res.status}`
      failCodes[code] = (failCodes[code] ?? 0) + 1
      if (consecutiveFails >= 20) {
        aborted = true
        abortReason = `20 fallos seguidos (${Object.entries(failCodes).map(([k, v]) => `${k}:${v}`).join(', ')}). ¿Corriste load:seed y LOAD_PASSWORD coincide con la del seed?`
      }
      return
    }
    // Reintentos agotados (429/5xx persistente).
    if (!aborted) {
      aborted = true
      abortReason = `429/5xx persistente tras ${maxRetries} reintentos en ${email} (límite de Auth del plan Free por IP).`
    }
  }

  function report(force = false) {
    const now = Date.now()
    if (!force && now - lastLog < 10_000) return
    lastLog = now
    const secs = (now - t0) / 1000
    const rate = secs > 0 ? (okCount / secs).toFixed(2) : '0'
    console.log(`  ${okCount}/${pending.length} ok, ${failures} fallos, ${rl429} respuestas 429 — ${rate} logins/s (${secs.toFixed(0)}s)`)
  }

  let sinceSave = 0
  async function worker() {
    while (!aborted) {
      const item = pending[idx++]
      if (!item) return
      const before = okCount
      await mintOne(item)
      if (okCount > before && ++sinceSave >= 25) {
        sinceSave = 0
        save()
      }
      report()
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  save()
  report(true)

  const secs = (Date.now() - t0) / 1000
  const rate = secs > 0 ? okCount / secs : 0
  console.log(`\nRate observado: ${rate.toFixed(2)} logins/s con concurrencia ${concurrency} (${rl429} respuestas 429).`)
  // Éxito solo si el pool contiene TODOS los candidatos pedidos.
  const absent = candidates.filter((c) => !byN.has(c.n)).length
  if (aborted) {
    console.log(`⚠ Terminado de forma parcial: ${abortReason}`)
    console.log('  Espera unos minutos y re-corre load:mint para completar (es reanudable).')
  }
  if (absent > 0) {
    console.log(`✗ Pool INCOMPLETO: faltan ${absent} de ${candidates.length} tokens pedidos (${Object.entries(failCodes).map(([k, v]) => `${k}:${v}`).join(', ') || 'sin detalle'}). Guardados ${byN.size} en .tmp/tokens.json.`)
    process.exitCode = 1
    return
  }
  console.log(`✓ Pool completo: ${okCount} tokens nuevos, ${candidates.length} pedidos cubiertos. Total en archivo: ${byN.size}.`)
}

main().catch((err) => fail(err.message))
