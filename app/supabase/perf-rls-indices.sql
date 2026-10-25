-- Rendimiento bajo carga (informe de stress en QA del 22-oct-2026, docs/tecnico/informe-stress-qa-2026-10-22.md).
-- Ejecutar en el SQL Editor de QA y luego de prod. Idempotente. Reversión: perf-rls-indices-rollback.sql.
--
-- 1) Índices en todas las claves foráneas que no tenían (bookings, check_ins, waitlist_entries, sessions…).
--    Sin ellos, la RLS por usuario, el conteo de cupo dentro del bloqueo de book_session y los borrados
--    en cascada hacen seq scan.
-- 2) Políticas RLS: `auth.uid()`, `is_staff()` e `is_admin()` se envuelven en `(select …)` para que Postgres
--    las evalúe UNA vez por consulta (initPlan) y no una vez por fila. `is_staff()` es SECURITY DEFINER y
--    consulta profiles: sin envolver, leer `bookings` como socio la ejecutaba por cada fila ajena.
--    Las expresiones salen de pg_policies de QA (no de los .sql del repo) para no reintroducir deriva.
--    Mismo significado: solo cambia cuántas veces se evalúa la función.
-- 3) get_member_state(): las 14 lecturas de fetchState() en UNA llamada. SECURITY INVOKER: aplica la misma
--    RLS que las lecturas sueltas. Única diferencia: a los socios les devuelve solo las sesiones de los
--    últimos 30 días, las futuras y las de sus reservas (staff/admin reciben todas), para que la respuesta
--    no crezca sin límite. El cliente cae al camino anterior si la función no existe (PGRST202), así que
--    puede desplegarse antes o después de este SQL.
begin;
set local search_path = public;

-- 1) Índices ------------------------------------------------------------------------------------------
create index if not exists idx_bookings_user_id              on public.bookings (user_id);
create index if not exists idx_bookings_session_status       on public.bookings (session_id, status);
create index if not exists idx_check_ins_user_id             on public.check_ins (user_id);
create index if not exists idx_check_ins_booking_id          on public.check_ins (booking_id);
create index if not exists idx_check_ins_session_id          on public.check_ins (session_id);
create index if not exists idx_waitlist_session_position     on public.waitlist_entries (session_id, position);
create index if not exists idx_waitlist_user_id              on public.waitlist_entries (user_id);
create index if not exists idx_body_measurements_user_id     on public.body_measurements (user_id);
create index if not exists idx_body_measurements_recorded_by on public.body_measurements (recorded_by);
create index if not exists idx_body_goals_user_id            on public.body_goals (user_id);
create index if not exists idx_sessions_starts_at            on public.sessions (starts_at);
create index if not exists idx_sessions_template_id          on public.sessions (template_id);
create index if not exists idx_sessions_zone_id              on public.sessions (zone_id);
create index if not exists idx_sessions_trainer_id           on public.sessions (trainer_id);
create index if not exists idx_class_templates_zone_id       on public.class_templates (zone_id);
create index if not exists idx_class_templates_trainer_id    on public.class_templates (trainer_id);
create index if not exists idx_memberships_plan_id           on public.memberships (plan_id);
create index if not exists idx_payments_membership_id        on public.payments (membership_id);
create index if not exists idx_payments_plan_id              on public.payments (plan_id);

-- 2) Políticas RLS: funciones evaluadas una vez por consulta ------------------------------------------
alter policy "body_goals delete" on public.body_goals
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "body_goals insert" on public.body_goals
  with check (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "body_goals own or staff" on public.body_goals
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "body_goals update" on public.body_goals
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "weight delete" on public.body_measurements
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "weight insert" on public.body_measurements
  with check (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "weight own or staff" on public.body_measurements
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "weight update" on public.body_measurements
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "bookings insert staff" on public.bookings
  with check ((select is_staff()));

alter policy "bookings own or staff" on public.bookings
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "bookings update staff" on public.bookings
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy "checkins own or staff" on public.check_ins
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "checkins write staff" on public.check_ins
  with check ((select is_staff()));

alter policy "templates write" on public.class_templates
  using ((select is_staff()));

alter policy "settings write admin" on public.gym_settings
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy "legal consents read own or staff" on public.legal_consents
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "membership_plans read active or staff" on public.membership_plans
  using (((active = true) OR (select is_staff()) OR (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.plan_id = membership_plans.id) AND (m.user_id = (select auth.uid())))))));

