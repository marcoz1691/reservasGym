# Informe de rendimiento en QA — remediaciones (2026-10-23)

Continúa el [informe de stress del 22-oct](informe-stress-qa-2026-10-22.md) (línea base). Mismo harness (`app/load/`), mismo ambiente (QA `kqhmclbexnnsbzbgerbx`, plan Free), mismos escenarios y SLO (`app/load/slo.md`).

## Veredicto

| Escenario | 22-oct (antes) | 23-oct (después) |
|---|---|---|
| A: carrera de reservas, 200 VUs, 12 min | NO LANZAR | **APROBADO CON DEUDA** (listSessions p95 1.051 ms, apenas sobre el umbral de 1.000; resto OK) |
| B: burst de agenda, pico 300 VUs, cliente nuevo (RPC) | NO LANZAR (47,9 % de errores) | **APROBADO** (0 % de errores, todos los SLO) |
| B con el cliente anterior (14 lecturas), tras la migración | — | NO LANZAR (18,4 % de errores) |

**Conclusión:** con la migración SQL y el cliente nuevo, la app aguanta la carga que antes la tumbaba. El cliente que está publicado hoy (14 lecturas por refresco) sigue siendo un riesgo aunque la migración lo mejora (de 47,9 % a 18,4 % de errores): **hay que desplegar el cliente nuevo**. Integridad perfecta en ambas fechas. El go-live sigue bloqueado hasta plan Pro y backups en producción.

## Qué se corrigió

| Riesgo (informe 22-oct) | Corrección | Archivo |
|---|---|---|
| `is_staff()` / `auth.uid()` evaluados **por fila** en 31 de 36 políticas RLS (`is_staff()` consulta `profiles`: miles de subconsultas por lectura) | Envueltos en `(select …)`: se evalúan una vez por consulta. Mismo significado. Expresiones tomadas de `pg_policies` de QA para no reintroducir deriva | `app/supabase/perf-rls-indices.sql` |
| 18 claves foráneas sin índice (`bookings`, `check_ins`, `waitlist_entries`, `sessions`…) | 19 índices, incluido `bookings(session_id, status)` para el conteo de cupo dentro del bloqueo de `book_session` | mismo |
| `fetchState` = 14 `select('*')` por refresco y cada acción lo repite | RPC `get_member_state()` (SECURITY INVOKER: misma RLS, mismas filas) en **una** llamada; el cliente cae al camino anterior si la función no existe | mismo + `app/src/data/supabaseRepository.ts` |
| Llamadas a Pagomedios sin timeout (auditoría SL-007) | Timeout de 20 s (`PAGOMEDIOS_TIMEOUT_MS`); el cobro con tarjeta trata el timeout como «en revisión», sin cobrar dos veces | `app/supabase/functions/pagomedios-payment/index.ts` |
| `APP_URL` caía por defecto a la URL de QA (auditoría MC-008): en prod mandaría a los socios a QA | Fuera del proyecto de QA, sin `APP_URL` la función responde 503 `APP_URL_NOT_CONFIGURED` | mismo |

Reversión de la migración: `app/supabase/perf-rls-indices-rollback.sql` (restaura las políticas exactas de QA, quita la RPC y los índices).

## Resultados (ms)

### Escenario A — 200 VUs, 12 min
| Métrica | Umbral p95 | 22-oct p50 / p95 / p99 | 23-oct p50 / p95 / p99 |
|---|---|---|---|
| login (L1) | 1.500 | 725 / 5.966 / 7.197 | 304 / **763** / 979 |
| listSessions (L2) | 1.000 | 308 / 2.894 / 5.716 | 156 / **1.051** / 11.343 |
| `book_session` (L3) | 1.500 | 320 / 2.871 / 5.729 | 156 / **822** / 10.614 |
| refresco (`fetchState`) | — | 1.755 / 6.780 / 10.422 | 172 / 474 / 2.072 |
| Error rate (5xx/timeout) | < 1 % | 0 % | 0,57 % |
| Iteraciones completadas | — | 14.786 | 17.253 (+17 %) |

