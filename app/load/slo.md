# SLO y gate de lanzamiento (stress QA)

Aplica a las corridas de `load:a` y `load:b` contra QA (`kqhmclbexnnsbzbgerbx`, plan Free). Nunca producción. En Free el techo puede ser infraestructura (CPU compartida, rate limit de Auth, pool de conexiones) y no código; el informe debe decir cuál es.

## 1. Umbrales

| # | SLO | Umbral | Escenario | Cómo se mide |
|---|---|---|---|---|
| L1 | Latencia login | p95 < 1500 ms | A, B (muestra baja de logins reales) | Trend k6 de `POST /auth/v1/token?grant_type=password` (solo respuestas 200). Los VUs con token pregenerado no cuentan. |
| L2 | Latencia `listSessions` | p95 < 1000 ms | B (y paso 2 de A) | Trend k6 de `GET /rest/v1/sessions?starts_at=gte…&order=starts_at`. |
| L3 | Latencia `book_session` | p95 < 1500 ms | A | Trend k6 de `POST /rest/v1/rpc/book_session`, todas las respuestas 200 y 400 de negocio (miden el mismo camino bloqueante). |
| E1 | Error rate | < 1 % | A, B | `(5xx + timeouts + errores de red) / peticiones`. Ver clasificación en §2. |
| I1 | Cupos negativos | 0 | A | `load:check`: `sessions.booked_count < 0` o `capacity < 0` en sesiones `load-*`. |
| I2 | Sobrecupo | 0 sesiones con `#ocupantes > capacity` | A | `load:check`: por sesión, `count(bookings.status in confirmed/pending/attended) > capacity`. |
| I3 | Coherencia de contador | 0 sesiones con `booked_count ≠ #ocupantes` | A | `load:check`: `booked_count` vs `count(status in confirmed/pending/attended)`. |
| I4 | Reservas duplicadas activas | 0 | A | `load:check`: `group by session_id, user_id having count(*) > 1` con status en `confirmed/pending/waitlisted`. No hay UNIQUE en BD: solo lo evita el bloqueo (`booking-rpc.sql:291`). |

Notas de definición:

- **I3 usa el conjunto `confirmed + pending + attended`**, que es lo que cuenta el trigger (`schema.sql:101-127`). El contrato dice "`booked_count` = #confirmed": en A (sin check-ins) coinciden; el chequeo debe usar el conjunto completo para evitar falsos positivos cuando haya `attended`.
- **Controles adicionales (también entran al gate como integridad):**
  - I5 Elegibilidad: ningún usuario de carga en estado `expired` tiene reserva `confirmed` en `load-popular` (cruza `tokens.json`). Prueba que la membresía se valida bajo carga.
  - I6 Esperas: en cada sesión `load-*`, las `position` de `waitlist_entries` son únicas y contiguas (1..n) y cada espera tiene su reserva `waitlisted`.
  - I7 Conservación de la carrera: `booking_ok` de `load-popular` = `min(popular_capacity, socios elegibles que intentaron)`. Un `booking_ok` mayor que la capacidad es I2 fallado.
- Los nombres de métricas (`login_duration`, `list_sessions_duration`, `book_session_duration`, `booking_ok`, `booking_full`, `booking_denied_membership`, `errors`) son orientativos; el informe debe mapearlos a los nombres reales de `k6/scenario-*.js`. Los thresholds de k6 deben ser exactamente L1-L3 y E1.

## 2. Clasificación de respuestas (qué cuenta como error)

| Respuesta | Cuenta en E1? | Notas |
|---|---|---|
| 200 con `booking` | No | `booking_ok` |
| 200 con `waitlist` | No | `booking_full` (sesión llena manda a lista de espera; no es fallo) |
| 400 `P0001` con mensaje de negocio (membresía vencida/sin membresía/zona, duplicado, solape, ya empezó, `La clase está llena` si la espera está apagada) | No | `booking_denied_membership` u otra métrica de negocio. Un 400 con mensaje fuera de esta lista sí cuenta como error. |
| 5xx, timeout, error de red/reset | **Sí** | |
| 429 | **No; se reporta aparte** (`rate_limited`) | Techo de Auth/PostgREST en Free, no código. Si 429 > 5 % de las peticiones de un escenario, el SLO afectado queda no concluyente (§3). |
| 401 por JWT caducado | No; invalida la corrida | Regenerar tokens (`load:mint`) y repetir. |

## 3. Gate

Evaluar en este orden; vale la primera regla que se cumpla.

**NO LANZAR**: cualquiera de
- un fallo de integridad (I1-I7 con ≥ 1 violación);
- error rate E1 ≥ 1 %;
- cualquier p95 de L1-L3 > 1,5 × su umbral (L1 > 2250 ms, L2 > 1500 ms, L3 > 2250 ms);
- el escenario no terminó por causa del sistema (abortado, caída o pausa del proyecto Supabase).

**APROBADO CON DEUDA**: sin fallos de integridad, E1 < 1 % y al menos un p95 de L1-L3 supera su umbral pero ≤ 1,5 ×. Cada exceso se registra como deuda con causa probable (EXPLAIN, bloqueo, Auth, infra) y remediación priorizada.

**APROBADO**: L1, L2 y L3 cumplidos, E1 < 1 % y 0 violaciones de integridad (I1-I7).

Validez de la corrida (si falla alguna, el veredicto es "no concluyente": se repite, no se aprueba ni se rechaza):
- Se ejecutó `load:check --run <run>` después de esa misma corrida y devolvió código de salida explícito.
- ≥ 90 % de los VUs partió con token válido; 429 ≤ 5 % del escenario para el SLO evaluado.
- Seed completo (`user_count` ≥ 1000 en `load-meta.json`) con las 3 clases de membresía presentes.
- Se registra: commit, comando exacto, tamaño de compute de QA y filas de `bookings`/`sessions` al empezar.

El veredicto final es el peor entre A y B.

## 4. Go-live

**El go-live a producción sigue bloqueado hasta tener plan Pro y backups activos en `gvgqlmoulgcickxognto`, aunque QA Free resulte APROBADO.** Free no tiene backups ni garantías de cómputo: un APROBADO en Free no demuestra capacidad en Pro, y un NO LANZAR puede deberse a infraestructura Free. Producción no se toca en este harness.

El veredicto es una entrada para esa decisión, no la sustituye. El informe de la primera corrida debe incluir los EXPLAIN de `explain.sql`, el diagnóstico "código vs. infra" y las remediaciones (índices en `bookings`, acotar `fetchState`, envolver `auth.uid()`/`is_staff()` en `(select …)`).
