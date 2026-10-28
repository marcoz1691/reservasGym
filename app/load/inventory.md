# Inventario de hot paths (stress QA)

Leído del código el 2026-10-22 (rama `test/stress-qa-harness`). Rutas relativas a `app/`. Escenarios k6: **A** = carrera de reservas sobre `load-popular`; **B** = burst de lectura (agenda + membresía/pagos del socio).

## Hallazgos que cambian el diseño de la carga

1. **El front no usa `listSessions` ni `getMemberMembership`/`getMemberPayments` en pantalla.** La agenda sale de `state.sessions`, que llega por `fetchState()` (`src/data/supabaseRepository.ts:464`). Esas tres funciones existen en el repositorio (`:939`, `:1339`, `:1344`) pero ninguna pantalla las llama (grep en `src/`). El escenario B las usa como proxy de lectura acotada; el costo real que vive un usuario es `fetchState` completo. B debe incluir también `fetchState` (las 14 lecturas) para ser representativo.
2. **Cada acción del socio dispara `refresh()` = `fetchState()` completo.** `store.book` (`src/app/store.ts:183-190`) hace `createBooking` y luego `refresh()` (`:92-95`: `load()` + `getCurrentUser()`). Una reserva cuesta 1 RPC + 17 requests HTTP de lectura. Lo mismo para cancelar, check-in, etc. (`store.ts:160-269`).
3. **No hay Realtime ni polling** (grep de `channel(`/`setInterval` solo da un reloj de UI). La carga es 100 % acción del usuario: no hay tráfico de fondo.
4. **`bookings(session_id)` y `bookings(user_id)` no tienen índice y se escanean dentro del bloqueo de la sesión** (ver "Gaps de índices"). Eso acota el throughput de la sesión popular.
5. **Las políticas RLS llaman `public.is_staff()` y `auth.uid()` sin envolver en `(select …)`** (`schema.sql:392-507`), así que se evalúan por fila y el `OR` impide usar índices por `user_id`. Hipótesis a confirmar con `explain.sql` (secciones 1-4).
6. **`booked_count` cuenta `confirmed + pending + attended`** (trigger `schema.sql:101-127`), no solo `confirmed`. En A (sin check-ins) coincide con #confirmed; en cuanto haya check-ins, el chequeo de integridad debe usar ese conjunto.

## Costo de peticiones por flujo (socio)

| Flujo | Peticiones HTTP | Detalle |
|---|---|---|
| Login (`signIn` + `store.signIn`) | 1 Auth + 2 `profiles` + 14 lecturas = **17** | `auth/v1/token`, `profiles?id=eq` (signIn → getCurrentUser), luego `load()` repite `getCurrentUser` (otro `profiles?id=eq`) y `fetchState` (14). `getSession()` es local, sin red salvo refresh. |
| Reserva (`store.book`) | 1 RPC + 1 `profiles` + 1 `profiles` + 14 = **17** | `refresh()` corre `load()` y `getCurrentUser()` en paralelo. |
| Check-in | 1 RPC (+ `refresh` si la UI lo llama, 16) | |
| Carga inicial con sesión (`init`) | 1 `profiles` + 1 `profiles` + 14 = **16** | |

## Hot paths

### 1. Login: `signIn` + perfil
- **Código:** `src/data/supabaseRepository.ts:597-606` (`signInWithPassword` → `getCurrentUser` `:578-595`) + `src/app/store.ts:98-107`.
- **Tablas / tipo:** `auth.users`, `auth.sessions`/`refresh_tokens` (escritura en Auth: crea sesión y refresh token); `profiles` (lectura por PK, RLS `id = auth.uid() or is_staff()`).
- **Riesgo:** el límite no es la DB sino el rate limit de Auth por IP (429) y el hash de password (bcrypt, CPU). El `profiles?id=eq` es barato. Bajo carga, el login completo arrastra `fetchState` (hot path 2).
- **Escenario:** A y B usan **tokens pregenerados** (`mint-tokens.mjs`) para no tumbar Auth; el SLO p95 login < 1500 ms se mide con una fracción pequeña de logins reales y baja tasa (ver `slo.md`).

