-- explain.sql: consultas SOLO LECTURA para EXPLAIN (ANALYZE, BUFFERS) en QA.
-- Proyecto QA: kqhmclbexnnsbzbgerbx. NUNCA correr en produccion.
--
-- Uso: pegar por bloques en el SQL Editor de Supabase (QA) DESPUES del seed y
-- idealmente despues de una corrida del escenario A (tablas con datos reales).
-- Con tablas chicas el planner elige Seq Scan aunque haya indice; lo que importa
-- es Buffers, "Rows Removed by Filter" y como crece con el numero de filas.
--
-- Las secciones 1-5 simulan a un socio: dentro de una transaccion se fija el
-- JWT (sub = uuid del socio) y se cambia al rol `authenticated`, para que RLS
-- (auth.uid(), is_staff()) se evalue igual que en PostgREST. Se cierra con
-- ROLLBACK. EXPLAIN ANALYZE ejecuta la consulta (solo SELECT, sin efectos).
-- Para ver como staff, cambiar el email a load.staff@zonacero.test.
--
-- No se hace EXPLAIN ANALYZE de book_session ni de ninguna funcion que escriba.

-- ============================================================================
-- 1. fetchState como socio: las 14 lecturas de supabaseRepository.ts:464-535
--    (una transaccion por consulta no hace falta; se repite el preambulo en
--    cada bloque para poder correrlos por separado)
-- ============================================================================

-- 1.1 profiles (RLS: id = auth.uid() or is_staff())
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers) select * from public.profiles;
rollback;

-- 1.2 bookings (RLS: user_id = auth.uid() or is_staff()); hipotesis: seq scan
--     con is_staff() por fila, sin usar indice de user_id
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers) select * from public.bookings;
rollback;

-- 1.3 sessions (RLS: true; sin filtro de fecha, crece sin limite)
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers) select * from public.sessions;
rollback;

-- 1.4 waitlist_entries (RLS propia o staff)
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers) select * from public.waitlist_entries;
rollback;

-- 1.5 check_ins (RLS propia o staff)
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers) select * from public.check_ins;
rollback;

-- 1.6 body_measurements y body_goals (RLS propia o staff)
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers) select * from public.body_measurements;
explain (analyze, buffers) select * from public.body_goals;
rollback;

-- 1.7 membership_plans (RLS: active or is_staff() or exists(memberships del socio):
--     subconsulta correlacionada por plan)
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers) select * from public.membership_plans;
rollback;

-- 1.8 memberships y payments (RLS: user_id = auth.uid() or is_staff())
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers) select * from public.memberships;
explain (analyze, buffers) select * from public.payments;
rollback;

-- 1.9 tablas de catalogo (RLS: true): gym_settings, trainers, zones, class_templates
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers) select * from public.gym_settings where id = 1;
explain (analyze, buffers) select * from public.trainers;
explain (analyze, buffers) select * from public.zones;
explain (analyze, buffers) select * from public.class_templates;
rollback;

-- ============================================================================
-- 2. Agenda: sessions por rango de starts_at (listSessions, repositorio :939)
--    Sin indice en starts_at se espera Seq Scan + Sort.
-- ============================================================================
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers)
select * from public.sessions
where starts_at >= now() - interval '1 day'
  and starts_at <= now() + interval '7 days'
order by starts_at;
rollback;

-- ============================================================================
-- 3. bookings por session_id (conteo de cupo, duplicado, trigger, promote_waitlist)
--    Se corre como el dueno (sin RLS) para aislar el costo del acceso por columna.
-- ============================================================================
explain (analyze, buffers)
select * from public.bookings where session_id = 'load-popular';

-- 3.1 igual, como socio (RLS agrega is_staff() por fila)
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers)
select * from public.bookings where session_id = 'load-popular';
rollback;

-- ============================================================================
-- 4. bookings por user_id (listBookingsForUser :976, booking_overlaps, cascade de profiles)
-- ============================================================================
-- 4.1 como dueno
explain (analyze, buffers)
select * from public.bookings
where user_id = (select id from auth.users where email = 'load.0001@zonacero.test');

-- 4.2 como el propio socio (camino real del cliente)
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'load.0001@zonacero.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers)
select * from public.bookings
where user_id = auth.uid();
rollback;

-- 4.3 booking_overlaps (booking-rpc.sql:191-208) inlineada para una sesion y un socio
explain (analyze, buffers)
select exists (
  select 1
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  join public.sessions c on c.id = 'load-popular'
  where b.user_id = (select id from auth.users where email = 'load.0001@zonacero.test')
    and b.status in ('confirmed', 'pending')
    and s.starts_at < c.ends_at
    and s.ends_at > c.starts_at
);

-- ============================================================================
-- 5. memberships por usuario (member_booking_block_reason / current_membership_id)
-- ============================================================================
-- 5.1 lectura directa por user_id (indices idx_memberships_user_id / user_dates)
explain (analyze, buffers)
select * from public.memberships
where user_id = (select id from auth.users where email = 'load.0001@zonacero.test');

-- 5.2 current_membership_id (booking-rpc.sql:47-64) inlineada; incluye el join a membership_plans
explain (analyze, buffers)
select m.id
from public.memberships m
join public.membership_plans p on p.id = m.plan_id
where m.user_id = (select id from auth.users where email = 'load.0001@zonacero.test')
  and m.status <> 'cancelled'
  and p.kind <> 'day_pass'
  and m.starts_at <= now()
  and now() <= coalesce(m.grace_ends_at, m.ends_at + interval '3 days')
order by m.ends_at desc
limit 1;

-- 5.3 memberships del socio con su plan embebido (membershipsWithPlans, repositorio :1323)
explain (analyze, buffers)
select m.*, p.*
from public.memberships m
left join public.membership_plans p on p.id = m.plan_id
where m.user_id = (select id from auth.users where email = 'load.0001@zonacero.test')
order by m.ends_at desc;

-- ============================================================================
-- 6. Conteo de confirmados por sesion (session_seats_taken, booking-rpc.sql:29-38,
--    y count(*) del trigger sync_session_booked_count, schema.sql:101-121).
--    Corre bajo el bloqueo `for update` de la sesion en book_session.
-- ============================================================================
-- 6.1 una sesion (la popular)
explain (analyze, buffers)
select count(*)::int from public.bookings
where session_id = 'load-popular'
  and status in ('confirmed', 'pending', 'attended');

-- 6.2 todas las sesiones de carga (base del chequeo de integridad I2/I3)
explain (analyze, buffers)
select s.id, s.capacity, s.booked_count,
       count(b.id) filter (where b.status in ('confirmed', 'pending', 'attended')) as ocupantes
from public.sessions s
left join public.bookings b on b.session_id = s.id
where s.id like 'load-%'
group by s.id, s.capacity, s.booked_count;

-- 6.3 posicion siguiente de la lista de espera (book_session :334)
explain (analyze, buffers)
select coalesce(max(position), 0) + 1 from public.waitlist_entries
where session_id = 'load-popular';

-- ============================================================================
-- 7. Referencia: indices realmente existentes y tamano de tablas
-- ============================================================================
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('bookings', 'sessions', 'waitlist_entries', 'check_ins',
                    'memberships', 'payments', 'profiles')
order by tablename, indexname;

select relname, n_live_tup
from pg_stat_user_tables
where schemaname = 'public'
  and relname in ('bookings', 'sessions', 'waitlist_entries', 'check_ins',
                  'memberships', 'payments', 'profiles')
order by relname;
