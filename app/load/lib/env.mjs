/**
 * Utilidades compartidas del harness de carga (agente B, datos).
 *
 * - Carga y valida las variables de entorno del contrato (.env.load.local).
 * - Guard QA/prod: aborta si la URL no es la de QA. Prod solo con LOAD_TARGET=prod + LOAD_PROD_CONFIRM
 *   y sin usuarios reales fuera de la lista blanca aprobada (assertNoRealUsers).
 * - Cliente mínimo con fetch para PostgREST (service role) y Auth Admin API, con
 *   reintentos con backoff en 429/5xx/errores de red y un limitador de concurrencia.
 *
 * Nunca se imprimen ni se escriben claves. Los mensajes de error se redactan.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const QA_REF = 'kqhmclbexnnsbzbgerbx'
export const PROD_REF = 'gvgqlmoulgcickxognto'
/** Único origen permitido: https, sin credenciales, puerto, ruta, query ni fragmento. */
export const QA_ORIGIN = `https://${QA_REF}.supabase.co`
export const PROD_ORIGIN = `https://${PROD_REF}.supabase.co`
/**
 * Destino: QA por defecto. Prod solo para la prueba previa al lanzamiento, con LOAD_TARGET=prod y
 * LOAD_PROD_CONFIRM=<este valor> en la línea de comandos, y solo mientras prod no tenga usuarios reales.
 */
export const PROD_CONFIRM = `${PROD_REF}-sin-usuarios-reales`
export const TARGET = process.env.LOAD_TARGET === 'prod' ? 'prod' : 'qa'
/** Prefijo obligatorio en el título de toda sesión creada por el seed (marca de propiedad). */
export const LOAD_SESSION_TITLE_PREFIX = 'LOAD TEST · '
/** Tope de socios de carga (seed, mint, check y cleanup). */
export const MAX_LOAD_USERS = 5000

const here = dirname(fileURLToPath(import.meta.url))
export const LOAD_DIR = join(here, '..')
// Prod usa su propia carpeta: meta y tokens de QA y prod nunca se mezclan.
export const TMP_DIR = join(LOAD_DIR, TARGET === 'prod' ? '.tmp-prod' : '.tmp')
export const REPORTS_DIR = join(LOAD_DIR, 'reports')
export const META_PATH = join(TMP_DIR, 'load-meta.json')
export const TOKENS_PATH = join(TMP_DIR, 'tokens.json')

/** Correo de socio de carga: load.0001@zonacero.test */
export const LOAD_EMAIL_RE = /^load\.(\d{4}|staff)@zonacero\.test$/
export const STAFF_EMAIL = 'load.staff@zonacero.test'
export const emailForN = (n) => `load.${String(n).padStart(4, '0')}@zonacero.test`
/** Ids de sesión de carga permitidos: load-s01..load-s99(9) y load-popular. */
export const LOAD_SESSION_ID_RE = /^load-(s\d{2,3}|popular)$/
export const POPULAR_SESSION_ID = 'load-popular'

// --------------------------------------------------------------------------
// Utilidades generales
// --------------------------------------------------------------------------

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      out._.push(a)
      continue
    }
    const eq = a.indexOf('=')
    if (eq > -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1)
    } else {
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        out[a.slice(2)] = next
        i++
      } else {
        out[a.slice(2)] = true
      }
    }
  }
  return out
}

export function intArg(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER, name = 'valor' } = {}) {
  if (value === undefined || value === true || value === '') return fallback
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) {
    fail(`${name} inválido: "${value}" (entero entre ${min} y ${max})`)
  }
  return n
}

export function fail(msg) {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

export function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

/** Escritura atómica (tmp + rename) para que un corte no deje un JSON a medias. */
export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
  renameSync(tmp, path)
}

/** Reparto determinista por número de usuario: 70 % active, 15 % grace, 15 % expired. */
export function stateForN(n, total) {
  const active = Math.round(total * 0.7)
  const grace = Math.round(total * 0.15)
  if (n <= active) return 'active'
  if (n <= active + grace) return 'grace'
  return 'expired'
}

// --------------------------------------------------------------------------
// Entorno + guard QA/prod
// --------------------------------------------------------------------------

function jwtRef(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.ref === 'string' ? payload.ref : null
  } catch {
    return null
  }
}