alter policy "membership_plans write admin" on public.membership_plans
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy "memberships select own or staff" on public.memberships
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "memberships write staff" on public.memberships
  using ((select is_staff()));

alter policy "payments insert own plan request" on public.payments
  with check (((user_id = (select auth.uid())) AND (status = 'pending'::text) AND (provider = 'manual'::text) AND (membership_id IS NULL) AND plan_sellable_in_app(plan_id) AND (plan_purchase_block_reason(user_id, plan_id) IS NULL) AND (manual_method IS DISTINCT FROM 'pagomedios_recurring'::text)));

alter policy "payments select own or staff" on public.payments
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "payments update own plan request" on public.payments
  using (((user_id = (select auth.uid())) AND (status = 'pending'::text) AND (provider = 'manual'::text)))
  with check (((user_id = (select auth.uid())) AND (status = 'pending'::text) AND (provider = 'manual'::text) AND (membership_id IS NULL) AND plan_sellable_in_app(plan_id) AND (plan_purchase_block_reason(user_id, plan_id) IS NULL) AND (manual_method IS DISTINCT FROM 'pagomedios_recurring'::text)));

alter policy "payments write staff" on public.payments
  using ((select is_staff()));

alter policy "profiles read self or staff" on public.profiles
  using (((id = (select auth.uid())) OR (select is_staff())));

alter policy "profiles update self or staff" on public.profiles
  using (((id = (select auth.uid())) OR (select is_staff())))
  with check ((((id = (select auth.uid())) AND (role = ( SELECT p.role
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))) OR (select is_staff())));

alter policy "sessions write" on public.sessions
  using ((select is_staff()));

alter policy "trainers write" on public.trainers
  using ((select is_staff()));

alter policy "waitlist own or staff" on public.waitlist_entries
  using (((user_id = (select auth.uid())) OR (select is_staff())));

alter policy "waitlist write staff" on public.waitlist_entries
  using ((select is_staff()))
  with check ((select is_staff()));

alter policy "catalog write" on public.zones
  using ((select is_staff()));

-- 3) Estado del socio en una sola llamada ---------------------------------------------------------------
create or replace function public.get_member_state()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'gym_settings',      (select to_jsonb(s) from gym_settings s where s.id = 1),
    'profiles',          coalesce((select jsonb_agg(to_jsonb(t)) from profiles t), '[]'::jsonb),
    'trainers',          coalesce((select jsonb_agg(to_jsonb(t)) from trainers t), '[]'::jsonb),
    'zones',             coalesce((select jsonb_agg(to_jsonb(t)) from zones t), '[]'::jsonb),
    'class_templates',   coalesce((select jsonb_agg(to_jsonb(t)) from class_templates t), '[]'::jsonb),
    -- Socios: sesiones de los últimos 30 días, las futuras y las de sus propias reservas (historial;
    -- la RLS de bookings solo deja ver las suyas). Staff/admin: todas. Sin esto la respuesta crece
    -- con cada clase programada (~290 B por sesión).
    'sessions',          coalesce((select jsonb_agg(to_jsonb(t)) from sessions t
                           where (select is_staff())
                              or t.starts_at >= now() - interval '30 days'
                              or exists (select 1 from bookings b where b.session_id = t.id)), '[]'::jsonb),
    'bookings',          coalesce((select jsonb_agg(to_jsonb(t)) from bookings t), '[]'::jsonb),
    'waitlist_entries',  coalesce((select jsonb_agg(to_jsonb(t)) from waitlist_entries t), '[]'::jsonb),
    'check_ins',         coalesce((select jsonb_agg(to_jsonb(t)) from check_ins t), '[]'::jsonb),
    'body_measurements', coalesce((select jsonb_agg(to_jsonb(t)) from body_measurements t), '[]'::jsonb),
    'body_goals',        coalesce((select jsonb_agg(to_jsonb(t)) from body_goals t), '[]'::jsonb),
    'membership_plans',  coalesce((select jsonb_agg(to_jsonb(t)) from membership_plans t), '[]'::jsonb),
    'memberships',       coalesce((select jsonb_agg(to_jsonb(t)) from memberships t), '[]'::jsonb),
    'payments',          coalesce((select jsonb_agg(to_jsonb(t)) from payments t), '[]'::jsonb)
  )
$$;

revoke all on function public.get_member_state() from public, anon;
grant execute on function public.get_member_state() to authenticated;

commit;

notify pgrst, 'reload schema';