### 2. `fetchState()` (pico post-login y post-acción)
- **Código:** `src/data/supabaseRepository.ts:464-535`; filtrado cliente posterior en `src/data/scopeGymState.ts` (defensa en profundidad).
- **Tipo:** 14 `select('*')` en paralelo, **ninguno con filtro, orden ni límite** salvo `gym_settings.eq('id',1)`. El filtrado real lo hace RLS en servidor.

| # | Tabla | Filtro | Policy SELECT (schema.sql) | Socio recibe | Staff recibe |
|---|---|---|---|---|---|
| 1 | `gym_settings` | `id = 1` | `:404` `true` (authenticated) | 1 fila | 1 fila |
| 2 | `profiles` | ninguno | `:392` `id = auth.uid() or is_staff()` | solo la propia | **todos los perfiles** |
| 3 | `trainers` | ninguno | `:416` `true` | todos | todos |
| 4 | `zones` | ninguno | `:410` `true` | todas | todas |
| 5 | `class_templates` | ninguno | `:412` `true` | todas | todas |
| 6 | `sessions` | ninguno | `:414` `true` | **todas, sin acotar por fecha** (crece sin límite) | todas |
| 7 | `bookings` | ninguno | `:421` `user_id = auth.uid() or is_staff()` | solo las suyas | **todas** |
| 8 | `waitlist_entries` | ninguno | `:430` `user_id = auth.uid() or is_staff()` | las suyas | todas |
| 9 | `check_ins` | ninguno | `:437` `user_id = auth.uid() or is_staff()` | los suyos | todos |
| 10 | `body_measurements` | ninguno | `:444` propia o staff | las suyas | todas |
| 11 | `body_goals` | ninguno | `:458` propia o staff | las suyas | todas |
| 12 | `membership_plans` | ninguno | `:472` `active or is_staff() or exists(memberships del socio)` (subconsulta correlacionada) | activos + los que tiene | todos |
| 13 | `memberships` | ninguno | `:485` `user_id = auth.uid() or is_staff()` | las suyas | **todas** |
| 14 | `payments` | ninguno | `:493` `user_id = auth.uid() or is_staff()` | los suyos | **todos** |

- **Riesgo (alto):**
  - Socio: payload pequeño, pero las tablas 2, 7-11, 13-14 se evalúan con `OR is_staff()` por fila → escaneo completo con función por fila (hipótesis; confirmar con EXPLAIN). Costo crece con el total de filas de la tabla, no con las del socio.
  - Staff: devuelve **todo** (1000+ perfiles, todas las reservas, todos los pagos). Egress y tiempo crecen linealmente con los datos. Con 1000 usuarios de carga, el staff de carga (`load.staff`) es el peor caso de egress.
  - 14 consultas simultáneas por cliente = hasta 14 conexiones de pool de PostgREST por usuario → con 300-500 VUs el pool se satura antes que la CPU.
  - `sessions` y `check_ins` crecen indefinidamente en producción; no hay ventana de fechas.
- **Escenario:** B (proxy acotado + variante `fetchState` completo). A lo ejecuta una vez por VU tras la reserva para reproducir el `refresh()`.

### 3. Agenda: `listSessions`
- **Código:** `src/data/supabaseRepository.ts:939-946`: `sessions?select=*&starts_at=gte.X&starts_at=lte.Y&order=starts_at`.
- **Tablas / tipo:** `sessions`, lectura con rango + `order by starts_at`. Policy `using (true)`: sin costo RLS.
- **Riesgo:** sin índice en `starts_at` es seq scan + sort. Con ~40 filas es irrelevante; sube con meses de historia. **No es el camino real de la UI** (hallazgo 1).
- **Escenario:** B (principal), A (paso 2 del flujo).