/**
 * Carga y valida el entorno. Aborta (process.exit) si algo no cumple.
 * opts: { service, anon, password } indican qué variables son obligatorias.
 */
export function loadEnv({ service = false, anon = false, password = false } = {}) {
  const e = process.env
  const url = (e.SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
  if (!url) {
    fail('Falta SUPABASE_URL. Corre con: node --env-file=.env.load.local load/<script>.mjs (desde app/)')
  }

  const prod = TARGET === 'prod'
  const expectedRef = prod ? PROD_REF : QA_REF
  const expectedOrigin = prod ? PROD_ORIGIN : QA_ORIGIN
  if (prod) {
    if ((e.LOAD_PROD_CONFIRM ?? '') !== PROD_CONFIRM) {
      fail(`LOAD_TARGET=prod exige LOAD_PROD_CONFIRM=${PROD_CONFIRM} (prueba previa al lanzamiento, prod sin usuarios reales). Abortado.`)
    }
    // En prod todo script necesita la service key para revisar que no haya usuarios reales.
    service = true
  }

  // Guard QA/prod. Origen canónico exacto (https, sin credenciales/puerto/ruta/query/fragmento).
  if (!prod && url.includes(PROD_REF)) {
    fail('SUPABASE_URL apunta a PRODUCCIÓN. El harness de carga solo corre contra QA (salvo LOAD_TARGET=prod). Abortado.')
  }
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    fail('SUPABASE_URL no es una URL válida.')
  }
  const canonical =
    parsed.protocol === 'https:' &&
    !parsed.username &&
    !parsed.password &&
    !parsed.port &&
    parsed.pathname === '/' &&
    !parsed.search &&
    !parsed.hash &&
    url === expectedOrigin
  if (!canonical) {
    fail(`SUPABASE_URL debe ser exactamente ${expectedOrigin} (https, sin credenciales, puerto, ruta, query ni fragmento). Abortado.`)
  }

  const serviceKey = (e.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  const anonKey = (e.SUPABASE_ANON_KEY ?? '').trim()
  const loadPassword = e.LOAD_PASSWORD ?? ''
  if (service && !serviceKey) fail('Falta SUPABASE_SERVICE_ROLE_KEY.')
  if (anon && !anonKey) fail('Falta SUPABASE_ANON_KEY.')
  if (password && loadPassword.length < 8) fail('Falta LOAD_PASSWORD (mínimo 8 caracteres).')

  // Segunda defensa: si las claves son JWT con claim `ref`, debe ser el del destino.
  for (const [name, key] of [['SUPABASE_SERVICE_ROLE_KEY', serviceKey], ['SUPABASE_ANON_KEY', anonKey]]) {
    if (!key) continue
    if (!prod && key.includes(PROD_REF)) fail(`${name} parece de PRODUCCIÓN. Abortado.`)
    const ref = jwtRef(key)
    if (ref && ref !== expectedRef) fail(`${name} no pertenece al proyecto ${prod ? 'PROD' : 'QA'} (ref distinto). Abortado.`)
  }

  const num = (v, d, name, max = Number.MAX_SAFE_INTEGER) => {
    if (v === undefined || v === '') return d
    const n = Number(v)
    if (!Number.isInteger(n) || n < 1 || n > max) fail(`${name} debe ser un entero entre 1 y ${max}.`)
    return n
  }

  const env = {
    url,
    target: TARGET,
    label: prod ? 'PROD' : 'QA',
    ref: expectedRef,
    origin: expectedOrigin,
    serviceKey,
    anonKey,
    password: loadPassword,
    userCount: num(e.LOAD_USER_COUNT, 1000, 'LOAD_USER_COUNT', MAX_LOAD_USERS),
    sessionCount: num(e.LOAD_SESSION_COUNT, 40, 'LOAD_SESSION_COUNT'),
    popularCapacity: num(e.LOAD_POPULAR_CAPACITY, 30, 'LOAD_POPULAR_CAPACITY'),
  }
  // Las claves no se enumeran al imprimir el objeto (por si alguien hace console.log(env)).
  for (const k of ['serviceKey', 'anonKey', 'password']) {
    Object.defineProperty(env, k, { enumerable: false })
  }
  return env
}

// --------------------------------------------------------------------------
// HTTP con reintentos y limitador de concurrencia
// --------------------------------------------------------------------------

export function redact(text, env) {
  let s = String(text)
  for (const secret of [env?.serviceKey, env?.anonKey, env?.password]) {
    if (secret) s = s.split(secret).join('***')
  }
  return s.length > 600 ? s.slice(0, 600) + '…' : s
}

/** Limitador de concurrencia: const run = createLimiter(5); await run(() => fn()). */
export function createLimiter(max) {
  let active = 0
  const queue = []
  const next = () => {
    if (active >= max || queue.length === 0) return
    active++
    const { fn, resolve, reject } = queue.shift()
    fn().then(resolve, reject).finally(() => {
      active--
      next()
    })
  }
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject })
      next()
    })
}

