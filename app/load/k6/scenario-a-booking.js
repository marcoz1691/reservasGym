// Escenario A: carrera de reservas sobre book_session (QA, plan Free). Nunca producción.
//
// Flujo por iteración (VU = socio): token -> GET sessions de hoy -> POST /rpc/book_session
// (70 % `load-popular`, 30 % otra `load-sNN`) -> GET bookings propias -> (con prob. REFRESH_PROB)
// simula store.refresh() = fetchState (~16 peticiones). Cada VU rota entre socios (ROTATE) para que
// compitan muchos usuarios por los cupos de `load-popular`.
//
// Perfil: 0 -> 100 -> 200 VUs en ~12 min. SMOKE=1: 10 VUs, 1 min.
// Se ejecuta desde app/ (run-k6.sh): k6 run load/k6/scenario-a-booking.js
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, LOAD_PASSWORD, LOAD_USER_COUNT, LOAD_SESSION_COUNT, RUN, SMOKE,
//      TOKENS_FILE, LOGIN_FRACTION (0.1), LOAD_MIX (0.7 = prob. de `load-popular`), REFRESH_PROB (0.2).

import { sleep } from 'k6';
import exec from 'k6/execution';
import {
  assertQaTarget,
  bookSession,
  buildSummary,
  envNumber,
  listMyBookings,
  listSessions,
  simulateRefresh,
  LOAD_SESSION_COUNT,
  SMOKE,
  BATCH_OPTIONS,
} from './lib/supabase.js';
import { getAuth, poolStats, tokenPool } from './lib/auth.js';

const LOGIN_FRACTION = envNumber('LOGIN_FRACTION', 0.1);
const LOAD_MIX = Math.min(1, Math.max(0, envNumber('LOAD_MIX', 0.7)));
const REFRESH_PROB = Math.min(1, Math.max(0, envNumber('REFRESH_PROB', 0.2)));
const POPULAR_ID = 'load-popular';

const PEAK_VUS = SMOKE ? 10 : 200;

export const options = Object.assign(
  {
    scenarios: {
      booking: {
        executor: 'ramping-vus',
        startVUs: 0,
        gracefulRampDown: '15s',
        gracefulStop: '30s',
        stages: SMOKE
          ? [
              { duration: '15s', target: 10 },
              { duration: '35s', target: 10 },
              { duration: '10s', target: 0 },
            ]
          : [
              { duration: '3m', target: 100 }, // rampa a 100
              { duration: '2m', target: 100 }, // meseta
              { duration: '3m', target: 200 }, // rampa a 200
              { duration: '3m', target: 200 }, // meseta (pico)
              { duration: '1m', target: 0 }, // bajada
            ],
      },
    },
    // SLO (load/slo.md): L1 login, L2 listSessions, L3 book_session, E1 error rate.
    thresholds: {
      login_duration: ['p(95)<1500'],
      list_sessions_duration: ['p(95)<1000'],
      book_session_duration: ['p(95)<1500'],
      errors: ['rate<0.01'],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
  },
  BATCH_OPTIONS,
);

export function setup() {
  assertQaTarget(); // aborta si la URL es prod o no es QA
  const st = poolStats();
  if (st.total === 0) {
    exec.test.abort('Pool de tokens vacio o ilegible (TOKENS_FILE). Ejecuta load:mint antes.');
  }
  console.log(
    'Pool de tokens: ' + st.total + ' (caducados: ' + st.expired + ') estados=' + JSON.stringify(st.byState) +
      ' | LOGIN_FRACTION=' + LOGIN_FRACTION + ' LOAD_MIX=' + LOAD_MIX + ' REFRESH_PROB=' + REFRESH_PROB +
      (SMOKE ? ' | SMOKE' : ''),
  );
  if (st.expired > 0) console.warn('Hay tokens caducados en el pool: regenerar con load:mint (duran ~1 h).');
  if (LOGIN_FRACTION > 0 && !__ENV.LOAD_PASSWORD) {
    console.warn('LOGIN_FRACTION > 0 pero falta LOAD_PASSWORD: no habra login real (los VUs usan el pool).');
  }
  return { poolSize: tokenPool.length };
}

function pickSession() {
  if (Math.random() < LOAD_MIX) return { id: POPULAR_ID, target: 'popular' };
  const k = 1 + Math.floor(Math.random() * LOAD_SESSION_COUNT);
  return { id: 'load-s' + String(k).padStart(2, '0'), target: 'other' };
}

export default function () {
  const auth = getAuth({ loginFraction: LOGIN_FRACTION, rotate: true, stride: PEAK_VUS });
  if (!auth || !auth.token || !auth.userId) {
    sleep(1);
    return;
  }

  // 1) Agenda de hoy (en la UI real sale de fetchState; aquí la lectura directa por starts_at).
  listSessions(auth.token);
  sleep(0.5 + Math.random());

  // 2) Reserva: carrera sobre la sesión popular (cupo bajo) o sobre otra sesión al azar.
  const s = pickSession();
  bookSession(auth.token, auth.userId, s.id, s.target);

  // 3) Reservas del propio socio.
  listMyBookings(auth.token, auth.userId);

  // 4) Con probabilidad REFRESH_PROB, la recarga completa que dispara cada acción de la UI.
  if (Math.random() < REFRESH_PROB) simulateRefresh(auth.token, auth.userId);

  sleep(1 + Math.random() * 2);
}

export function handleSummary(data) {
  return buildSummary(data, 'a', 'Escenario A: reservas (book_session)', [
    {
      title: 'Latencias (SLO L1-L3)',
      trends: [
        ['login_duration', 'login_duration (L1)'],
        ['list_sessions_duration', 'list_sessions_duration (L2)'],
        ['book_session_duration', 'book_session_duration (L3)'],
        ['my_bookings_duration', 'my_bookings_duration'],
        ['fetch_state_duration', 'fetch_state_duration (refresh simulado)'],
      ],
    },
    {
      title: 'Resultados de book_session',
      counters: [
        ['booking_ok', 'booking_ok (reservas confirmadas)'],
        ['booking_full', 'booking_full (lista de espera)'],
        ['booking_denied_membership', 'booking_denied_membership'],
        ['booking_duplicate', 'booking_duplicate'],
        ['booking_overlap', 'booking_overlap'],
        ['booking_started', 'booking_started'],
        ['booking_other_denied', 'booking_other_denied (cuenta como error)'],
      ],
    },
    {
      title: 'Autenticacion',
      counters: [
        ['vus_started', 'VUs iniciados'],
        ['vus_token_valid', 'VUs con token valido'],
        ['no_token', 'iteraciones sin token'],
        ['token_fallback', 'usuarios sin token minteado (fallback)'],
      ],
    },
  ]);
}
