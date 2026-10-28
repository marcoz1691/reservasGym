# Harness de stress en QA (Zona Cero)

## Objetivo

Medir, contra el ambiente **QA** (Supabase Free), si las rutas críticas de la app aguantan carga realista y si los datos siguen siendo íntegros:

- **Escenario A (reservas):** carrera por cupos de `book_session` (sesión popular `load-popular` + sesiones normales `load-sNN`), con socios `active`, `grace` y `expired`.
- **Escenario B (agenda):** ráfaga de lectura (`listSessions`, `fetchState`) con tokens pregenerados.
- **Integridad:** después de cada corrida, `load:check` verifica cupos, contadores, duplicados, elegibilidad y listas de espera.

El resultado es un veredicto **APROBADO / APROBADO CON DEUDA / NO LANZAR** (ver `slo.md`). Es una entrada para la decisión de go-live, no la sustituye.

Documentos relacionados: `inventory.md` (hot paths y gaps de índices), `slo.md` (umbrales y gate), `explain.sql` (EXPLAIN de queries lentas), `reports/report-template.md` (plantilla del informe).

## Ambiente

- **QA por defecto:** proyecto `kqhmclbexnnsbzbgerbx` (plan Free). Todos los scripts abortan si `SUPABASE_URL` no es exactamente el origen de QA.
- **Prod solo antes del lanzamiento** (`gvgqlmoulgcickxognto`, Pro), para medir la capacidad real con la base vacía. Exige las tres cosas:
  1. `app/.env.load.prod.local` (mismas variables que el de QA, con las claves de prod; git lo ignora).
  2. `LOAD_TARGET=prod` y `LOAD_PROD_CONFIRM=gvgqlmoulgcickxognto-sin-usuarios-reales` **en la línea de comandos**.
  3. Prod sin usuarios reales: seed, mint, check y `run-k6.sh` abortan si hay un solo usuario Auth fuera de `load.*@zonacero.test`. Una vez lanzada la app, este modo deja de servir.

  Meta y tokens van a `load/.tmp-prod/`, separados de QA. Ejemplo:
  ```
  export LOAD_TARGET=prod LOAD_PROD_CONFIRM=gvgqlmoulgcickxognto-sin-usuarios-reales
  node --env-file=.env.load.prod.local load/seed-load-users.mjs
  node --env-file=.env.load.prod.local load/mint-tokens.mjs --limit 300
  SMOKE=1 FETCH_MODE=rpc bash load/run-k6.sh a <run>-smoke
  node --env-file=.env.load.prod.local load/check-integrity.mjs --run <run>
  node --env-file=.env.load.prod.local load/cleanup-load-users.mjs        # dry-run, luego --yes
  ```
- Un APROBADO en Free no demuestra capacidad en Pro.

## Requisitos

- **k6** en `~/.local/bin/k6` (o en el PATH). Verificar: `~/.local/bin/k6 version`.
- **Node 24** (usa `fetch` nativo y `--env-file`). Sin dependencias npm nuevas.
- **`app/.env.load.local`** (ya ignorado por git vía `.env*`). Variables:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `SUPABASE_URL` | sí | URL del proyecto QA: `https://kqhmclbexnnsbzbgerbx.supabase.co` |
| `SUPABASE_ANON_KEY` | sí | Clave `anon` de QA. Dashboard de QA, Project Settings, API. |
| `SUPABASE_SERVICE_ROLE_KEY` | sí (scripts Node) | Clave `service_role` de QA, mismo lugar. Solo la usan seed, mint, check y cleanup; k6 no la necesita. |
| `LOAD_PASSWORD` | sí | Contraseña compartida de todos los usuarios de carga (mínimo 8 caracteres; invente una nueva). |
| `LOAD_USER_COUNT` | no | Socios sintéticos. Default 1000. |
| `LOAD_SESSION_COUNT` | no | Sesiones `load-sNN`. Default 40. |
| `LOAD_POPULAR_CAPACITY` | no | Capacidad de `load-popular`. Default 30. |

Opcionales del escenario k6 (se pasan por entorno al invocar `load:a` / `load:b`): `SMOKE=1`, `TOKENS_FILE`, `LOGIN_FRACTION`, `LOAD_MIX`, `REFRESH_PROB`.

Nunca pegue claves en chats, issues, commits ni informes.

## Orden de ejecución

Todo desde `app/`.

1. **Seed** (idempotente; crea usuarios Auth, perfiles, membresías y sesiones `load-*`):
   ```bash
   npm run load:seed
   ```
2. **Mint de tokens** (login con concurrencia baja y backoff; reanudable). Genera `load/.tmp/tokens.json`:
   ```bash
   npm run load:mint
   ```
