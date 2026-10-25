-- Reversión de perf-rls-indices.sql: restaura las políticas tal como estaban en QA el 23-oct-2026,
-- quita get_member_state() y los índices nuevos. El cliente vuelve solo al camino de 14 lecturas.
begin;
set local search_path = public;

alter policy "body_goals delete" on public.body_goals
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "body_goals insert" on public.body_goals
  with check (((user_id = auth.uid()) OR is_staff()));

alter policy "body_goals own or staff" on public.body_goals
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "body_goals update" on public.body_goals
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "weight delete" on public.body_measurements
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "weight insert" on public.body_measurements
  with check (((user_id = auth.uid()) OR is_staff()));

alter policy "weight own or staff" on public.body_measurements
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "weight update" on public.body_measurements
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "bookings insert staff" on public.bookings
  with check (is_staff());

alter policy "bookings own or staff" on public.bookings
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "bookings update staff" on public.bookings
  using (is_staff())
  with check (is_staff());

alter policy "checkins own or staff" on public.check_ins
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "checkins write staff" on public.check_ins
  with check (is_staff());

alter policy "templates write" on public.class_templates
  using (is_staff());

alter policy "settings write admin" on public.gym_settings
  using (is_admin())
  with check (is_admin());

alter policy "legal consents read own or staff" on public.legal_consents
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "membership_plans read active or staff" on public.membership_plans
  using (((active = true) OR is_staff() OR (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.plan_id = membership_plans.id) AND (m.user_id = auth.uid()))))));

alter policy "membership_plans write admin" on public.membership_plans
  using (is_admin())
  with check (is_admin());

alter policy "memberships select own or staff" on public.memberships
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "memberships write staff" on public.memberships
  using (is_staff());

alter policy "payments insert own plan request" on public.payments
  with check (((user_id = auth.uid()) AND (status = 'pending'::text) AND (provider = 'manual'::text) AND (membership_id IS NULL) AND plan_sellable_in_app(plan_id) AND (plan_purchase_block_reason(user_id, plan_id) IS NULL) AND (manual_method IS DISTINCT FROM 'pagomedios_recurring'::text)));

alter policy "payments select own or staff" on public.payments
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "payments update own plan request" on public.payments
  using (((user_id = auth.uid()) AND (status = 'pending'::text) AND (provider = 'manual'::text)))
  with check (((user_id = auth.uid()) AND (status = 'pending'::text) AND (provider = 'manual'::text) AND (membership_id IS NULL) AND plan_sellable_in_app(plan_id) AND (plan_purchase_block_reason(user_id, plan_id) IS NULL) AND (manual_method IS DISTINCT FROM 'pagomedios_recurring'::text)));

alter policy "payments write staff" on public.payments
  using (is_staff());

alter policy "profiles read self or staff" on public.profiles
  using (((id = auth.uid()) OR is_staff()));

alter policy "profiles update self or staff" on public.profiles
  using (((id = auth.uid()) OR is_staff()))
  -- Sin subconsulta a profiles (recursión 42P17). Ver fix-profiles-update-rls.sql.
  with check (((id = auth.uid()) OR is_staff()));

alter policy "sessions write" on public.sessions
  using (is_staff());

alter policy "trainers write" on public.trainers
  using (is_staff());

alter policy "waitlist own or staff" on public.waitlist_entries
  using (((user_id = auth.uid()) OR is_staff()));

alter policy "waitlist write staff" on public.waitlist_entries
  using (is_staff())
  with check (is_staff());

alter policy "catalog write" on public.zones
  using (is_staff());

drop function if exists public.get_member_state();

drop index if exists public.idx_bookings_user_id;
drop index if exists public.idx_bookings_session_status;
drop index if exists public.idx_check_ins_user_id;
drop index if exists public.idx_check_ins_booking_id;
drop index if exists public.idx_check_ins_session_id;
drop index if exists public.idx_waitlist_session_position;
drop index if exists public.idx_waitlist_user_id;
drop index if exists public.idx_body_measurements_user_id;
drop index if exists public.idx_body_measurements_recorded_by;
drop index if exists public.idx_body_goals_user_id;
drop index if exists public.idx_sessions_starts_at;
drop index if exists public.idx_sessions_template_id;
drop index if exists public.idx_sessions_zone_id;
drop index if exists public.idx_sessions_trainer_id;
drop index if exists public.idx_class_templates_zone_id;
drop index if exists public.idx_class_templates_trainer_id;
drop index if exists public.idx_memberships_plan_id;
drop index if exists public.idx_payments_membership_id;
drop index if exists public.idx_payments_plan_id;

commit;

notify pgrst, 'reload schema';