### 4. Reserva: `book_session`
- **Código:** cliente `src/data/supabaseRepository.ts:990-1003`; función `supabase/booking-rpc.sql:268-344`. `SECURITY DEFINER`, `EXECUTE` solo `authenticated` (`:535-536`).
- **Orden de bloqueos:** (1) `sessions` por PK `for update` (`:291`); (2) `profiles` del socio `for update` (`:295`). Mismo orden en `cancel_booking`, `reschedule_booking` y `promote_waitlist`; sin riesgo de deadlock entre ellas. El trigger `sync_session_booked_count` actualiza la fila `sessions` ya bloqueada por la misma transacción.
- **Valida, en este orden:**
  1. `auth.uid()` no nulo (`No autenticado`); `p_user_id` ≠ actor solo si staff (`No puedes reservar por otro socio`).
  2. Sesión existe (`Sesión no encontrada`).
  3. `starts_at > now()` salvo staff (`Esa clase ya empezó`).
  4. Duplicado: `exists(bookings session+user, status in confirmed/pending/waitlisted)` (`Ya tienes reserva en esta sesión`). **No hay UNIQUE en BD**: solo lo protege el bloqueo de la sesión.
  5. Solapamiento: `booking_overlaps` (join `bookings`↔`sessions` por `user_id`; `Se solapa con otra reserva activa`).
  6. Membresía/zona: `member_booking_block_reason` (pases del día, `current_membership_id`, `visits_left`, `allowed_zone_ids`). Textos: `No cuenta con una membresía activa.`, `La membresía ha sido cancelada.`, `Membresía vencida. Por favor renueva tu plan.`, `No quedan visitas…`, `Tu plan (X) no incluye acceso a esta zona.` Staff/admin no pasan por aquí. Un socio en **gracia** (hasta `ends_at + 3 días` o `grace_ends_at`) **sí puede reservar**; uno vencido hace 10 días recibe `Membresía vencida`.
  7. Cupo: `session_seats_taken < capacity` (`confirmed/pending/attended`).
- **Devuelve:** `{"booking": fila}` (confirmado) o `{"waitlist": fila}` (lleno; inserta `waitlist_entries` con `position = max+1` y una fila `bookings` en `waitlisted`). Si el interruptor `waitlist_enabled` está apagado, lleno = excepción `La clase está llena`.
- **Clasificación para k6 (PostgREST responde HTTP 200 con el JSON, o HTTP 400 con `{code:"P0001", message}` para `raise exception`):**

| Resultado | HTTP | Cómo detectarlo |
|---|---|---|
| ok (`booking_ok`) | 200 | cuerpo con clave `booking` |
| lleno → lista de espera (`booking_full`) | 200 | cuerpo con clave `waitlist` (o 400 `La clase está llena`) |
| denegado por membresía (`booking_denied_membership`) | 400 | `message` ∈ {`Membresía vencida…`, `No cuenta con una membresía…`, `…no incluye acceso a esta zona.`, `La membresía ha sido cancelada.`, `No quedan visitas…`} |
| duplicado | 400 | `Ya tienes reserva en esta sesión` |
| solapamiento / ya empezó | 400 | `Se solapa…` / `Esa clase ya empezó` |
| error real | 5xx, timeout, 429 | cuenta contra el error rate (429 se reporta aparte, ver `slo.md`) |

  Un 400 de negocio **no es error del sistema**.
- **Tablas / tipo:** lectura `sessions`, `profiles`, `bookings`, `memberships`, `membership_plans`, `waitlist_entries`, `gym_settings`; escritura `bookings` (+ trigger → `sessions.booked_count`), `waitlist_entries`.
- **Riesgo (alto, serialización por diseño):** todas las reservas de la sesión popular se encolan tras `for update`. Dentro del bloqueo hay ≥ 4 consultas sobre `bookings` sin índice (duplicado por `session_id`+`user_id`, `booking_overlaps` por `user_id`, `session_seats_taken` por `session_id`, y el `count(*)` del trigger por `session_id`) más el `max(position)` de `waitlist_entries`. Cada una es seq scan hoy; el tiempo bajo bloqueo crece con el total de `bookings`, y el throughput de la sesión = 1 / (tiempo bajo bloqueo). Con 200 VUs sobre una sola sesión, el p95 de `book_session` es principalmente **espera de bloqueo**.
- **Escenario:** A (núcleo).

### 5. Check-in: `check_in_booking`
- **Código:** cliente `src/data/supabaseRepository.ts:1029-1038`; función `supabase/booking-rpc.sql:474-522`.
- **Bloqueos:** lee `bookings` por PK, luego `sessions … for update` (`:499`) y `bookings … for update` (`:500`). Orden sesión → reserva; coherente con `book_session` (sesión primero).
- **Valida:** código QR igual (mayúsculas, trim), estado `confirmed/pending`, ventana `[starts_at - check_in_window_minutes, starts_at + 10 min]`. Inserta `check_ins`, pasa la reserva a `attended`; el trigger recalcula `booked_count` (sin cambio neto).
- **Devuelve:** fila `check_ins` (jsonb).
- **Riesgo:** medio. Un check-in toma el bloqueo de la sesión: en una hora pico de recepción compite con reservas de la misma clase. La ventana solo permite check-in cerca del inicio, así que el escenario necesita sesiones con `starts_at` ≈ ahora (fase 2, escenario C).
- **Escenario:** ninguno en el MVP (C, fase 2).