/** Ejecuta fn(item, idx) sobre items con concurrencia acotada; conserva el orden de resultados. */
export async function mapPool(items, concurrency, fn) {
  const run = createLimiter(concurrency)
  return Promise.all(items.map((item, i) => run(() => fn(item, i))))
}

/**
 * fetch con reintentos con backoff exponencial + jitter en 429, 5xx y errores de red.
 * Respeta Retry-After. Devuelve { status, ok, body, headers, attempts }.
 * No lanza por 4xx (el llamador decide); sí lanza al agotar reintentos en 429/5xx/red.
 */
export async function request(url, init = {}, { retries = 6, baseDelayMs = 500, maxDelayMs = 20000, env, throwOnRetryExhausted = true } = {}) {
  let lastErr
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60000) })
      const text = await res.text()
      let body = null
      if (text) {
        try {
          body = JSON.parse(text)
        } catch {
          body = text
        }
      }
      const retryable = res.status === 429 || res.status >= 500
      if (!retryable || attempt > retries) {
        if (retryable && throwOnRetryExhausted) {
          throw new Error(`HTTP ${res.status} tras ${attempt} intentos: ${redact(typeof body === 'string' ? body : JSON.stringify(body), env)}`)
        }
        return { status: res.status, ok: res.ok, body, headers: res.headers, attempts: attempt }
      }
      const ra = Number(res.headers.get('retry-after'))
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))
      await sleep(wait + Math.random() * 250)
    } catch (err) {
      lastErr = err
      if (String(err.message).startsWith('HTTP ')) throw err
      if (attempt > retries) break
      await sleep(Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)) + Math.random() * 250)
    }
  }
  throw new Error(`Error de red tras reintentos: ${redact(lastErr?.message ?? lastErr, env)}`)
}

// --------------------------------------------------------------------------
// Cliente PostgREST + Auth Admin (service role)
// --------------------------------------------------------------------------