### Escenario B — pico 300 VUs, ~3,5 min
| Métrica | 22-oct (14 lecturas) | 23-oct cliente nuevo (RPC) | 23-oct cliente anterior |
|---|---|---|---|
| Error rate | 47,9 % | **0 %** | 18,4 % |
| `fetchState` p50 / p95 | 20.233 / 28.783 | **260 / 955** | 1.257 / 26.242 |
| listSessions p95 | 24.029 | **728** | 21.762 |
| Iteraciones completadas | 565 | **13.395** | 1.155 |
| QA después de la corrida | inalcanzable unos minutos | normal | normal (0,5–0,9 s) |

### Integridad (`load:check --run 2026-10-23-perf-a`)
Fixture OK. I1–I8 sin violaciones. `load-popular`: capacidad 30, 30 reservas, 232 en lista de espera.

### EXPLAIN
| Consulta | 22-oct | 23-oct |
|---|---|---|
| Conteo de cupo de una sesión (dentro de `book_session`) | Seq Scan, 22,3 ms | Index Only Scan `idx_bookings_session_status`, 5,4 ms |
| `bookings` por usuario | Seq Scan | Bitmap Index Scan `idx_bookings_user_id` |

## Verificación funcional
- Suite unitaria completa en verde (89 archivos), con 4 tests nuevos del camino RPC y la caída al camino anterior (`supabaseRepository.memberState.test.ts`). 5 tests de UI fallaron por timeouts al correr en paralelo con las E2E y el seed; aislados pasan 53/53.
- E2E reales contra QA con el cliente nuevo y la migración aplicada: reservas, solapamiento, lista de espera, check-in, reagendar, clases pasadas, agenda y medidas: **7/7**.
- Para que las E2E pudieran correr se renovó la membresía de la cuenta de prueba `socio.staging@zonacero.test` en QA (Plan Silver vencido el 21-oct; ahora vence el 22-nov).

## Deuda y riesgos pendientes
1. **Desplegar el cliente nuevo** (QA y prod). Hasta entonces, la web publicada usa el camino de 14 lecturas, que con 300 usuarios simultáneos aún da 18 % de errores.
2. **Aplicar `perf-rls-indices.sql` en prod** antes o junto con el despliegue (el cliente funciona sin la RPC, pero sin RLS/índices no hay mejora).
3. **Colas de latencia**: en A el p99 llega a ~11 s y el 0,57 % de peticiones expiró a 30 s. Probable techo de la instancia Free; repetir en Pro.
4. ~~**Tamaño de `get_member_state`**~~ **Corregido el 24-oct:** a los socios solo les devuelve las sesiones de los últimos 30 días, las futuras y las de sus propias reservas (staff/admin, todas). En QA: socio 81 de 100 sesiones, 0 reservas sin su sesión; staff 100. La diferencia crece con el tiempo (~290 B por sesión programada). E2E de historial, agenda, reservas y check-in en verde (ZCAPP-58 necesita al menos una clase futura en QA).
5. **Función de pagos**: los arreglos de timeout y `APP_URL` están en el código, no desplegados. En prod hay que definir `APP_URL` antes de desplegarla.
6. **Egress**: estas corridas transfirieron ≈ 1,2 GB (≈ 1,4 GB con las del 22-oct) de los 5 GB mensuales del plan Free. No repetir B a escala completa este mes.
7. Go-live sigue bloqueado a plan Pro + backups.

## Comandos
```
psql/SQL Editor: app/supabase/perf-rls-indices.sql   (aplicado en QA el 23-oct)
npm run load:seed && npm run load:mint -- --limit 300
FETCH_MODE=rpc npm run load:a -- 2026-10-23-perf-a
npm run load:check -- --run 2026-10-23-perf-a
B_SCALE=0.6 FETCH_MODE=rpc npm run load:b -- 2026-10-23-perf-b-rpc
B_SCALE=0.6 FETCH_MODE=tables npm run load:b -- 2026-10-23-perf-b-tables
npm run load:cleanup -- --yes
```
Corridas: A 00:47–00:59, B-rpc 00:59–01:03, B-tablas 01:04–01:08 (hora de Guayaquil, 23-oct). Limpieza verificada: 1.001 usuarios, 41 sesiones, 3.711 reservas y 2.081 esperas borrados; los 22 usuarios reales intactos.
