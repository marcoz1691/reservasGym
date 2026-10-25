// Escenario B: burst de lectura de la agenda (QA, plan Free). Nunca producción.
//
// La UI real no usa listSessions: la agenda sale de fetchState() (14 select('*')) tras el login y tras
// cada acción. La unidad principal aquí es el fetchState completo del socio (`fetch_state_duration` =
// tiempo de pared de las 14 lecturas; `fetch_state_table_duration{table}` = una Trend por tabla).
// listSessions queda como lectura extra etiquetada (tag extra=1) para el SLO L2.
//
// Perfil: burst 300 -> 500 VUs en ~3,5 min. SMOKE=1: 10 VUs, ~1 min. Sin login por iteración: los VUs
// usan el pool de tokens (TOKENS_FILE, duran ~1 h); solo una fracción pequeña (LOGIN_FRACTION, default
// 0.02 en B, ~10 logins a 500 VUs) hace login real para la muestra de L1 sin disparar el rate limit.
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, LOAD_PASSWORD, LOAD_USER_COUNT, RUN, SMOKE, TOKENS_FILE,
//      LOGIN_FRACTION (0.02). LOAD_SESSION_COUNT, LOAD_MIX y REFRESH_PROB no aplican en B.

import { sleep } from 'k6';
import exec from 'k6/execution';
import {
  assertQaTarget,
  buildSummary,
  envNumber,
  fetchState,
  getProfile,
  listSessions,
  FETCH_STATE_TABLES,
  SMOKE,
  BATCH_OPTIONS,
} from './lib/supabase.js';
import { getAuth, poolStats, tokenPool } from './lib/auth.js';

const LOGIN_FRACTION = envNumber('LOGIN_FRACTION', 0.02);

// Una Trend por tabla (visible en el resumen y en el JSON). `max>=0` no es un SLO: solo fuerza
// que k6 exporte la sub-métrica etiquetada.
const perTable = {};
FETCH_STATE_TABLES.forEach(function (t) {
  perTable['fetch_state_table_duration{table:' + t + '}'] = ['max>=0'];
});

const B_SCALE = Math.max(0.02, Math.min(1, Number(__ENV.B_SCALE || 1)));

export const options = Object.assign(
  {
    scenarios: {
      agenda: {
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
              // B_SCALE (default 1) escala los VUs para acotar el egress del plan Free:
              // cada fetchState pesa ~49 KB; 0.6 => pico de 300 VUs (~0,5 GB), 1 => pico de 500 (~1,4 GB).
              { duration: '30s', target: Math.round(300 * B_SCALE) }, // burst inicial
              { duration: '1m', target: Math.round(300 * B_SCALE) },
              { duration: '30s', target: Math.round(500 * B_SCALE) }, // pico
              { duration: '1m', target: Math.round(500 * B_SCALE) },
              { duration: '30s', target: 0 }, // bajada
            ],
      },
    },
    // SLO (load/slo.md): L1 login (muestra baja), L2 listSessions, E1 error rate.
    // No hay umbral duro para fetch_state_duration: no está en el SLO, se reporta como medición
    // principal del cuello de lectura (informe y remediación "acotar fetchState").
    thresholds: Object.assign(
      {
        login_duration: ['p(95)<1500'],
        list_sessions_duration: ['p(95)<1000'],
        errors: ['rate<0.01'],
        fetch_state_duration: ['max>=0'],
      },
      perTable,
    ),
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
      ' | LOGIN_FRACTION=' + LOGIN_FRACTION + (SMOKE ? ' | SMOKE' : ''),
  );
  if (st.expired > 0) console.warn('Hay tokens caducados en el pool: regenerar con load:mint (duran ~1 h).');
  if (LOGIN_FRACTION > 0 && !__ENV.LOAD_PASSWORD) {
    console.warn('LOGIN_FRACTION > 0 pero falta LOAD_PASSWORD: no habra login real (los VUs usan el pool).');
  }
  return { poolSize: tokenPool.length };
}

export default function () {
  // Sin rotación: cada VU es un socio fijo, como un usuario que abre la app y recarga la agenda.
  const auth = getAuth({ loginFraction: LOGIN_FRACTION, rotate: false });
  if (!auth || !auth.token || !auth.userId) {
    sleep(1);
    return;
  }

  // Post-login / recarga: getCurrentUser + fetchState completo (unidad principal de B).
  getProfile(auth.token, auth.userId);
  fetchState(auth.token);

  // Lectura extra etiquetada: listSessions de hoy (SLO L2). La UI real no la usa.
  listSessions(auth.token, { extra: '1' });

  sleep(1 + Math.random() * 2);
}

export function handleSummary(data) {
  const tableTrends = FETCH_STATE_TABLES.map(function (t) {
    return ['fetch_state_table_duration{table:' + t + '}', '  ' + t];
  });
  return buildSummary(data, 'b', 'Escenario B: burst de agenda (fetchState)', [
    {
      title: 'Latencias principales',
      trends: [
        ['fetch_state_duration', 'fetch_state_duration (14 lecturas, pared)'],
        ['list_sessions_duration', 'list_sessions_duration (L2, lectura extra)'],
        ['login_duration', 'login_duration (L1, muestra baja)'],
        ['profile_duration', 'profile_duration'],
        ['fetch_state_bytes', 'fetch_state_bytes (bytes por fetchState)'],
      ],
      counters: [['fetch_state_incomplete', 'fetchState incompletos (alguna lectura no fue 2xx)']],
    },
    { title: 'fetchState por tabla (ms)', trends: tableTrends },
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