export function createClient(env) {
  const base = env.url
  const svcHeaders = (extra = {}) => ({
    apikey: env.serviceKey,
    Authorization: `Bearer ${env.serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  })

  async function call(path, init, opts) {
    const res = await request(`${base}${path}`, init, { env, ...opts })
    return res
  }

  function must(res, what) {
    if (!res.ok) {
      const detail = typeof res.body === 'string' ? res.body : JSON.stringify(res.body)
      throw new Error(`${what} falló (HTTP ${res.status}): ${redact(detail, env)}`)
    }
    return res.body
  }

  const rest = {
    /** GET con query ya codificada, p. ej. "select=id,status&user_id=eq.<uuid>". Una sola página. */
    async select(table, query = '') {
      const res = await call(`/rest/v1/${table}?${query}`, { headers: svcHeaders() })
      return must(res, `GET ${table}`)
    },
    /** GET paginado con Range (páginas de 1000). */
    async selectAll(table, query = '', pageSize = 1000) {
      const out = []
      for (let from = 0; ; from += pageSize) {
        const res = await call(`/rest/v1/${table}?${query}`, {
          headers: svcHeaders({ Range: `${from}-${from + pageSize - 1}`, 'Range-Unit': 'items' }),
        })
        const rows = must(res, `GET ${table}`)
        out.push(...rows)
        if (rows.length < pageSize) break
      }
      return out
    },
    /** Conteo exacto sin traer filas (Prefer: count=exact + HEAD-like con limit 0). */
    async count(table, query = '') {
      const res = await call(`/rest/v1/${table}?${query}&select=id`, {
        headers: svcHeaders({ Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' }),
      })
      must(res, `COUNT ${table}`)
      const cr = res.headers.get('content-range') ?? ''
      const raw = cr.split('/')[1]
      const total = Number(raw)
      if (!/^\d+$/.test(raw ?? '') || !Number.isSafeInteger(total)) {
        throw new Error(`COUNT ${table}: Content-Range ausente o sin total válido ("${cr}")`)
      }
      return total
    },
    async insert(table, rows, { onConflict, ignoreDuplicates = false, merge = false, returning = false } = {}) {
      const prefer = []
      if (merge) prefer.push('resolution=merge-duplicates')
      if (ignoreDuplicates) prefer.push('resolution=ignore-duplicates')
      prefer.push(returning ? 'return=representation' : 'return=minimal')
      const q = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : ''
      const res = await call(`/rest/v1/${table}${q}`, {
        method: 'POST',
        headers: svcHeaders({ Prefer: prefer.join(',') }),
        body: JSON.stringify(rows),
      })
      return must(res, `INSERT ${table}`)
    },
    async update(table, query, patch) {
      if (!query) throw new Error('update sin filtro: rechazado')
      const res = await call(`/rest/v1/${table}?${query}`, {
        method: 'PATCH',
        headers: svcHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify(patch),
      })
      return must(res, `PATCH ${table}`)
    },
    async remove(table, query) {
      if (!query) throw new Error('delete sin filtro: rechazado')
      const res = await call(`/rest/v1/${table}?${query}`, {
        method: 'DELETE',
        headers: svcHeaders({ Prefer: 'return=minimal' }),
      })
      return must(res, `DELETE ${table}`)
    },
  }

  const auth = {
    /** Lista TODOS los usuarios Auth con paginación (per_page=1000). */
    async listUsers() {
      const perPage = 1000
      const out = []
      for (let page = 1; ; page++) {
        const res = await call(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`, { headers: svcHeaders() })
        const body = must(res, 'GET auth/admin/users')
        const users = Array.isArray(body) ? body : (body?.users ?? [])
        out.push(...users)
        if (users.length < perPage) break
      }
      return out
    },
    async createUser({ email, password, userMetadata }) {
      const res = await call('/auth/v1/admin/users', {
        method: 'POST',
        headers: svcHeaders(),
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: userMetadata }),
      })
      return must(res, `POST auth/admin/users (${email})`)
    },
    async setPassword(id, password) {
      const res = await call(`/auth/v1/admin/users/${id}`, {
        method: 'PUT',
        headers: svcHeaders(),
        body: JSON.stringify({ password }),
      })
      return must(res, 'PUT auth/admin/users')
    },
    /** Restablece contraseña y metadatos (y confirma el correo) de un usuario existente. */
    async updateUser(id, { password, userMetadata }) {
      const res = await call(`/auth/v1/admin/users/${id}`, {
        method: 'PUT',
        headers: svcHeaders(),
        body: JSON.stringify({ password, user_metadata: userMetadata, email_confirm: true }),
      })
      return must(res, 'PUT auth/admin/users')
    },
    async deleteUser(id) {
      const res = await call(`/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: svcHeaders() })
      // 404 = ya no existe: aceptable (idempotente).
      if (res.status === 404) return null
      return must(res, 'DELETE auth/admin/users')
    },
  }

  /**
   * signInWithPassword con la anon key. NO reintenta aquí (mint-tokens gestiona el 429
   * para poder medir el rate observado). Devuelve { status, body, retryAfter }.
   */
  async function signInWithPassword(email, password) {
    const res = await request(
      `${base}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      },
      { retries: 0, env, throwOnRetryExhausted: false },
    )
    const ra = Number(res.headers.get('retry-after'))
    return { status: res.status, body: res.body, retryAfter: Number.isFinite(ra) && ra > 0 ? ra : null }
  }

  return { rest, auth, signInWithPassword }
}

// --- Lista blanca de usuarios reales (solo prod) ------------------------------
// Prod ya tiene testers reales (prueba cerrada de Google Play): no se pueden borrar. El freno
// acepta SOLO a los usuarios de una lista generada con load/allowlist-real-users.mjs y aprobada
// por el operador con LOAD_ALLOWLIST_SHA256=<hash>. Cualquier diferencia (un usuario de más, uno
// de menos o un email cambiado), una lista vieja o un hash no aprobado aborta.
export const ALLOWLIST_PATH = join(LOAD_DIR, '.tmp-prod', 'allowed-real-users.json')
export const ALLOWLIST_MAX_AGE_MS = 24 * 3600 * 1000