3. **k6, SMOKE primero** (corrida corta para validar que todo conecta y que no hay 401/429 masivos):
   ```bash
   SMOKE=1 npm run load:a -- 2026-10-22-smoke
   SMOKE=1 npm run load:b -- 2026-10-22-smoke
   ```
   Si el humo pasa, corrida completa (el nombre de corrida es libre y define la carpeta de reportes):
   ```bash
   npm run load:a -- 2026-10-22-a
   npm run load:b -- 2026-10-22-b
   ```
   El wrapper `load/run-k6.sh <a|b> <run>` carga `.env.load.local`, valida QA/prod, corre k6 desde `app/` y deja en `load/reports/<run>/` el log (`k6-a.log` / `k6-b.log`) y el resumen (`summary-a.json` / `summary-b.json`). El código de salida es el de k6 (99 = algún threshold falló).
4. **Chequeo de integridad** (usar el mismo `<run>` de la corrida que se evalúa, justo después de ella):
   ```bash
   npm run load:check -- --run 2026-10-22-a
   ```
5. **EXPLAIN** de las queries lentas con `explain.sql` (SQL Editor de QA) si algún p95 se excede.
6. **Informe:** copiar `reports/report-template.md` a `reports/<run>/informe.md` y completarlo.
7. **Limpieza (obligatoria al terminar):**
   ```bash
   npm run load:cleanup            # dry-run: solo lista lo que borraría
   npm run load:cleanup -- --yes   # borra de verdad
   ```

Si los tokens vencen (duran cerca de 1 hora) durante la corrida, k6 recibirá 401: la corrida queda invalidada. Regenere con `npm run load:mint` y repita.

## Límites del plan Free (leer antes de culpar al código)

- **Rate limit de Auth por IP:** el login masivo desde una sola IP devuelve 429. Por eso se usa un pool de tokens pregenerado (`load:mint`, concurrencia baja) y solo una fracción pequeña de VUs hace login real (`LOGIN_FRACTION`).
- **Tokens de ~1 hora:** una sesión de pruebas larga exige re-mint. `REFRESH_PROB` controla la probabilidad de que un VU renueve su sesión (ver `k6/lib/auth.js`).
- **Egress de 5 GB/mes:** `fetchState` descarga ~14 tablas completas; muchas corridas completas pueden agotar el cupo mensual. Controle el número de corridas y no repita escenarios B sin necesidad.
- **Conexiones y CPU compartidas:** PostgREST y Postgres tienen un pool pequeño; un techo temprano puede ser infraestructura y no código. El informe debe decir cuál es.
- **Sin backups ni garantías de cómputo:** el proyecto puede pausarse por inactividad.
- Un 429 no cuenta como error de E1 (se reporta aparte). Si supera 5 % de las peticiones de un escenario, el SLO afectado queda **no concluyente**.

## Cómo leer el gate

El detalle está en `slo.md` (§1 umbrales, §3 gate). Resumen:

| Veredicto | Cuándo |
|---|---|
| **NO LANZAR** | Cualquier violación de integridad (I1 a I7), error rate >= 1 %, algún p95 de login / listSessions / `book_session` por encima de 1,5 veces su umbral, o el escenario no terminó por causa del sistema. |
| **APROBADO CON DEUDA** | Integridad intacta, error rate < 1 % y al menos un p95 sobre su umbral pero <= 1,5 veces. Cada exceso se registra como deuda con causa probable y remediación. |
| **APROBADO** | p95 login < 1500 ms, listSessions < 1000 ms, `book_session` < 1500 ms, error rate < 1 % y 0 violaciones de integridad. |

Se evalúa en ese orden; vale la primera regla que se cumpla. El veredicto final es el peor entre A y B. Una corrida es **no concluyente** (se repite) si no se corrió `load:check` para esa misma corrida, si menos de 90 % de los VUs partió con token válido, si hubo más de 5 % de 429, o si el seed está incompleto.

## Advertencias

- **La limpieza es obligatoria.** Los datos de carga (usuarios `load.*@zonacero.test`, membresías, sesiones `load-*`, reservas y cobros) contaminan QA y pueden afectar a otras pruebas manuales. Corra `load:cleanup` (dry-run y luego `--yes`) al terminar, aunque la corrida haya fallado a medias.
- **No use `load.staff` en bucle.** El usuario staff es un único Auth con permisos amplios; martillarlo con logins o llamadas masivas dispara el rate limit por usuario/IP y distorsiona las métricas. Úselo solo para operaciones puntuales.
- La carga real en la anon key y en los tokens la ve Supabase como tráfico legítimo: no corra el harness en horario de pruebas manuales de otras personas sin avisar.

## Qué NO hacer

- No apuntar a producción fuera de la prueba previa al lanzamiento, ni siquiera "solo lectura". No se debe quitar ni debilitar el freno de usuarios reales.
- No hacer commit de `app/.env.load.local`, `app/.env.load.prod.local`, `load/.tmp/`, `load/.tmp-prod/` (tokens y meta) ni `load/reports/<run>/` (solo se versiona `reports/report-template.md`).
- No imprimir ni compartir `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` ni `LOAD_PASSWORD` en logs o informes.
- No ejecutar `load:cleanup -- --yes` sin revisar antes el dry-run.
- No lanzar una corrida completa sin que el SMOKE haya pasado.
- No usar los resultados de Free como prueba de capacidad de Pro.