### 6. Cobros: `apply_plan_purchase`
- **Código:** cliente `registerManualPayment` `src/data/supabaseRepository.ts:1432-1500`; función `supabase/plan-rules.sql:130-236`. Solo staff (o `auth.uid()` nulo = service role / webhook).
- **Bloqueos:** `profiles` del socio `for update` (`:157`) y todas sus `memberships` `for update` (`:161`). Serializa compras del mismo socio; no compite con reservas ajenas, pero **sí con `book_session` del mismo socio** (ambos toman `profiles for update`).
- **Tablas:** lectura `membership_plans`, `memberships` (vía `current_membership_id`, `queued_membership_id`); escritura `memberships` (insert/update). Luego el cliente lee `payments` pendientes y hace `insert`/`update` en `payments` (no atómico con la RPC).
- **Riesgo:** bajo en volumen (recepción, pocos/min). `payments(user_id)` y `memberships(user_id)` sí tienen índice.
- **Escenario:** ninguno en MVP (D, fase 2).

### 7. Edge Function `pagomedios-payment` (solo mención, fase 2)
- **Código:** `supabase/functions/pagomedios-payment/index.ts` (`Deno.serve` `:94`; acciones `create` `:151` y `verify` `:154`). Depende de la API externa de Pagomedios (sandbox): no se carga desde k6 en el MVP (escenario D con mock de webhook). Ver límite de invocaciones de Edge Functions en "Riesgos del plan Free".

## Gaps de índices

Búsqueda de `create [unique] index`, `unique` y `primary key` en **todos** los `.sql` de `supabase/` (schema, booking-rpc, plan-rules, security-hardening, feature-flags, legal-consents, qa-mail-hook, recurring-payments, pagomedios-provider, terms-*, etc.).

**Índices que existen** (además de los PK, que son implícitos):

| Índice | Archivo:línea |
|---|---|
| `idx_memberships_user_id (memberships.user_id)` | `schema.sql:222` |
| `idx_memberships_user_dates (user_id, starts_at, ends_at)` | `schema.sql:223`, `plan-rules.sql:56` |
| `idx_memberships_status (status)` | `schema.sql:224` |
| `idx_payments_user_id (payments.user_id)` | `schema.sql:225` |
| `idx_payments_status (payments.status)` | `schema.sql:226` |
| `idx_legal_consents_user (user_id, accepted_at desc)` | `legal-consents.sql:19` |
| `idx_qa_mail_sent_created_at` | `qa-mail-hook.sql:37` |

(`idx_payments_mp_payment_id` se elimina en `quitar-mercadopago-datafast.sql:16`.) No hay ningún `UNIQUE` adicional a los PK. PostgreSQL **no** indexa automáticamente las columnas FK.

**Índices que faltan y por qué importan:**

| Falta | Quién lo usa | Impacto |
|---|---|---|
| `bookings(session_id)` (idealmente `(session_id, status)`) | `session_seats_taken` (`booking-rpc.sql:36`), duplicado en `book_session` (`:300`), `count(*)` del trigger (`schema.sql:112`), `promote_waitlist`, `ON DELETE CASCADE` de `sessions` | seq scan **bajo el bloqueo de la sesión**: crítico |
| `bookings(user_id)` (idealmente `(user_id, status)`) | `booking_overlaps` (`:203`), RLS de socio, `listBookingsForUser` (`:976`), cascade de `profiles` (cleanup de 1000 usuarios) | seq scan por reserva y por `fetchState` |
| `sessions(starts_at)` | `listSessions` (`:939`), `booking_overlaps` (rango) | bajo con pocas filas; crece con historial |
| `waitlist_entries(session_id, position)` | `max(position)` en `book_session` (`:334`), `promote_waitlist` (`:227`), cascade | seq scan bajo el bloqueo |
| `waitlist_entries(user_id)` | RLS de socio, cascade de `profiles` | medio |
| `check_ins(user_id)` | RLS de socio en `fetchState`, cascade de `profiles` | medio |
| `check_ins(booking_id)` / `check_ins(session_id)` | cascade de `bookings`/`sessions` | bajo (solo borrados) |
| `body_measurements(user_id)`, `body_goals(user_id)` | RLS de socio, cascade | bajo-medio |
| `memberships(plan_id)` | subconsulta de la policy de `membership_plans` (`schema.sql:476`), `plan_id` FK | bajo |