/** Usuarios Auth que no son de carga, normalizados ({ id, email }) y ordenados por id. */
export function realUsersOf(users) {
  return users
    .filter((u) => !LOAD_EMAIL_RE.test(u.email ?? ''))
    .map((u) => ({ id: String(u.id), email: String(u.email ?? '').toLowerCase() }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Hash sha256 de la lista (ref de prod + usuarios ordenados). Se recalcula siempre: nunca se confía en uno guardado. */
export function allowlistHash(users) {
  const canon = realUsersOf(users.map((u) => ({ id: u.id, email: u.email ?? '' })))
  return createHash('sha256').update(JSON.stringify({ ref: PROD_REF, users: canon })).digest('hex')
}

/**
 * Compara los usuarios reales actuales con la lista blanca. Pura (sin red), para poder probarla.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkAllowlist({ real, allowlist, approvedHash, now = Date.now() }) {
  if (!real.length) return { ok: true }
  const no = (reason) => ({ ok: false, reason })
  if (!allowlist || !Array.isArray(allowlist.users)) {
    return no(`hay ${real.length} usuario(s) reales y no existe la lista blanca. Genérala con load/allowlist-real-users.mjs y apruébala.`)
  }
  if (allowlist.project_ref !== PROD_REF) return no('la lista blanca no es de este proyecto de producción.')
  const generated = Date.parse(allowlist.generated_at ?? '')
  if (!Number.isFinite(generated) || generated > now + 60_000) return no('la fecha de la lista blanca no es válida.')
  if (now - generated > ALLOWLIST_MAX_AGE_MS) return no('la lista blanca tiene más de 24 h. Genérala y apruébala de nuevo.')
  const hash = allowlistHash(allowlist.users)
  if (!approvedHash) return no('falta LOAD_ALLOWLIST_SHA256: revisa la lista y aprueba su hash.')
  if (String(approvedHash).trim().toLowerCase() !== hash) return no('LOAD_ALLOWLIST_SHA256 no coincide con la lista blanca: la lista cambió o no está aprobada.')

  const allowed = new Map(realUsersOf(allowlist.users).map((u) => [u.id, u.email]))
  const current = new Map(real.map((u) => [u.id, u.email]))
  const extra = real.filter((u) => !allowed.has(u.id)).map((u) => u.id)
  const missing = [...allowed.keys()].filter((id) => !current.has(id))
  const changed = real.filter((u) => allowed.has(u.id) && allowed.get(u.id) !== u.email).map((u) => u.id)
  if (extra.length || missing.length || changed.length) {
    const parts = []
    if (extra.length) parts.push(`${extra.length} usuario(s) real(es) nuevo(s) fuera de la lista (${extra.join(', ')})`)
    if (missing.length) parts.push(`${missing.length} usuario(s) de la lista ya no existe(n) (${missing.join(', ')})`)
    if (changed.length) parts.push(`${changed.length} usuario(s) con email distinto al aprobado (${changed.join(', ')})`)
    return no(`los usuarios reales no coinciden con la lista blanca: ${parts.join('; ')}. Genérala y apruébala de nuevo.`)
  }
  return { ok: true }
}

/**
 * Freno de prod: aborta si hay algún usuario Auth que no sea de carga y no esté exactamente en la
 * lista blanca aprobada. Los usuarios aprobados nunca se tocan. En QA no hace nada.
 */
export async function assertNoRealUsers(auth, env) {
  if (env.target !== 'prod') return
  const real = realUsersOf(await auth.listUsers())
  const res = checkAllowlist({
    real,
    allowlist: readJson(ALLOWLIST_PATH, null),
    approvedHash: process.env.LOAD_ALLOWLIST_SHA256,
  })
  if (!res.ok) fail(`Freno de PRODUCCIÓN: ${res.reason} Abortado.`)
  if (real.length) console.log(`Freno de prod: ${real.length} usuario(s) real(es) aprobados en la lista blanca; no se tocan.`)
}

/** Filtro PostgREST `in.(a,b,c)` con valores validados (solo ids/uuids/emails seguros). */
export function inList(values) {
  for (const v of values) {
    if (!/^[A-Za-z0-9._@\-]+$/.test(v)) throw new Error(`valor no permitido en filtro in(): ${v}`)
  }
  return `in.(${values.join(',')})`
}
