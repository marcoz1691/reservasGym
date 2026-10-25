// Helpers REST / RPC de Supabase para los escenarios k6 (solo contra QA).
//
// Reglas de clasificación (ver load/slo.md §2):
//   - `errors` (Rate) cuenta SOLO 5xx, timeouts y errores de red (status 0).
//   - 429 -> `rate_limited` (techo de Auth/PostgREST en Free), no es error.
//   - 401 -> `auth_expired` (JWT caducado), no es error; invalida la corrida.
//   - book_session: 200 con `booking` = ok; 200 con `waitlist` = sesión llena (no es fallo);
//     400 P0001 con mensaje de negocio = denegación de negocio (no es error). Un 400 con un
//     mensaje fuera de esa lista SÍ cuenta como error (booking_other_denied).
//
// Nunca se imprimen claves. El anon key solo viaja en las cabeceras `apikey`/`Authorization`.

import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------- configuración

export const SUPABASE_URL = (__ENV.SUPABASE_URL || '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const QA_REF = 'kqhmclbexnnsbzbgerbx';
const PROD_REF = 'gvgqlmoulgcickxognto';

export const RUN = String(__ENV.RUN || 'sin-run').replace(/[^A-Za-z0-9._-]/g, '_');
export const SMOKE = ['1', 'true', 'yes'].includes(String(__ENV.SMOKE || '').toLowerCase());

export function envNumber(name, fallback) {
  const v = Number(__ENV[name]);
  return __ENV[name] !== undefined && __ENV[name] !== '' && Number.isFinite(v) ? v : fallback;
}

export const LOAD_USER_COUNT = Math.max(1, Math.floor(envNumber('LOAD_USER_COUNT', 1000)));
export const LOAD_SESSION_COUNT = Math.max(1, Math.floor(envNumber('LOAD_SESSION_COUNT', 40)));

// Prod solo para la prueba previa al lanzamiento (ver load/lib/env.mjs: PROD_CONFIRM).
const PROD_TARGET =
  __ENV.LOAD_TARGET === 'prod' && __ENV.LOAD_PROD_CONFIRM === PROD_REF + '-sin-usuarios-reales';

// Guard QA/prod (contrato regla 4). Se llama desde setup(); lanza si el destino no es el esperado.
export function assertQaTarget() {
  if (!SUPABASE_URL) throw new Error('Falta SUPABASE_URL');
  const expected = 'https://' + (PROD_TARGET ? PROD_REF : QA_REF) + '.supabase.co';
  if (SUPABASE_URL !== expected) {
    throw new Error('ABORTADO: SUPABASE_URL debe ser ' + expected + (PROD_TARGET ? '' : ' (el harness solo corre contra QA salvo LOAD_TARGET=prod)') + '.');
  }
  if (!SUPABASE_ANON_KEY) throw new Error('Falta SUPABASE_ANON_KEY');
}

// Las respuestas 4xx son "esperadas" para k6 (http_req_failed solo marca 5xx/red);
// la clasificación fina la hacemos nosotros con `errors`.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

const REQUEST_TIMEOUT = '30s';

// http.batch con 14 lecturas en paralelo: k6 limita a 6 por host por defecto; el navegador
// real multiplexa por HTTP/2. Los escenarios importan esto en sus `options`.
export const BATCH_OPTIONS = { batch: 20, batchPerHost: 20 };

// ---------------------------------------------------------------- métricas

export const errors = new Rate('errors'); // 1 = 5xx / timeout / red; 0 = resto
export const rateLimited = new Counter('rate_limited'); // 429
export const authExpired = new Counter('auth_expired'); // 401 (JWT caducado)
export const unexpected4xx = new Counter('unexpected_4xx'); // 4xx distinto de 401/429 en lecturas

export const loginDuration = new Trend('login_duration', true);
export const listSessionsDuration = new Trend('list_sessions_duration', true);
export const bookSessionDuration = new Trend('book_session_duration', true);
export const fetchStateDuration = new Trend('fetch_state_duration', true); // pared de las 14 lecturas
export const fetchStateTableDuration = new Trend('fetch_state_table_duration', true); // tag `table`
export const fetchStateBytes = new Trend('fetch_state_bytes'); // cuerpo total (egress aprox.)
export const fetchStateIncomplete = new Counter('fetch_state_incomplete'); // alguna lectura no fue 2xx
export const myBookingsDuration = new Trend('my_bookings_duration', true);
export const profileDuration = new Trend('profile_duration', true);

export const bookingOk = new Counter('booking_ok'); // 200 con `booking`
export const bookingFull = new Counter('booking_full'); // 200 con `waitlist` (o "La clase está llena")
export const bookingDeniedMembership = new Counter('booking_denied_membership');
export const bookingDuplicate = new Counter('booking_duplicate');
export const bookingOverlap = new Counter('booking_overlap'); // "Se solapa con otra reserva activa"
export const bookingStarted = new Counter('booking_started'); // "Esa clase ya empezó"
export const bookingOtherDenied = new Counter('booking_other_denied'); // 4xx no clasificado -> cuenta en errors

// ---------------------------------------------------------------- HTTP base

export function headers(token) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + (token || SUPABASE_ANON_KEY),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

// Registra una respuesta en errors / rate_limited / auth_expired y devuelve su clase:
// 'server_error' | 'rate_limited' | 'auth_expired' | 'client_error' | 'ok'.
// `forceError` permite marcar como error un 4xx no clasificado (p. ej. 400 desconocido de book_session).
export function recordResponse(res, forceError) {
  const status = res.status;
  if (status === 0 || status >= 500) {
    errors.add(1);
    return 'server_error';
  }
  errors.add(forceError ? 1 : 0);
  if (status === 429) {
    rateLimited.add(1);
    return 'rate_limited';
  }
  if (status === 401) {
    authExpired.add(1);
    return 'auth_expired';
  }
  if (status >= 400) return 'client_error';
  return 'ok';
}

function tagsFor(name, extra) {
  return Object.assign({ name: name }, extra || {});
}

// GET a /rest/v1/<path>. `name` es la etiqueta de endpoint (evita cardinalidad por URL).
export function restGet(path, token, name, extraTags) {
  const res = http.get(SUPABASE_URL + '/rest/v1/' + path, {
    headers: headers(token),
    tags: tagsFor(name, extraTags),
    timeout: REQUEST_TIMEOUT,
  });
  const cls = recordResponse(res);
  if (cls === 'client_error') unexpected4xx.add(1, tagsFor(name));
  return res;
}

// POST a /rest/v1/rpc/<fn>. No registra: el llamador clasifica (book_session lo hace distinto).
export function rpcPost(fn, body, token, name, extraTags) {
  return http.post(SUPABASE_URL + '/rest/v1/rpc/' + fn, JSON.stringify(body), {
    headers: headers(token),
    tags: tagsFor(name, extraTags),
    timeout: REQUEST_TIMEOUT,
  });
}

function parseJson(res) {
  try {
    return res.json();
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- fechas (America/Guayaquil = UTC-5, sin DST)

// Rango [00:00, 23:59:59.999] de "hoy" en Guayaquil, en ISO UTC.
export function todayRangeIso() {
  const OFFSET_MS = 5 * 3600 * 1000;
  const local = new Date(Date.now() - OFFSET_MS);
  const startUtcMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + OFFSET_MS;
  return {
    fromIso: new Date(startUtcMs).toISOString(),
    toIso: new Date(startUtcMs + 24 * 3600 * 1000 - 1).toISOString(),
  };
}

// ---------------------------------------------------------------- lecturas del socio

// listSessions (repo.listSessions): sessions?select=*&starts_at=gte&starts_at=lte&order=starts_at.
// La UI real NO lo usa (la agenda sale de fetchState); aquí es una lectura extra etiquetada.
export function listSessions(token, tags) {
  const r = todayRangeIso();
  const path =
    'sessions?select=*&starts_at=gte.' + encodeURIComponent(r.fromIso) +
    '&starts_at=lte.' + encodeURIComponent(r.toIso) + '&order=starts_at';
  const res = restGet(path, token, 'GET sessions (listSessions)', Object.assign({ endpoint: 'list_sessions' }, tags || {}));
  if (res.status === 200) listSessionsDuration.add(res.timings.duration, tags || {});
  return res;
}

// getCurrentUser(): profiles?select=*&id=eq.<uid>
export function getProfile(token, userId) {
  const res = restGet('profiles?select=*&id=eq.' + userId, token, 'GET profiles (self)', { endpoint: 'profile' });
  if (res.status === 200) profileDuration.add(res.timings.duration);
  return res;
}

// Reservas del propio socio.
export function listMyBookings(token, userId) {
  const res = restGet('bookings?select=*&user_id=eq.' + userId, token, 'GET bookings (mine)', { endpoint: 'my_bookings' });
  if (res.status === 200) myBookingsDuration.add(res.timings.duration);
  return res;
}

// Las 14 lecturas de supabaseRepository.fetchState() (select('*'), sin filtros salvo gym_settings id=1).
// RLS acota lo que ve cada socio, pero el servidor igual evalúa las políticas fila a fila.
export const FETCH_STATE_TABLES = [
  'gym_settings', 'profiles', 'trainers', 'zones', 'class_templates', 'sessions', 'bookings',
  'waitlist_entries', 'check_ins', 'body_measurements', 'body_goals', 'membership_plans',
  'memberships', 'payments',
];

// FETCH_MODE=rpc mide el camino nuevo del cliente: una sola llamada a get_member_state
// (perf-rls-indices.sql). Por defecto, 'tables' = las 14 lecturas del cliente anterior.
const FETCH_MODE = String(__ENV.FETCH_MODE || 'tables').toLowerCase();

function fetchStateRpc(token) {
  const res = rpcPost('get_member_state', {}, token, 'POST rpc/get_member_state (fetchState)', {
    endpoint: 'fetch_state',
    table: 'rpc',
  });
  const cls = recordResponse(res);
  if (cls === 'client_error') unexpected4xx.add(1, { name: 'POST rpc/get_member_state (fetchState)' });
  const ok = res.status === 200;
  const bytes = ok && res.body ? res.body.length : 0;
  if (ok) {
    fetchStateDuration.add(res.timings.duration);
    fetchStateTableDuration.add(res.timings.duration, { table: 'rpc' });
    fetchStateBytes.add(bytes);
  } else {
    fetchStateIncomplete.add(1);
  }
  return { ok: ok, wallMs: res.timings.duration, bytes: bytes, statuses: [res.status] };
}

// Replica fetchState(): 14 GET en paralelo. fetch_state_duration = tiempo de pared del lote
// (lo que espera la UI); fetch_state_table_duration = duración de cada tabla (tag `table`).
// Devuelve { ok, wallMs, bytes, statuses }.
export function fetchState(token) {
  if (FETCH_MODE === 'rpc') return fetchStateRpc(token);
  const reqs = FETCH_STATE_TABLES.map(function (table) {
    const q = table === 'gym_settings' ? 'select=*&id=eq.1' : 'select=*';
    return [
      'GET',
      SUPABASE_URL + '/rest/v1/' + table + '?' + q,
      null,
      {
        headers: headers(token),
        tags: { name: 'GET ' + table + ' (fetchState)', endpoint: 'fetch_state', table: table },
        timeout: REQUEST_TIMEOUT,
      },
    ];
  });

  const t0 = Date.now();
  const resps = http.batch(reqs);
  const wallMs = Date.now() - t0;

  let ok = true;
  let bytes = 0;
  const statuses = [];
  for (let i = 0; i < resps.length; i++) {
    const res = resps[i];
    statuses.push(res.status);
    const cls = recordResponse(res);
    if (cls === 'client_error') unexpected4xx.add(1, { name: 'GET ' + FETCH_STATE_TABLES[i] + ' (fetchState)' });
    if (res.status === 200) {
      fetchStateTableDuration.add(res.timings.duration, { table: FETCH_STATE_TABLES[i] });
      bytes += res.body ? res.body.length : 0;
    } else {
      ok = false;
    }
  }
  if (ok) {
    fetchStateDuration.add(wallMs);
    fetchStateBytes.add(bytes);
  } else {
    fetchStateIncomplete.add(1);
  }
  return { ok: ok, wallMs: wallMs, bytes: bytes, statuses: statuses };
}

// Simula store.refresh(): load() (getCurrentUser + fetchState) y getCurrentUser en paralelo
// => 14 lecturas + 2 de profiles (~16 peticiones; la UI real suma alguna más de Auth).
export function simulateRefresh(token, userId) {
  getProfile(token, userId);
  const st = fetchState(token);
  getProfile(token, userId);
  return st;
}

// ---------------------------------------------------------------- book_session

// Clasifica la respuesta de book_session. Devuelve uno de:
// 'ok' | 'full' | 'denied_membership' | 'duplicate' | 'overlap' | 'started' | 'other_denied'
// | 'rate_limited' | 'auth_expired' | 'server_error'
export function classifyBookSession(res) {
  if (res.status === 0 || res.status >= 500) return 'server_error';
  if (res.status === 429) return 'rate_limited';
  if (res.status === 401) return 'auth_expired';
  const body = parseJson(res);
  if (res.status === 200) {
    if (body && body.booking) return 'ok';
    if (body && body.waitlist) return 'full';
    return 'other_denied'; // 200 con forma inesperada
  }
  const msg = body && typeof body.message === 'string' ? body.message : '';
  if (res.status === 400) {
    if (/Ya tienes reserva/i.test(msg)) return 'duplicate';
    if (/solapa/i.test(msg)) return 'overlap';
    if (/ya empez/i.test(msg)) return 'started';
    if (/llena/i.test(msg)) return 'full'; // espera apagada: "La clase está llena"
    if (/membres|visitas|pase|plan|zona/i.test(msg)) return 'denied_membership';
  }
  return 'other_denied';
}

// Llama book_session, registra métricas y devuelve la clase. `target` ('popular'|'other') etiqueta la duración.
export function bookSession(token, userId, sessionId, target) {
  const res = rpcPost('book_session', { p_session_id: sessionId, p_user_id: userId }, token, 'POST rpc/book_session', {
    endpoint: 'book_session',
    target: target || 'other',
  });
  const kind = classifyBookSession(res);
  recordResponse(res, kind === 'other_denied');
  // Mide el mismo camino bloqueante en 200 y 400 de negocio (slo.md L3).
  if (res.status === 200 || res.status === 400) {
    bookSessionDuration.add(res.timings.duration, { target: target || 'other' });
  }
  switch (kind) {
    case 'ok': bookingOk.add(1); break;
    case 'full': bookingFull.add(1); break;
    case 'denied_membership': bookingDeniedMembership.add(1); break;
    case 'duplicate': bookingDuplicate.add(1); break;
    case 'overlap': bookingOverlap.add(1); break;
    case 'started': bookingStarted.add(1); break;
    case 'other_denied': bookingOtherDenied.add(1); break;
    default: break;
  }
  return kind;
}

// ---------------------------------------------------------------- resumen (handleSummary)

function val(data, metric, key) {
  const m = data.metrics[metric];
  return m && m.values && m.values[key] !== undefined ? m.values[key] : null;
}

function fmt(v, digits) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return Number(v).toFixed(digits === undefined ? 0 : digits);
}

function trendLine(data, metric, label) {
  const m = data.metrics[metric];
  if (!m || !m.values || !val(data, metric, 'count')) return '  ' + label + ': sin muestras';
  return (
    '  ' + label + ': n=' + fmt(val(data, metric, 'count')) +
    ' avg=' + fmt(val(data, metric, 'avg')) + ' med=' + fmt(val(data, metric, 'med')) +
    ' p90=' + fmt(val(data, metric, 'p(90)')) + ' p95=' + fmt(val(data, metric, 'p(95)')) +
    ' p99=' + fmt(val(data, metric, 'p(99)')) + ' max=' + fmt(val(data, metric, 'max')) + ' ms'
  );
}

function count(data, metric) {
  const v = val(data, metric, 'count');
  return v === null ? 0 : v;
}

// Umbrales evaluados por k6: lista de { metric, expr, ok }.
function thresholdRows(data) {
  const rows = [];
  Object.keys(data.metrics).forEach(function (name) {
    const t = data.metrics[name].thresholds;
    if (!t) return;
    Object.keys(t).forEach(function (expr) {
      const v = t[expr];
      const ok = v && typeof v === 'object' ? !!v.ok : !!v;
      if (expr === 'max>=0') return; // umbral de visibilidad (no es SLO)
      rows.push({ metric: name, expr: expr, ok: ok });
    });
  });
  return rows;
}

// Construye el handleSummary de un escenario. `key` = 'a' | 'b'. `sections` = [{ title, trends:[[metric,label]],
// counters:[[metric,label]] }]. Escribe load/reports/<RUN>/summary-<key>.json (cwd = app/) y texto por stdout.
export function buildSummary(data, key, titulo, sections) {
  const reqs = count(data, 'http_reqs');
  const rl = count(data, 'rate_limited');
  const ae = count(data, 'auth_expired');
  const rlPct = reqs > 0 ? (rl / reqs) * 100 : 0;
  const started = count(data, 'vus_started');
  const valid = count(data, 'vus_token_valid');
  const validPct = started > 0 ? (valid / started) * 100 : 100;
  const errRate = val(data, 'errors', 'rate');
  const rows = thresholdRows(data);
  const failed = rows.filter(function (r) { return !r.ok; });

  const warnings = [];
  if (rlPct > 5) {
    warnings.push('corrida no concluyente: 429 = ' + fmt(rlPct, 1) + ' % de las peticiones (> 5 %). Es techo de Auth/PostgREST en Free, no codigo.');
  }
  if (ae > 0) {
    warnings.push('corrida invalida: ' + ae + ' respuesta(s) 401 (JWT caducado). Regenerar tokens (load:mint) y repetir.');
  }
  if (started > 0 && validPct < 90) {
    warnings.push('corrida invalida: solo ' + fmt(validPct, 1) + ' % de los VUs partio con token valido (< 90 %).');
  }
  if (count(data, 'no_token') > 0) {
    warnings.push('hubo ' + count(data, 'no_token') + ' iteraciones sin token disponible (pool incompleto).');
  }

  const L = [];
  L.push('');
  L.push('=== ' + titulo + ' | run=' + RUN + (SMOKE ? ' | SMOKE' : '') + ' ===');
  L.push('Peticiones HTTP: ' + fmt(reqs) + ' | iteraciones: ' + fmt(count(data, 'iterations')) +
    ' | duracion: ' + fmt((data.state && data.state.testRunDurationMs ? data.state.testRunDurationMs : 0) / 1000) + ' s');
  L.push('Error rate (5xx/timeout/red): ' + (errRate === null ? '-' : fmt(errRate * 100, 2) + ' %') +
    ' | 429: ' + rl + ' (' + fmt(rlPct, 1) + ' %) | 401: ' + ae);
  sections.forEach(function (s) {
    L.push('');
    L.push(s.title);
    (s.trends || []).forEach(function (t) { L.push(trendLine(data, t[0], t[1])); });
    (s.counters || []).forEach(function (c) { L.push('  ' + c[1] + ': ' + fmt(count(data, c[0]))); });
  });
  L.push('');
  L.push('Umbrales (SLO):');
  rows.forEach(function (r) { L.push('  [' + (r.ok ? 'OK ' : 'FALLA') + '] ' + r.metric + ' ' + r.expr); });
  if (rows.length === 0) L.push('  (ninguno evaluado)');
  if (warnings.length) {
    L.push('');
    L.push('ADVERTENCIAS:');
    warnings.forEach(function (w) { L.push('  ! ' + w); });
  }
  L.push('');
  L.push(failed.length ? 'Resultado k6: ' + failed.length + ' umbral(es) fallido(s). Falta correr load:check para integridad.'
    : 'Resultado k6: umbrales OK. Falta correr load:check para integridad y el veredicto del gate.');
  L.push('JSON: load/reports/' + RUN + '/summary-' + key + '.json');
  L.push('');

  const out = {
    harness: {
      scenario: key,
      run: RUN,
      smoke: SMOKE,
      generated_at: new Date().toISOString(),
      http_reqs: reqs,
      rate_limited: rl,
      rate_limited_pct: rlPct,
      auth_expired: ae,
      vus_started: started,
      vus_token_valid: valid,
      inconclusive_429: rlPct > 5,
      invalid_run: ae > 0 || (started > 0 && validPct < 90),
      thresholds_failed: failed.map(function (r) { return r.metric + ' ' + r.expr; }),
      warnings: warnings,
    },
    data: data,
  };
  const files = { stdout: L.join('\n') };
  files['load/reports/' + RUN + '/summary-' + key + '.json'] = JSON.stringify(out, null, 2);
  return files;
}
