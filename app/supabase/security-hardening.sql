-- Endurecimiento de permisos (auditoría appsec 2026-10-01: AC-001..AC-004, RC-003/004).
-- Ejecutar en SQL Editor de Supabase DESPUÉS de booking-rpc.sql (usa check_in_booking).
-- Idempotente: se puede correr más de una vez.
--
-- 1. El socio ya no escribe bookings, waitlist_entries ni check_ins directo: todo pasa
--    por book_session / cancel_booking / reschedule_booking / check_in_booking, que
--    validan cupo, membresía, código y ventana con la sesión bloqueada.
-- 2. Admin y staff dejan de ser iguales en la base: solo admin cambia roles y planes.
-- 3. El cupo cuenta también 'pending' y 'attended' (el check-in no libera lugar).
-- 4. Borrar una cuenta de staff no queda bloqueado por las mediciones que registró.

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Sin sesión (auth.uid() null) es SQL Editor, service_role o el alta de usuario.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' and new.role is distinct from 'member' then
    raise exception 'Solo un admin puede asignar roles';
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    raise exception 'Solo un admin puede cambiar roles';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_role() from public, anon, authenticated;

drop trigger if exists profiles_guard_role on profiles;
create trigger profiles_guard_role
before insert or update of role on profiles
for each row execute function public.guard_profile_role();

drop policy if exists "membership_plans write staff" on membership_plans;
drop policy if exists "membership_plans write admin" on membership_plans;
create policy "membership_plans write admin" on membership_plans for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reservas, lista de espera y check-in: escritura solo staff (o vía RPC)
-- ---------------------------------------------------------------------------
drop policy if exists "bookings insert own" on bookings;
drop policy if exists "bookings update own or staff" on bookings;
drop policy if exists "bookings insert staff" on bookings;
drop policy if exists "bookings update staff" on bookings;
create policy "bookings insert staff" on bookings for insert to authenticated
  with check (public.is_staff());
create policy "bookings update staff" on bookings for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "waitlist write" on waitlist_entries;
drop policy if exists "waitlist write staff" on waitlist_entries;
create policy "waitlist write staff" on waitlist_entries for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "checkins write" on check_ins;
drop policy if exists "checkins write staff" on check_ins;
create policy "checkins write staff" on check_ins for insert to authenticated
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Cupo visible (sessions.booked_count) con la misma regla que session_seats_taken()
-- ---------------------------------------------------------------------------
create or replace function public.sync_session_booked_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
begin
  sid := coalesce(NEW.session_id, OLD.session_id);
  update public.sessions
  set booked_count = (
    select count(*)::int
    from public.bookings
    where session_id = sid and status in ('confirmed', 'pending', 'attended')
  )
  where id = sid;
  return coalesce(NEW, OLD);
end;
$$;

update sessions s
set booked_count = (
  select count(*)::int from bookings b
  where b.session_id = s.id and b.status in ('confirmed', 'pending', 'attended')
)
where s.booked_count is distinct from (
  select count(*)::int from bookings b
  where b.session_id = s.id and b.status in ('confirmed', 'pending', 'attended')
);

-- ---------------------------------------------------------------------------
-- Borrar cuenta (delete_user_account): recorded_by no debe bloquear la cascada
-- ---------------------------------------------------------------------------
alter table body_measurements alter column recorded_by drop not null;
alter table body_measurements drop constraint if exists body_measurements_recorded_by_fkey;
alter table body_measurements
  add constraint body_measurements_recorded_by_fkey
  foreign key (recorded_by) references profiles(id) on delete set null;