**Candidatos** (para el informe tras el EXPLAIN; **no se aplican en este harness**):

```sql
create index concurrently if not exists idx_bookings_session_status on public.bookings (session_id, status);
create index concurrently if not exists idx_bookings_user_status    on public.bookings (user_id, status);
create index concurrently if not exists idx_sessions_starts_at      on public.sessions (starts_at);
create index concurrently if not exists idx_waitlist_session_pos    on public.waitlist_entries (session_id, position);
create index concurrently if not exists idx_waitlist_user           on public.waitlist_entries (user_id);
create index concurrently if not exists idx_check_ins_user          on public.check_ins (user_id);
```

Otros candidatos de código (no índices): envolver `auth.uid()`/`is_staff()` como `(select …)` en las policies; acotar `fetchState` por rol y ventana de fechas; que `store.book` actualice solo reservas/sesión en lugar de `refresh()` completo.

## Riesgos del plan Free

Valores de referencia al 2026-10; **verificar en el dashboard de QA antes de la corrida** (Auth → Rate Limits; Settings → Usage/Compute).

- **Auth (el techo más probable):** límites por IP en `auth/v1/token` (login y refresh) del orden de decenas por 5 minutos y por IP, más hash de password en CPU. 1000 logins desde una sola IP darán 429 en masa. Mitigación del diseño: pool de tokens (`mint-tokens.mjs`, concurrencia baja, backoff, reanudable); los JWT duran ~1 h, así que **mintear justo antes de la corrida**. Si los tokens caducan a mitad, los 401 no son fallos del sistema: regenerar. Emails de Auth con SMTP integrado: pocos por hora (no se usan en la carga; no crear usuarios con confirmación por correo).
- **Egress 5 GB/mes:** un `fetchState` de socio con pocos datos pesa del orden de decenas de KB (dominado por `sessions`, `membership_plans`, `class_templates`); el de staff crece con los datos (1000 perfiles + todas las reservas/pagos: cientos de KB a MB). Estimación a medir en la primera corrida: egress = peticiones × bytes medios. 500 VUs × 5 min con `fetchState` completo puede consumir cientos de MB. Runs cortos, `select` con columnas en k6, y **no** usar `load.staff` en bucle.
- **Cómputo compartido (Nano/Micro, ~1 GB RAM, CPU compartida):** la latencia que mida k6 puede ser techo de infraestructura, no de código. Anotar el tamaño de compute en el informe. Sin burst sostenido garantizado.
- **Conexiones:** conexión directa a Postgres limitada (~decenas) y pool de PostgREST pequeño; `fetchState` abre 14 consultas paralelas por cliente, así que pocos clientes simultáneos ya saturan el pool → latencia por cola y 5xx/timeouts. Distinguir en el informe "cola de pool" de "consulta lenta" con `explain.sql`.
- **Bloqueo de fila `sessions`:** en A el p95 de `book_session` mide espera de bloqueo, que el plan Free amplifica por CPU lenta.
- **Sin backups ni PITR en Free; proyecto se pausa tras inactividad.** QA es descartable, pero producción no (ver `slo.md`).
- **Edge Functions:** cuota mensual de invocaciones y límite de CPU/tiempo por invocación; relevante en fase 2 (D).
- **Contaminación de datos:** solo prefijo `load.*` / ids `load-*`; limpieza obligatoria con `load:cleanup` (borra `payments` explícitamente: FK `ON DELETE SET NULL`, `anonimizar-pagos-al-eliminar.sql`). El borrado en cascada de `bookings` por usuario es seq scan sin `bookings(user_id)`: el cleanup de 1000 usuarios puede ser lento; es esperable.
