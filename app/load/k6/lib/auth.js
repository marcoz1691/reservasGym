// Autenticación para los escenarios k6: pool de tokens pregenerados + login real para una fracción.
//
// Por qué un pool: el login masivo desde una sola IP da 429 en Auth (plan Free: ~30 inicios de sesión
// por 5 min por IP por defecto). `load:mint` genera `load/.tmp/tokens.json` con concurrencia baja y
// backoff; los VUs toman de ahí su access_token. Solo una fracción de VUs (LOGIN_FRACTION, default 0.1
// en A) hace el login real, una vez por VU, para medir `login_duration` (SLO L1).
//
// IMPORTANTE: los access_token de Supabase duran ~1 h (3600 s por defecto). Si pasó más tiempo desde
// `load:mint`, las peticiones darán 401 (`auth_expired`) y la corrida es inválida: regenerar tokens.
//
// Variables de entorno: TOKENS_FILE, LOAD_PASSWORD, LOAD_USER_COUNT, LOGIN_FRACTION.
// TOKENS_FILE: ruta absoluta, o relativa a los escenarios (load/k6/); default ../.tmp/tokens.json
// (= load/.tmp/tokens.json). k6 resuelve open() respecto a la carpeta del módulo; aquí se normaliza.

import http from 'k6/http';
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';
import {
  SUPABASE_URL,
  LOAD_USER_COUNT,
  headers,
  recordResponse,
  loginDuration,
  envNumber,
} from './supabase.js';

export { LOAD_USER_COUNT };

const TOKENS_FILE_ENV = __ENV.TOKENS_FILE || '../.tmp/tokens.json';
// Este módulo vive en load/k6/lib/: una ruta relativa "de escenario" necesita un ../ extra.
const TOKENS_PATH = TOKENS_FILE_ENV.charAt(0) === '/' ? TOKENS_FILE_ENV : '../' + TOKENS_FILE_ENV;

export const vusStarted = new Counter('vus_started'); // VUs que arrancaron (una vez por VU)
export const vusTokenValid = new Counter('vus_token_valid'); // ... con token presente y no caducado
export const noToken = new Counter('no_token'); // iteraciones sin token disponible
export const tokenFallback = new Counter('token_fallback'); // n no minteado: se usó otro usuario del pool

// Pool compartido entre VUs (una sola copia en memoria). Si el archivo falta o es ilegible queda []
// y setup() aborta con un mensaje claro (así `k6 inspect` no necesita el archivo).
export const tokenPool = new SharedArray('tokens', function () {
  try {
    const arr = JSON.parse(open(TOKENS_PATH));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
});

// expires_at puede venir en segundos epoch, ms epoch o ISO. Devuelve ms o Infinity si no hay dato.
function expiresMs(entry) {
  const v = entry && entry.expires_at;
  if (v === undefined || v === null || v === '') return Infinity;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  const p = Date.parse(v);
  return Number.isNaN(p) ? Infinity : p;
}

// Para setup(): estadísticas del pool sin exponer tokens.
export function poolStats() {
  const now = Date.now();
  let expired = 0;
  const byState = {};
  for (let i = 0; i < tokenPool.length; i++) {
    const e = tokenPool[i];
    if (expiresMs(e) <= now) expired++;
    byState[e.state] = (byState[e.state] || 0) + 1;
  }
  return { total: tokenPool.length, expired: expired, byState: byState };
}

export function padUser(n) {
  return String(n).padStart(4, '0');
}

export function userEmail(n) {
  return 'load.' + padUser(n) + '@zonacero.test';
}

// Usuario determinista por VU: n = (__VU-1) % LOAD_USER_COUNT + 1.
// Con `rotate` (stride = VUs pico) el VU recorre otros usuarios en cada iteración:
// n = ((__VU-1) + __ITER*stride) % LOAD_USER_COUNT + 1, para repartir intentos de reserva entre
// muchos socios (de lo contrario cada VU repetiría "Ya tienes reserva" tras su primer éxito).
export function userNumber(rotate, stride) {
  const base = __VU - 1 + (rotate ? __ITER * (stride || 1) : 0);
  return (base % LOAD_USER_COUNT) + 1;
}

// VU "de login real": determinista por fracción (0.1 => VUs 1..10 de cada 100).
export function isLoginVu(fraction) {
  if (!(fraction > 0)) return false;
  return ((__VU - 1) % 100) / 100 < fraction;
}

let poolIndex = null; // n -> posición en el pool, por VU
function entryFor(n) {
  if (poolIndex === null) {
    poolIndex = {};
    for (let i = 0; i < tokenPool.length; i++) poolIndex[tokenPool[i].n] = i;
  }
  const i = poolIndex[n];
  if (i !== undefined) return tokenPool[i];
  if (tokenPool.length === 0) return null;
  tokenFallback.add(1);
  return tokenPool[(n - 1) % tokenPool.length];
}

// Login real: POST /auth/v1/token?grant_type=password. login_duration solo con 200 (SLO L1).
// Devuelve { token, userId } o null.
export function login(n) {
  const password = __ENV.LOAD_PASSWORD || '';
  if (!password) return null;
  const res = http.post(
    SUPABASE_URL + '/auth/v1/token?grant_type=password',
    JSON.stringify({ email: userEmail(n), password: password }),
    { headers: headers(null), tags: { name: 'POST auth/token (login)', endpoint: 'login' }, timeout: '30s' },
  );
  recordResponse(res);
  if (res.status !== 200) return null;
  loginDuration.add(res.timings.duration);
  try {
    const body = res.json();
    return { token: body.access_token, userId: body.user && body.user.id };
  } catch (e) {
    return null;
  }
}

let vuLogin = null; // resultado del login real del VU (se hace una sola vez)
let vuLoginTried = false;
let counted = false;

// Devuelve { token, userId, n, source } para esta iteración, o null si no hay token.
// opciones: { loginFraction, rotate, stride }
export function getAuth(opts) {
  const o = opts || {};
  const loginFraction = o.loginFraction !== undefined ? o.loginFraction : envNumber('LOGIN_FRACTION', 0.1);

  // Login real (una vez por VU, usuario fijo del VU, sin rotación).
  if (isLoginVu(loginFraction)) {
    if (!vuLoginTried) {
      vuLoginTried = true;
      vuLogin = login(userNumber(false));
    }
    if (vuLogin && vuLogin.token) {
      const n0 = userNumber(false);
      const e0 = entryFor(n0);
      const userId = vuLogin.userId || (e0 && e0.user_id);
      if (!counted) {
        counted = true;
        vusStarted.add(1);
        vusTokenValid.add(1);
      }
      return { token: vuLogin.token, userId: userId, n: n0, source: 'login' };
    }
    // login falló (p. ej. 429): se cae al pool
  }

  const n = userNumber(!!o.rotate, o.stride);
  const entry = entryFor(n);
  const valid = !!(entry && entry.access_token && expiresMs(entry) > Date.now());
  if (!counted) {
    counted = true;
    vusStarted.add(1);
    if (valid) vusTokenValid.add(1);
  }
  if (!entry || !entry.access_token) {
    noToken.add(1);
    return null;
  }
  return { token: entry.access_token, userId: entry.user_id, n: entry.n || n, source: 'pool' };
}
